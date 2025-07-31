// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BaseERC20 is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    uint8 private _decimals;
    uint256 public maxSupply;
    bool public mintingFinished = false;
    
    mapping(address => bool) public excludedFromFees;
    
    uint256 public buyTaxRate = 0;
    uint256 public sellTaxRate = 0;
    uint256 public transferTaxRate = 0;
    uint256 public constant MAX_TAX_RATE = 1000;
    
    address public taxWallet;
    
    bool public tradingEnabled = true;
    mapping(address => bool) public blacklisted;
    
    event TaxRatesUpdated(uint256 buyTax, uint256 sellTax, uint256 transferTax);
    event TaxWalletUpdated(address newTaxWallet);
    event TradingStatusUpdated(bool enabled);
    event AddressBlacklisted(address account, bool status);
    event MintingFinished();

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
        uint256 transferTax_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        require(owner_ != address(0), "Owner cannot be zero address");
        require(initialSupply_ <= maxSupply_ || maxSupply_ == 0, "Initial supply exceeds max supply");
        require(buyTax_ <= MAX_TAX_RATE && sellTax_ <= MAX_TAX_RATE && transferTax_ <= MAX_TAX_RATE, "Tax rate too high");
        
        _decimals = decimals_;
        maxSupply = maxSupply_ > 0 ? maxSupply_ * 10**decimals_ : 0;
        taxWallet = taxWallet_ != address(0) ? taxWallet_ : owner_;
        
        buyTaxRate = buyTax_;
        sellTaxRate = sellTax_;
        transferTaxRate = transferTax_;
        
        excludedFromFees[owner_] = true;
        excludedFromFees[address(this)] = true;
        excludedFromFees[taxWallet] = true;
        
        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_ * 10**decimals_);
        }
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
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
    
    function updateTaxWallet(address newTaxWallet) public onlyOwner {
        require(newTaxWallet != address(0), "Tax wallet cannot be zero address");
        taxWallet = newTaxWallet;
        excludedFromFees[newTaxWallet] = true;
        emit TaxWalletUpdated(newTaxWallet);
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
    
    function _update(address from, address to, uint256 value) internal virtual override {
        require(!blacklisted[from] && !blacklisted[to], "Address is blacklisted");
        
        if (from != address(0) && to != address(0)) {
            require(tradingEnabled || excludedFromFees[from] || excludedFromFees[to], "Trading is disabled");
        }
        
        uint256 taxAmount = 0;
        
        if (from != address(0) && to != address(0) && !excludedFromFees[from] && !excludedFromFees[to]) {
            uint256 taxRate = _getTaxRate(from, to);
            if (taxRate > 0) {
                taxAmount = (value * taxRate) / 10000;
                if (taxAmount > 0) {
                    super._update(from, taxWallet, taxAmount);
                }
            }
        }
        
        super._update(from, to, value - taxAmount);
    }
    
    function _getTaxRate(address from, address to) internal view virtual returns (uint256) {
        return transferTaxRate;
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