// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BaseERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IDEXRouter {
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

interface IDEXFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract AdvancedERC20 is BaseERC20 {
    IDEXRouter public dexRouter;
    address public dexPair;
    
    bool public autoLiquidityEnabled = false;
    uint256 public liquidityThreshold;
    uint256 public maxWalletAmount;
    uint256 public maxTransactionAmount;
    
    bool public reflectionEnabled = false;
    uint256 public reflectionRate = 0;
    uint256 private _reflectionTotal;
    mapping(address => bool) public excludedFromReflection;
    
    bool public autoBurnEnabled = false;
    uint256 public burnRate = 0;
    uint256 public totalBurned = 0;
    
    bool private _inSwap = false;
    
    event DexRouterUpdated(address newRouter);
    event AutoLiquidityUpdated(bool enabled, uint256 threshold);
    event ReflectionUpdated(bool enabled, uint256 rate);
    event AutoBurnUpdated(bool enabled, uint256 rate);
    event LimitsUpdated(uint256 maxWallet, uint256 maxTransaction);
    event TokensBurned(uint256 amount);
    
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
        uint256 buyTax_,
        uint256 sellTax_,
        uint256 transferTax_,
        address dexRouter_,
        bool autoLiquidity_,
        uint256 liquidityThreshold_,
        uint256 maxWallet_,
        uint256 maxTransaction_
    ) BaseERC20(
        name_,
        symbol_,
        decimals_,
        initialSupply_,
        maxSupply_,
        owner_,
        taxWallet_,
        buyTax_,
        sellTax_,
        transferTax_
    ) {
        if (dexRouter_ != address(0)) {
            _setupDex(dexRouter_);
        }
        
        autoLiquidityEnabled = autoLiquidity_;
        liquidityThreshold = liquidityThreshold_ > 0 ? liquidityThreshold_ : (initialSupply_ * 10**decimals_) / 1000; // 0.1% default
        
        maxWalletAmount = maxWallet_ > 0 ? maxWallet_ : type(uint256).max;
        maxTransactionAmount = maxTransaction_ > 0 ? maxTransaction_ : type(uint256).max;
        
        excludedFromReflection[address(0)] = true;
        excludedFromReflection[address(this)] = true;
        excludedFromReflection[owner_] = true;
    }
    
    function _setupDex(address router) internal {
        dexRouter = IDEXRouter(router);
        dexPair = IDEXFactory(dexRouter.factory()).createPair(address(this), dexRouter.WETH());
        
        excludedFromFees[address(dexRouter)] = true;
        excludedFromReflection[dexPair] = true;
    }
    
    function setupDex(address router) public onlyOwner {
        require(router != address(0), "Router cannot be zero address");
        _setupDex(router);
        emit DexRouterUpdated(router);
    }
    
    function setAutoLiquidity(bool enabled, uint256 threshold) public onlyOwner {
        autoLiquidityEnabled = enabled;
        liquidityThreshold = threshold;
        emit AutoLiquidityUpdated(enabled, threshold);
    }
    
    function setReflection(bool enabled, uint256 rate) public onlyOwner {
        require(rate <= 1000, "Reflection rate too high"); // Max 10%
        reflectionEnabled = enabled;
        reflectionRate = rate;
        emit ReflectionUpdated(enabled, rate);
    }
    
    function setAutoBurn(bool enabled, uint256 rate) public onlyOwner {
        require(rate <= 1000, "Burn rate too high"); // Max 10%
        autoBurnEnabled = enabled;
        burnRate = rate;
        emit AutoBurnUpdated(enabled, rate);
    }
    
    function setLimits(uint256 maxWallet, uint256 maxTransaction) public onlyOwner {
        maxWalletAmount = maxWallet;
        maxTransactionAmount = maxTransaction;
        emit LimitsUpdated(maxWallet, maxTransaction);
    }
    
    function excludeFromReflection(address account, bool excluded) public onlyOwner {
        excludedFromReflection[account] = excluded;
    }
    
    function _update(address from, address to, uint256 value) internal override {
        require(value <= maxTransactionAmount || excludedFromFees[from] || excludedFromFees[to], "Transfer exceeds max transaction");
        
        if (to != address(0) && !excludedFromFees[to]) {
            require(balanceOf(to) + value <= maxWalletAmount, "Would exceed max wallet");
        }
        
        if (autoLiquidityEnabled && !_inSwap && from != dexPair && balanceOf(address(this)) >= liquidityThreshold) {
            _addLiquidity();
        }
        
        uint256 taxAmount = 0;
        uint256 burnAmount = 0;
        uint256 reflectionAmount = 0;
        
        if (from != address(0) && to != address(0) && !excludedFromFees[from] && !excludedFromFees[to]) {
            uint256 taxRate = _getTaxRate(from, to);
            if (taxRate > 0) {
                taxAmount = (value * taxRate) / 10000;
            }
            
            if (autoBurnEnabled && burnRate > 0) {
                burnAmount = (value * burnRate) / 10000;
            }
            
            if (reflectionEnabled && reflectionRate > 0 && !excludedFromReflection[from]) {
                reflectionAmount = (value * reflectionRate) / 10000;
            }
        }
        
        uint256 totalDeductions = taxAmount + burnAmount + reflectionAmount;
        require(totalDeductions <= value, "Deductions exceed transfer amount");
        
        if (taxAmount > 0) {
            super._update(from, taxWallet, taxAmount);
        }
        
        if (burnAmount > 0) {
            super._update(from, address(0), burnAmount);
            totalBurned += burnAmount;
            emit TokensBurned(burnAmount);
        }
        
        if (reflectionAmount > 0) {
            super._update(from, address(this), reflectionAmount);
            _reflectionTotal += reflectionAmount;
        }
        
        super._update(from, to, value - totalDeductions);
    }
    
    function _getTaxRate(address from, address to) internal view override returns (uint256) {
        if (from == dexPair) {
            return buyTaxRate;
        } else if (to == dexPair) {
            return sellTaxRate;
        } else {
            return transferTaxRate;
        }
    }
    
    function _addLiquidity() internal swapping {
        uint256 contractBalance = balanceOf(address(this));
        uint256 liquidityAmount = Math.min(contractBalance, liquidityThreshold);
        
        if (liquidityAmount == 0) return;
        
        uint256 half = liquidityAmount / 2;
        uint256 otherHalf = liquidityAmount - half;
        
        uint256 initialETHBalance = address(this).balance;
        
        _swapTokensForETH(half);
        
        uint256 newETHBalance = address(this).balance - initialETHBalance;
        
        if (newETHBalance > 0 && otherHalf > 0) {
            _approve(address(this), address(dexRouter), otherHalf);
            
            dexRouter.addLiquidityETH{value: newETHBalance}(
                address(this),
                otherHalf,
                0,
                0,
                owner(),
                block.timestamp + 300
            );
        }
    }
    
    function _swapTokensForETH(uint256 tokenAmount) internal {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = dexRouter.WETH();
        
        _approve(address(this), address(dexRouter), tokenAmount);
        
        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
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
    
    function getReflectionBalance() public view returns (uint256) {
        return _reflectionTotal;
    }
    
    function distributeReflections() public onlyOwner {
        require(_reflectionTotal > 0, "No reflections to distribute");
        
        uint256 totalSupplyExcluded = 0;
        for (uint256 i = 0; i < totalSupply(); i++) {
            // This is a simplified implementation
            // In practice, you'd need to track all holders and their exclusion status
        }
        
        // Simplified distribution - in practice, implement proper reflection mechanism
        _reflectionTotal = 0;
    }
}