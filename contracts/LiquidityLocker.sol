// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityLocker is Ownable, ReentrancyGuard {
    struct LockInfo {
        address token;
        address owner;
        uint256 amount;
        uint256 lockTime;
        uint256 unlockTime;
        bool claimed;
        string description;
    }
    
    mapping(uint256 => LockInfo) public locks;
    mapping(address => uint256[]) public userLocks;
    mapping(address => uint256[]) public tokenLocks;
    
    uint256 public nextLockId = 1;
    uint256 public lockFee = 0.01 ether; // Fee in ETH for creating a lock
    address public feeReceiver;
    
    event LiquidityLocked(
        uint256 indexed lockId,
        address indexed token,
        address indexed owner,
        uint256 amount,
        uint256 unlockTime,
        string description
    );
    
    event LiquidityUnlocked(
        uint256 indexed lockId,
        address indexed token,
        address indexed owner,
        uint256 amount
    );
    
    event LockExtended(
        uint256 indexed lockId,
        uint256 oldUnlockTime,
        uint256 newUnlockTime
    );
    
    event LockTransferred(
        uint256 indexed lockId,
        address indexed oldOwner,
        address indexed newOwner
    );
    
    event FeeUpdated(uint256 newFee);
    event FeeReceiverUpdated(address newReceiver);
    
    constructor(address owner_, address feeReceiver_) Ownable(owner_) {
        feeReceiver = feeReceiver_ != address(0) ? feeReceiver_ : owner_;
    }
    
    function lockLiquidity(
        address token,
        uint256 amount,
        uint256 unlockTime,
        string memory description
    ) external payable nonReentrant returns (uint256 lockId) {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(unlockTime > block.timestamp, "Unlock time must be in the future");
        require(msg.value >= lockFee, "Insufficient fee");
        
        // Transfer tokens from user to this contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Create lock record
        lockId = nextLockId++;
        locks[lockId] = LockInfo({
            token: token,
            owner: msg.sender,
            amount: amount,
            lockTime: block.timestamp,
            unlockTime: unlockTime,
            claimed: false,
            description: description
        });
        
        // Update mappings
        userLocks[msg.sender].push(lockId);
        tokenLocks[token].push(lockId);
        
        // Send fee to receiver
        if (msg.value > 0) {
            payable(feeReceiver).transfer(msg.value);
        }
        
        emit LiquidityLocked(lockId, token, msg.sender, amount, unlockTime, description);
    }
    
    function unlockLiquidity(uint256 lockId) external nonReentrant {
        LockInfo storage lock = locks[lockId];
        require(lock.owner == msg.sender, "Not the lock owner");
        require(!lock.claimed, "Already claimed");
        require(block.timestamp >= lock.unlockTime, "Lock period not expired");
        
        lock.claimed = true;
        
        // Transfer tokens back to owner
        IERC20(lock.token).transfer(lock.owner, lock.amount);
        
        emit LiquidityUnlocked(lockId, lock.token, lock.owner, lock.amount);
    }
    
    function extendLock(uint256 lockId, uint256 newUnlockTime) external {
        LockInfo storage lock = locks[lockId];
        require(lock.owner == msg.sender, "Not the lock owner");
        require(!lock.claimed, "Lock already claimed");
        require(newUnlockTime > lock.unlockTime, "New unlock time must be later");
        
        uint256 oldUnlockTime = lock.unlockTime;
        lock.unlockTime = newUnlockTime;
        
        emit LockExtended(lockId, oldUnlockTime, newUnlockTime);
    }
    
    function transferLockOwnership(uint256 lockId, address newOwner) external {
        require(newOwner != address(0), "Invalid new owner");
        
        LockInfo storage lock = locks[lockId];
        require(lock.owner == msg.sender, "Not the lock owner");
        require(!lock.claimed, "Lock already claimed");
        
        address oldOwner = lock.owner;
        lock.owner = newOwner;
        
        // Update user locks mapping
        userLocks[newOwner].push(lockId);
        
        // Remove from old owner's locks
        uint256[] storage oldOwnerLocks = userLocks[oldOwner];
        for (uint256 i = 0; i < oldOwnerLocks.length; i++) {
            if (oldOwnerLocks[i] == lockId) {
                oldOwnerLocks[i] = oldOwnerLocks[oldOwnerLocks.length - 1];
                oldOwnerLocks.pop();
                break;
            }
        }
        
        emit LockTransferred(lockId, oldOwner, newOwner);
    }
    
    function emergencyUnlock(uint256 lockId) external onlyOwner {
        LockInfo storage lock = locks[lockId];
        require(!lock.claimed, "Already claimed");
        
        lock.claimed = true;
        
        // Transfer tokens back to original owner
        IERC20(lock.token).transfer(lock.owner, lock.amount);
        
        emit LiquidityUnlocked(lockId, lock.token, lock.owner, lock.amount);
    }
    
    function setLockFee(uint256 newFee) external onlyOwner {
        lockFee = newFee;
        emit FeeUpdated(newFee);
    }
    
    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Invalid fee receiver");
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
    }
    
    function getLockInfo(uint256 lockId) external view returns (LockInfo memory) {
        return locks[lockId];
    }
    
    function getUserLocks(address user) external view returns (uint256[] memory) {
        return userLocks[user];
    }
    
    function getTokenLocks(address token) external view returns (uint256[] memory) {
        return tokenLocks[token];
    }
    
    function getUserLockCount(address user) external view returns (uint256) {
        return userLocks[user].length;
    }
    
    function getTokenLockCount(address token) external view returns (uint256) {
        return tokenLocks[token].length;
    }
    
    function isLockExpired(uint256 lockId) external view returns (bool) {
        return block.timestamp >= locks[lockId].unlockTime;
    }
    
    function getTimeToUnlock(uint256 lockId) external view returns (uint256) {
        if (block.timestamp >= locks[lockId].unlockTime) {
            return 0;
        }
        return locks[lockId].unlockTime - block.timestamp;
    }
    
    // Function to recover accidentally sent tokens (not locked tokens)
    function recoverToken(address token, uint256 amount) external onlyOwner {
        // Calculate total locked amount for this token
        uint256 totalLocked = 0;
        uint256[] memory lockIds = tokenLocks[token];
        
        for (uint256 i = 0; i < lockIds.length; i++) {
            LockInfo memory lock = locks[lockIds[i]];
            if (!lock.claimed) {
                totalLocked += lock.amount;
            }
        }
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(contractBalance >= totalLocked + amount, "Cannot recover locked tokens");
        
        IERC20(token).transfer(owner(), amount);
    }
    
    receive() external payable {}
}