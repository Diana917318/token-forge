// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VestingContract is Ownable, ReentrancyGuard {
    struct VestingSchedule {
        address beneficiary;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 cliff;
        uint256 duration;
        uint256 slicePeriodSeconds;
        bool revocable;
        bool revoked;
        string description;
    }
    
    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    mapping(address => bytes32[]) public beneficiarySchedules;
    mapping(address => bytes32[]) public tokenSchedules;
    mapping(address => uint256) public totalVestedAmount;
    
    uint256 public vestingSchedulesCount = 0;
    
    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        address indexed token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliff,
        uint256 duration,
        string description
    );
    
    event TokensReleased(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        address indexed token,
        uint256 amount
    );
    
    event VestingScheduleRevoked(bytes32 indexed scheduleId, uint256 unreleasedAmount);
    
    constructor(address owner_) Ownable(owner_) {}
    
    function createVestingSchedule(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        string memory description
    ) external onlyOwner returns (bytes32) {
        require(beneficiary != address(0), "Beneficiary cannot be zero address");
        require(token != address(0), "Token cannot be zero address");
        require(totalAmount > 0, "Total amount must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");
        require(slicePeriodSeconds >= 1, "Slice period must be at least 1 second");
        require(duration >= cliff, "Duration must be >= cliff");
        
        if (startTime == 0) {
            startTime = block.timestamp;
        }
        
        // Transfer tokens to this contract
        IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        
        bytes32 scheduleId = keccak256(
            abi.encodePacked(
                beneficiary,
                token,
                totalAmount,
                startTime,
                vestingSchedulesCount++
            )
        );
        
        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            token: token,
            totalAmount: totalAmount,
            releasedAmount: 0,
            startTime: startTime,
            cliff: cliff,
            duration: duration,
            slicePeriodSeconds: slicePeriodSeconds,
            revocable: revocable,
            revoked: false,
            description: description
        });
        
        beneficiarySchedules[beneficiary].push(scheduleId);
        tokenSchedules[token].push(scheduleId);
        totalVestedAmount[token] += totalAmount;
        
        emit VestingScheduleCreated(
            scheduleId,
            beneficiary,
            token,
            totalAmount,
            startTime,
            cliff,
            duration,
            description
        );
        
        return scheduleId;
    }
    
    function release(bytes32 scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(schedule.beneficiary == msg.sender, "Only beneficiary can release tokens");
        require(!schedule.revoked, "Vesting schedule has been revoked");
        
        uint256 releasableAmount = _computeReleasableAmount(schedule);
        require(releasableAmount > 0, "No tokens available for release");
        
        schedule.releasedAmount += releasableAmount;
        
        IERC20(schedule.token).transfer(schedule.beneficiary, releasableAmount);
        
        emit TokensReleased(scheduleId, schedule.beneficiary, schedule.token, releasableAmount);
    }
    
    function revoke(bytes32 scheduleId) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(schedule.revocable, "Vesting schedule is not revocable");
        require(!schedule.revoked, "Vesting schedule already revoked");
        
        uint256 releasableAmount = _computeReleasableAmount(schedule);
        uint256 unreleasedAmount = schedule.totalAmount - schedule.releasedAmount - releasableAmount;
        
        schedule.revoked = true;
        
        // Release any currently releasable amount to beneficiary
        if (releasableAmount > 0) {
            schedule.releasedAmount += releasableAmount;
            IERC20(schedule.token).transfer(schedule.beneficiary, releasableAmount);
            emit TokensReleased(scheduleId, schedule.beneficiary, schedule.token, releasableAmount);
        }
        
        // Return unreleased amount to owner
        if (unreleasedAmount > 0) {
            totalVestedAmount[schedule.token] -= unreleasedAmount;
            IERC20(schedule.token).transfer(owner(), unreleasedAmount);
        }
        
        emit VestingScheduleRevoked(scheduleId, unreleasedAmount);
    }
    
    function _computeReleasableAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount - schedule.releasedAmount;
        } else {
            uint256 timeFromStart = block.timestamp - schedule.startTime;
            uint256 secondsPerSlice = schedule.slicePeriodSeconds;
            uint256 vestedSlicePeriods = timeFromStart / secondsPerSlice;
            uint256 vestedSeconds = vestedSlicePeriods * secondsPerSlice;
            uint256 vestedAmount = (schedule.totalAmount * vestedSeconds) / schedule.duration;
            return vestedAmount - schedule.releasedAmount;
        }
    }
    
    function computeReleasableAmount(bytes32 scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) {
            return 0;
        }
        return _computeReleasableAmount(schedule);
    }
    
    function getVestingSchedule(bytes32 scheduleId) external view returns (VestingSchedule memory) {
        return vestingSchedules[scheduleId];
    }
    
    function getBeneficiarySchedules(address beneficiary) external view returns (bytes32[] memory) {
        return beneficiarySchedules[beneficiary];
    }
    
    function getTokenSchedules(address token) external view returns (bytes32[] memory) {
        return tokenSchedules[token];
    }
    
    function getBeneficiaryScheduleCount(address beneficiary) external view returns (uint256) {
        return beneficiarySchedules[beneficiary].length;
    }
    
    function getTokenScheduleCount(address token) external view returns (uint256) {
        return tokenSchedules[token].length;
    }
    
    function getCurrentTime() external view returns (uint256) {
        return block.timestamp;
    }
    
    function getVestingProgress(bytes32 scheduleId) external view returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 releasableAmount,
        uint256 remainingAmount,
        uint256 progressPercentage
    ) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        
        totalAmount = schedule.totalAmount;
        releasedAmount = schedule.releasedAmount;
        releasableAmount = schedule.revoked ? 0 : _computeReleasableAmount(schedule);
        remainingAmount = totalAmount - releasedAmount - releasableAmount;
        
        if (totalAmount > 0) {
            progressPercentage = ((releasedAmount + releasableAmount) * 10000) / totalAmount; // Basis points
        }
    }
    
    function isVestingActive(bytes32 scheduleId) external view returns (bool) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        return !schedule.revoked && 
               block.timestamp >= schedule.startTime && 
               schedule.releasedAmount < schedule.totalAmount;
    }
    
    function getTimeToNextRelease(bytes32 scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        
        if (schedule.revoked || schedule.releasedAmount >= schedule.totalAmount) {
            return 0;
        }
        
        if (block.timestamp < schedule.startTime + schedule.cliff) {
            return (schedule.startTime + schedule.cliff) - block.timestamp;
        }
        
        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return 0;
        }
        
        uint256 timeFromStart = block.timestamp - schedule.startTime;
        uint256 nextSlicePeriod = ((timeFromStart / schedule.slicePeriodSeconds) + 1) * schedule.slicePeriodSeconds;
        uint256 nextReleaseTime = schedule.startTime + nextSlicePeriod;
        
        return nextReleaseTime > block.timestamp ? nextReleaseTime - block.timestamp : 0;
    }
    
    // Emergency function to recover tokens (only non-vested tokens)
    function recoverToken(address token, uint256 amount) external onlyOwner {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 vestedAmount = totalVestedAmount[token];
        
        require(contractBalance >= vestedAmount + amount, "Cannot recover vested tokens");
        
        IERC20(token).transfer(owner(), amount);
    }
}