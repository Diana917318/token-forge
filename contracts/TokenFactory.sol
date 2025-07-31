// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./tokens/BaseERC20.sol";
import "./tokens/AdvancedERC20.sol";
import "./tokens/BEP20Token.sol";
import "./LiquidityLocker.sol";
import "./VestingContract.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenFactory is Ownable, ReentrancyGuard {
    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 createdAt;
        string tokenType;
        string name;
        string symbol;
    }
    
    mapping(address => TokenInfo) public tokens;
    mapping(address => address[]) public creatorTokens;
    address[] public allTokens;
    
    LiquidityLocker public liquidityLocker;
    VestingContract public vestingContract;
    
    uint256 public creationFee = 0.01 ether;
    address public feeReceiver;
    
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string tokenType,
        string name,
        string symbol,
        uint256 initialSupply
    );
    
    event LiquidityLockerDeployed(address indexed lockerAddress);
    event VestingContractDeployed(address indexed vestingAddress);
    event CreationFeeUpdated(uint256 newFee);
    event FeeReceiverUpdated(address newReceiver);
    
    constructor(address owner_, address feeReceiver_) Ownable(owner_) {
        feeReceiver = feeReceiver_ != address(0) ? feeReceiver_ : owner_;
        
        // Deploy utility contracts with this factory as owner
        liquidityLocker = new LiquidityLocker(address(this), feeReceiver);
        vestingContract = new VestingContract(address(this));
        
        emit LiquidityLockerDeployed(address(liquidityLocker));
        emit VestingContractDeployed(address(vestingContract));
    }
    
    function createBaseERC20(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialSupply,
        uint256 maxSupply,
        address taxWallet,
        uint256 buyTax,
        uint256 sellTax,
        uint256 transferTax
    ) external payable nonReentrant returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name and symbol required");
        
        BaseERC20 token = new BaseERC20(
            name,
            symbol,
            decimals,
            initialSupply,
            maxSupply,
            msg.sender,
            taxWallet,
            buyTax,
            sellTax,
            transferTax
        );
        
        address tokenAddress = address(token);
        _registerToken(tokenAddress, "BaseERC20", name, symbol, initialSupply);
        
        // Send fee to receiver
        if (msg.value > 0) {
            payable(feeReceiver).transfer(msg.value);
        }
        
        return tokenAddress;
    }
    
    function createAdvancedERC20(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialSupply,
        uint256 maxSupply,
        address taxWallet,
        uint256 buyTax,
        uint256 sellTax,
        uint256 transferTax,
        address dexRouter,
        bool autoLiquidity,
        uint256 liquidityThreshold,
        uint256 maxWallet,
        uint256 maxTransaction
    ) external payable nonReentrant returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name and symbol required");
        
        AdvancedERC20 token = new AdvancedERC20(
            name,
            symbol,
            decimals,
            initialSupply,
            maxSupply,
            msg.sender,
            taxWallet,
            buyTax,
            sellTax,
            transferTax,
            dexRouter,
            autoLiquidity,
            liquidityThreshold,
            maxWallet,
            maxTransaction
        );
        
        address tokenAddress = address(token);
        _registerToken(tokenAddress, "AdvancedERC20", name, symbol, initialSupply);
        
        // Send fee to receiver
        if (msg.value > 0) {
            payable(feeReceiver).transfer(msg.value);
        }
        
        return tokenAddress;
    }
    
    function createBEP20Token(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialSupply,
        uint256 maxSupply,
        address taxWallet,
        address marketingWallet,
        address liquidityWallet,
        uint256 buyTax,
        uint256 sellTax,
        uint256 transferTax,
        address pancakeRouter
    ) external payable nonReentrant returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name and symbol required");
        
        BEP20Token token = new BEP20Token(
            name,
            symbol,
            decimals,
            initialSupply,
            maxSupply,
            msg.sender,
            taxWallet,
            marketingWallet,
            liquidityWallet,
            buyTax,
            sellTax,
            transferTax,
            pancakeRouter
        );
        
        address tokenAddress = address(token);
        _registerToken(tokenAddress, "BEP20Token", name, symbol, initialSupply);
        
        // Send fee to receiver
        if (msg.value > 0) {
            payable(feeReceiver).transfer(msg.value);
        }
        
        return tokenAddress;
    }
    
    function _registerToken(
        address tokenAddress,
        string memory tokenType,
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) internal {
        tokens[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            tokenType: tokenType,
            name: name,
            symbol: symbol
        });
        
        creatorTokens[msg.sender].push(tokenAddress);
        allTokens.push(tokenAddress);
        
        emit TokenCreated(tokenAddress, msg.sender, tokenType, name, symbol, initialSupply);
    }
    
    function setCreationFee(uint256 newFee) external onlyOwner {
        creationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }
    
    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Invalid fee receiver");
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
    }
    
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory) {
        return tokens[tokenAddress];
    }
    
    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }
    
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    function getCreatorTokenCount(address creator) external view returns (uint256) {
        return creatorTokens[creator].length;
    }
    
    function isTokenCreatedByFactory(address tokenAddress) external view returns (bool) {
        return tokens[tokenAddress].tokenAddress != address(0);
    }
    
    function getTokensByCreator(address creator, uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory) 
    {
        address[] memory creatorTokenList = creatorTokens[creator];
        uint256 length = creatorTokenList.length;
        
        if (offset >= length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = creatorTokenList[i];
        }
        
        return result;
    }
    
    function getAllTokensPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory) 
    {
        uint256 length = allTokens.length;
        
        if (offset >= length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTokens[i];
        }
        
        return result;
    }
    
    // Utility functions for integrated contracts
    function getLiquidityLocker() external view returns (address) {
        return address(liquidityLocker);
    }
    
    function getVestingContract() external view returns (address) {
        return address(vestingContract);
    }
    
    // Function to create vesting schedule for newly created tokens
    function createVestingScheduleForToken(
        address token,
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        string memory description
    ) external returns (bytes32) {
        require(tokens[token].creator == msg.sender, "Only token creator can create vesting");
        
        // Transfer tokens from user to this factory first
        IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        
        // Approve the vesting contract to spend tokens from this factory
        IERC20(token).approve(address(vestingContract), totalAmount);
        
        return vestingContract.createVestingSchedule(
            beneficiary,
            token,
            totalAmount,
            startTime,
            cliff,
            duration,
            slicePeriodSeconds,
            revocable,
            description
        );
    }
    
    // Function to lock liquidity for newly created tokens
    function lockLiquidityForToken(
        address token,
        uint256 amount,
        uint256 unlockTime,
        string memory description
    ) external payable returns (uint256) {
        require(tokens[token].creator == msg.sender, "Only token creator can lock liquidity");
        
        // Transfer tokens from user to this factory first
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Approve the liquidity locker to spend tokens from this factory
        IERC20(token).approve(address(liquidityLocker), amount);
        
        return liquidityLocker.lockLiquidity{value: msg.value}(
            token,
            amount,
            unlockTime,
            description
        );
    }
    
    receive() external payable {}
}