// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBEP20 {
    function getOwner() external view returns (address);
}

interface IPancakeRouter {
    function WETH() external pure returns (address);
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    
    function factory() external pure returns (address);
}

interface IPancakeFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract BEP20Token is ERC20, ERC20Burnable, Ownable, ReentrancyGuard, IBEP20 {
    uint8 private _decimals;
    uint256 public maxSupply;
    bool public mintingFinished = false;
    
    mapping(address => bool) public excludedFromFees;
    
    uint256 public buyTaxRate = 0;
    uint256 public sellTaxRate = 0;
    uint256 public transferTaxRate = 0;
    uint256 public constant MAX_TAX_RATE = 1000;
    
    address public taxWallet;
    address public marketingWallet;
    address public liquidityWallet;
    
    uint256 public marketingFeeRate = 0;
    uint256 public liquidityFeeRate = 0;
    uint256 public burnFeeRate = 0;
    
    bool public tradingEnabled = true;
    mapping(address => bool) public blacklisted;
    
    IPancakeRouter public pancakeRouter;
    address public pancakePair;
    
    bool public autoLiquidityEnabled = false;
    uint256 public liquidityThreshold;
    uint256 public maxWalletAmount;
    uint256 public maxTransactionAmount;
    
    bool private _inSwap = false;
    
    event TaxRatesUpdated(uint256 buyTax, uint256 sellTax, uint256 transferTax);
    event FeeRatesUpdated(uint256 marketing, uint256 liquidity, uint256 burn);
    event WalletsUpdated(address tax, address marketing, address liquidity);
    event TradingStatusUpdated(bool enabled);
    event AddressBlacklisted(address account, bool status);
    event MintingFinished();
    event PancakeRouterUpdated(address newRouter);
    event AutoLiquidityUpdated(bool enabled, uint256 threshold);
    event LimitsUpdated(uint256 maxWallet, uint256 maxTransaction);
    
    modifier swapping() {
        _inSwap = true;
        _;
        _inSwap = false;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        address owner_,
        address taxWallet_,
        address marketingWallet_,
        address liquidityWallet_,
        uint256 buyTax_,
        uint256 sellTax_,
        uint256 transferTax_,
        address pancakeRouter_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        require(owner_ != address(0), "Owner cannot be zero address");
        require(initialSupply_ <= maxSupply_ || maxSupply_ == 0, "Initial supply exceeds max supply");
        require(buyTax_ <= MAX_TAX_RATE && sellTax_ <= MAX_TAX_RATE && transferTax_ <= MAX_TAX_RATE, "Tax rate too high");
        
        _decimals = decimals_;
        maxSupply = maxSupply_;
        
        taxWallet = taxWallet_ != address(0) ? taxWallet_ : owner_;
        marketingWallet = marketingWallet_ != address(0) ? marketingWallet_ : owner_;
        liquidityWallet = liquidityWallet_ != address(0) ? liquidityWallet_ : owner_;
        
        buyTaxRate = buyTax_;
        sellTaxRate = sellTax_;
        transferTaxRate = transferTax_;
        
        excludedFromFees[owner_] = true;
        excludedFromFees[address(this)] = true;
        excludedFromFees[taxWallet] = true;
        excludedFromFees[marketingWallet] = true;
        excludedFromFees[liquidityWallet] = true;
        
        if (pancakeRouter_ != address(0)) {
            _setupPancake(pancakeRouter_);
        }
        
        liquidityThreshold = (initialSupply_ * 10**decimals_) / 1000; // 0.1% default
        maxWalletAmount = type(uint256).max;
        maxTransactionAmount = type(uint256).max;
        
        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_ * 10**decimals_);
        }
    }
    
    function getOwner() external view override returns (address) {
        return owner();
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function _setupPancake(address router) internal {
        pancakeRouter = IPancakeRouter(router);
        pancakePair = IPancakeFactory(pancakeRouter.factory()).createPair(address(this), pancakeRouter.WETH());
        
        excludedFromFees[address(pancakeRouter)] = true;
        excludedFromFees[pancakePair] = true;
    }
    
    function setupPancakeRouter(address router) public onlyOwner {
        require(router != address(0), "Router cannot be zero address");
        _setupPancake(router);
        emit PancakeRouterUpdated(router);
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        require(!mintingFinished, "Minting is finished");
        require(to != address(0), "Cannot mint to zero address");
        
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "Would exceed max supply");
        }
        
        _mint(to, amount);
    }
    
    function finishMinting() public onlyOwner {
        mintingFinished = true;
        emit MintingFinished();
    }
    
    function updateTaxRates(uint256 buyTax, uint256 sellTax, uint256 transferTax) public onlyOwner {
        require(buyTax <= MAX_TAX_RATE && sellTax <= MAX_TAX_RATE && transferTax <= MAX_TAX_RATE, "Tax rate too high");
        
        buyTaxRate = buyTax;
        sellTaxRate = sellTax;
        transferTaxRate = transferTax;
        
        emit TaxRatesUpdated(buyTax, sellTax, transferTax);
    }
    
    function updateFeeRates(uint256 marketing, uint256 liquidity, uint256 burn) public onlyOwner {
        require(marketing + liquidity + burn <= 1000, "Total fee rate too high"); // Max 10%
        
        marketingFeeRate = marketing;
        liquidityFeeRate = liquidity;
        burnFeeRate = burn;
        
        emit FeeRatesUpdated(marketing, liquidity, burn);
    }
    
    function updateWallets(address tax, address marketing, address liquidity) public onlyOwner {
        require(tax != address(0) && marketing != address(0) && liquidity != address(0), "Wallets cannot be zero address");
        
        taxWallet = tax;
        marketingWallet = marketing;
        liquidityWallet = liquidity;
        
        excludedFromFees[tax] = true;
        excludedFromFees[marketing] = true;
        excludedFromFees[liquidity] = true;
        
        emit WalletsUpdated(tax, marketing, liquidity);
    }
    
    function excludeFromFees(address account, bool excluded) public onlyOwner {
        excludedFromFees[account] = excluded;
    }
    
    function setTradingEnabled(bool enabled) public onlyOwner {
        tradingEnabled = enabled;
        emit TradingStatusUpdated(enabled);
    }
    
    function setBlacklisted(address account, bool status) public onlyOwner {
        require(account != owner(), "Cannot blacklist owner");
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
    }
    
    function setAutoLiquidity(bool enabled, uint256 threshold) public onlyOwner {
        autoLiquidityEnabled = enabled;
        liquidityThreshold = threshold;
        emit AutoLiquidityUpdated(enabled, threshold);
    }
    
    function setLimits(uint256 maxWallet, uint256 maxTransaction) public onlyOwner {
        maxWalletAmount = maxWallet;
        maxTransactionAmount = maxTransaction;
        emit LimitsUpdated(maxWallet, maxTransaction);
    }
    
    function _update(address from, address to, uint256 value) internal virtual override {
        require(!blacklisted[from] && !blacklisted[to], "Address is blacklisted");
        
        if (from != address(0) && to != address(0)) {
            require(tradingEnabled || excludedFromFees[from] || excludedFromFees[to], "Trading is disabled");
            require(value <= maxTransactionAmount || excludedFromFees[from] || excludedFromFees[to], "Transfer exceeds max transaction");
        }
        
        if (to != address(0) && !excludedFromFees[to]) {
            require(balanceOf(to) + value <= maxWalletAmount, "Would exceed max wallet");
        }
        
        if (autoLiquidityEnabled && !_inSwap && from != pancakePair && balanceOf(address(this)) >= liquidityThreshold) {
            _addLiquidity();
        }
        
        uint256 taxAmount = 0;
        uint256 marketingAmount = 0;
        uint256 liquidityAmount = 0;
        uint256 burnAmount = 0;
        
        if (from != address(0) && to != address(0) && !excludedFromFees[from] && !excludedFromFees[to]) {
            uint256 taxRate = _getTaxRate(from, to);
            if (taxRate > 0) {
                taxAmount = (value * taxRate) / 10000;
            }
            
            if (marketingFeeRate > 0) {
                marketingAmount = (value * marketingFeeRate) / 10000;
            }
            
            if (liquidityFeeRate > 0) {
                liquidityAmount = (value * liquidityFeeRate) / 10000;
            }
            
            if (burnFeeRate > 0) {
                burnAmount = (value * burnFeeRate) / 10000;
            }
        }
        
        uint256 totalDeductions = taxAmount + marketingAmount + liquidityAmount + burnAmount;
        require(totalDeductions <= value, "Deductions exceed transfer amount");
        
        if (taxAmount > 0) {
            super._update(from, taxWallet, taxAmount);
        }
        
        if (marketingAmount > 0) {
            super._update(from, marketingWallet, marketingAmount);
        }
        
        if (liquidityAmount > 0) {
            super._update(from, liquidityWallet, liquidityAmount);
        }
        
        if (burnAmount > 0) {
            super._update(from, address(0), burnAmount);
        }
        
        super._update(from, to, value - totalDeductions);
    }
    
    function _getTaxRate(address from, address to) private view returns (uint256) {
        if (from == pancakePair) {
            return buyTaxRate;
        } else if (to == pancakePair) {
            return sellTaxRate;
        } else {
            return transferTaxRate;
        }
    }
    
    function _addLiquidity() internal swapping {
        uint256 contractBalance = balanceOf(address(this));
        uint256 liquidityAmount = contractBalance < liquidityThreshold ? contractBalance : liquidityThreshold;
        
        if (liquidityAmount == 0) return;
        
        uint256 half = liquidityAmount / 2;
        uint256 otherHalf = liquidityAmount - half;
        
        uint256 initialBNBBalance = address(this).balance;
        
        _swapTokensForBNB(half);
        
        uint256 newBNBBalance = address(this).balance - initialBNBBalance;
        
        if (newBNBBalance > 0 && otherHalf > 0) {
            _approve(address(this), address(pancakeRouter), otherHalf);
            
            pancakeRouter.addLiquidityETH{value: newBNBBalance}(
                address(this),
                otherHalf,
                0,
                0,
                liquidityWallet,
                block.timestamp + 300
            );
        }
    }
    
    function _swapTokensForBNB(uint256 tokenAmount) internal {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = pancakeRouter.WETH();
        
        _approve(address(this), address(pancakeRouter), tokenAmount);
        
        pancakeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
    }
    
    function manualSwapAndLiquify() public onlyOwner {
        _addLiquidity();
    }
    
    function rescueTokens(address tokenAddress, uint256 amount) public onlyOwner nonReentrant {
        require(tokenAddress != address(this), "Cannot rescue own tokens");
        
        if (tokenAddress == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(tokenAddress).transfer(owner(), amount);
        }
    }
    
    receive() external payable {}
}