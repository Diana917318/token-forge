import { expect } from "chai";
import { ethers } from "hardhat";
import { LiquidityLocker, BaseERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LiquidityLocker", function () {
  let liquidityLocker: LiquidityLocker;
  let testToken: BaseERC20;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeReceiver: SignerWithAddress;

  const LOCK_FEE = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, user1, user2, feeReceiver] = await ethers.getSigners();

    // Deploy LiquidityLocker
    const LiquidityLocker = await ethers.getContractFactory("LiquidityLocker");
    liquidityLocker = await LiquidityLocker.deploy(owner.address, feeReceiver.address);
    await liquidityLocker.waitForDeployment();

    // Deploy test token
    const BaseERC20 = await ethers.getContractFactory("BaseERC20");
    testToken = await BaseERC20.deploy(
      "Test Token",
      "TEST",
      18,
      1000000,
      0, // No max supply
      owner.address,
      owner.address,
      0, 0, 0 // No taxes
    );
    await testToken.waitForDeployment();

    // Transfer some tokens to user1
    await testToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct owner and fee receiver", async function () {
      expect(await liquidityLocker.owner()).to.equal(owner.address);
      expect(await liquidityLocker.feeReceiver()).to.equal(feeReceiver.address);
    });

    it("Should set the default lock fee", async function () {
      expect(await liquidityLocker.lockFee()).to.equal(LOCK_FEE);
    });

    it("Should start with nextLockId as 1", async function () {
      expect(await liquidityLocker.nextLockId()).to.equal(1);
    });
  });

  describe("Locking Liquidity", function () {
    const lockAmount = ethers.parseEther("1000");
    let unlockTime: number;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + 86400; // 1 day from now
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
    });

    it("Should lock liquidity successfully", async function () {
      const initialFeeReceiverBalance = await feeReceiver.provider!.getBalance(feeReceiver.address);
      
      const tx = await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );

      await expect(tx)
        .to.emit(liquidityLocker, "LiquidityLocked")
        .withArgs(1, testToken.target, user1.address, lockAmount, unlockTime, "Test lock");

      // Check token transfer
      expect(await testToken.balanceOf(liquidityLocker.target)).to.equal(lockAmount);
      expect(await testToken.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));

      // Check fee transfer
      const finalFeeReceiverBalance = await feeReceiver.provider!.getBalance(feeReceiver.address);
      expect(finalFeeReceiverBalance - initialFeeReceiverBalance).to.equal(LOCK_FEE);

      // Check lock info
      const lockInfo = await liquidityLocker.getLockInfo(1);
      expect(lockInfo.token).to.equal(testToken.target);
      expect(lockInfo.owner).to.equal(user1.address);
      expect(lockInfo.amount).to.equal(lockAmount);
      expect(lockInfo.unlockTime).to.equal(unlockTime);
      expect(lockInfo.claimed).to.be.false;
      expect(lockInfo.description).to.equal("Test lock");

      // Check mappings
      const userLocks = await liquidityLocker.getUserLocks(user1.address);
      expect(userLocks.length).to.equal(1);
      expect(userLocks[0]).to.equal(1);

      const tokenLocks = await liquidityLocker.getTokenLocks(testToken.target);
      expect(tokenLocks.length).to.equal(1);
      expect(tokenLocks[0]).to.equal(1);
    });

    it("Should revert with insufficient fee", async function () {
      await expect(
        liquidityLocker.connect(user1).lockLiquidity(
          testToken.target,
          lockAmount,
          unlockTime,
          "Test lock",
          { value: ethers.parseEther("0.005") }
        )
      ).to.be.revertedWith("Insufficient fee");
    });

    it("Should revert with invalid parameters", async function () {
      // Invalid token address
      await expect(
        liquidityLocker.connect(user1).lockLiquidity(
          ethers.ZeroAddress,
          lockAmount,
          unlockTime,
          "Test lock",
          { value: LOCK_FEE }
        )
      ).to.be.revertedWith("Invalid token address");

      // Zero amount
      await expect(
        liquidityLocker.connect(user1).lockLiquidity(
          testToken.target,
          0,
          unlockTime,
          "Test lock",
          { value: LOCK_FEE }
        )
      ).to.be.revertedWith("Amount must be greater than 0");

      // Past unlock time
      const pastTime = (await time.latest()) - 3600;
      await expect(
        liquidityLocker.connect(user1).lockLiquidity(
          testToken.target,
          lockAmount,
          pastTime,
          "Test lock",
          { value: LOCK_FEE }
        )
      ).to.be.revertedWith("Unlock time must be in the future");
    });

    it("Should increment lock ID for multiple locks", async function () {
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "First lock",
        { value: LOCK_FEE }
      );

      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime + 3600,
        "Second lock",
        { value: LOCK_FEE }
      );

      expect(await liquidityLocker.nextLockId()).to.equal(3);

      const userLocks = await liquidityLocker.getUserLocks(user1.address);
      expect(userLocks.length).to.equal(2);
      expect(userLocks[0]).to.equal(1);
      expect(userLocks[1]).to.equal(2);
    });
  });

  describe("Unlocking Liquidity", function () {
    const lockAmount = ethers.parseEther("1000");
    let unlockTime: number;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + 86400; // 1 day from now
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );
    });

    it("Should unlock liquidity after lock period expires", async function () {
      // Fast forward time to after unlock time
      await time.increaseTo(unlockTime + 1);

      const tx = await liquidityLocker.connect(user1).unlockLiquidity(1);

      await expect(tx)
        .to.emit(liquidityLocker, "LiquidityUnlocked")
        .withArgs(1, testToken.target, user1.address, lockAmount);

      // Check token transfer back
      expect(await testToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
      expect(await testToken.balanceOf(liquidityLocker.target)).to.equal(0);

      // Check lock is marked as claimed
      const lockInfo = await liquidityLocker.getLockInfo(1);
      expect(lockInfo.claimed).to.be.true;
    });

    it("Should revert if trying to unlock before lock period expires", async function () {
      await expect(
        liquidityLocker.connect(user1).unlockLiquidity(1)
      ).to.be.revertedWith("Lock period not expired");
    });

    it("Should revert if non-owner tries to unlock", async function () {
      await time.increaseTo(unlockTime + 1);

      await expect(
        liquidityLocker.connect(user2).unlockLiquidity(1)
      ).to.be.revertedWith("Not the lock owner");
    });

    it("Should revert if trying to unlock already claimed lock", async function () {
      await time.increaseTo(unlockTime + 1);
      await liquidityLocker.connect(user1).unlockLiquidity(1);

      await expect(
        liquidityLocker.connect(user1).unlockLiquidity(1)
      ).to.be.revertedWith("Already claimed");
    });
  });

  describe("Extending Locks", function () {
    const lockAmount = ethers.parseEther("1000");
    let unlockTime: number;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + 86400;
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );
    });

    it("Should allow lock owner to extend lock", async function () {
      const newUnlockTime = unlockTime + 86400; // Add another day

      const tx = await liquidityLocker.connect(user1).extendLock(1, newUnlockTime);

      await expect(tx)
        .to.emit(liquidityLocker, "LockExtended")
        .withArgs(1, unlockTime, newUnlockTime);

      const lockInfo = await liquidityLocker.getLockInfo(1);
      expect(lockInfo.unlockTime).to.equal(newUnlockTime);
    });

    it("Should revert if new unlock time is not later", async function () {
      await expect(
        liquidityLocker.connect(user1).extendLock(1, unlockTime - 3600)
      ).to.be.revertedWith("New unlock time must be later");
    });

    it("Should revert if non-owner tries to extend", async function () {
      await expect(
        liquidityLocker.connect(user2).extendLock(1, unlockTime + 86400)
      ).to.be.revertedWith("Not the lock owner");
    });

    it("Should revert if trying to extend claimed lock", async function () {
      await time.increaseTo(unlockTime + 1);
      await liquidityLocker.connect(user1).unlockLiquidity(1);

      await expect(
        liquidityLocker.connect(user1).extendLock(1, unlockTime + 86400)
      ).to.be.revertedWith("Lock already claimed");
    });
  });

  describe("Transfer Lock Ownership", function () {
    const lockAmount = ethers.parseEther("1000");
    let unlockTime: number;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + 86400;
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );
    });

    it("Should allow lock owner to transfer ownership", async function () {
      const tx = await liquidityLocker.connect(user1).transferLockOwnership(1, user2.address);

      await expect(tx)
        .to.emit(liquidityLocker, "LockTransferred")
        .withArgs(1, user1.address, user2.address);

      const lockInfo = await liquidityLocker.getLockInfo(1);
      expect(lockInfo.owner).to.equal(user2.address);

      // Check mappings updated
      const user1Locks = await liquidityLocker.getUserLocks(user1.address);
      const user2Locks = await liquidityLocker.getUserLocks(user2.address);
      
      expect(user1Locks.length).to.equal(0);
      expect(user2Locks.length).to.equal(1);
      expect(user2Locks[0]).to.equal(1);
    });

    it("Should revert if transferring to zero address", async function () {
      await expect(
        liquidityLocker.connect(user1).transferLockOwnership(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });

    it("Should revert if non-owner tries to transfer", async function () {
      await expect(
        liquidityLocker.connect(user2).transferLockOwnership(1, user2.address)
      ).to.be.revertedWith("Not the lock owner");
    });
  });

  describe("Admin Functions", function () {
    const lockAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      const unlockTime = (await time.latest()) + 86400;
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );
    });

    it("Should allow owner to emergency unlock", async function () {
      const tx = await liquidityLocker.connect(owner).emergencyUnlock(1);

      await expect(tx)
        .to.emit(liquidityLocker, "LiquidityUnlocked")
        .withArgs(1, testToken.target, user1.address, lockAmount);

      expect(await testToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
    });

    it("Should allow owner to set lock fee", async function () {
      const newFee = ethers.parseEther("0.02");
      
      const tx = await liquidityLocker.connect(owner).setLockFee(newFee);
      
      await expect(tx).to.emit(liquidityLocker, "FeeUpdated").withArgs(newFee);
      expect(await liquidityLocker.lockFee()).to.equal(newFee);
    });

    it("Should allow owner to set fee receiver", async function () {
      const tx = await liquidityLocker.connect(owner).setFeeReceiver(user2.address);
      
      await expect(tx).to.emit(liquidityLocker, "FeeReceiverUpdated").withArgs(user2.address);
      expect(await liquidityLocker.feeReceiver()).to.equal(user2.address);
    });

    it("Should not allow setting zero address as fee receiver", async function () {
      await expect(
        liquidityLocker.connect(owner).setFeeReceiver(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee receiver");
    });
  });

  describe("View Functions", function () {
    const lockAmount = ethers.parseEther("1000");
    let unlockTime: number;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + 86400;
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );
    });

    it("Should return correct lock expiry status", async function () {
      expect(await liquidityLocker.isLockExpired(1)).to.be.false;
      
      await time.increaseTo(unlockTime + 1);
      expect(await liquidityLocker.isLockExpired(1)).to.be.true;
    });

    it("Should return correct time to unlock", async function () {
      const timeToUnlock = await liquidityLocker.getTimeToUnlock(1);
      expect(timeToUnlock).to.be.gt(0);
      
      await time.increaseTo(unlockTime + 1);
      expect(await liquidityLocker.getTimeToUnlock(1)).to.equal(0);
    });

    it("Should return correct user and token lock counts", async function () {
      expect(await liquidityLocker.getUserLockCount(user1.address)).to.equal(1);
      expect(await liquidityLocker.getTokenLockCount(testToken.target)).to.equal(1);
      expect(await liquidityLocker.getUserLockCount(user2.address)).to.equal(0);
    });
  });

  describe("Token Recovery", function () {
    it("Should allow owner to recover accidentally sent tokens", async function () {
      // Deploy another token
      const TestToken = await ethers.getContractFactory("BaseERC20");
      const otherToken = await TestToken.deploy(
        "Other Token", "OTHER", 18, 1000, 0,
        owner.address, owner.address, 0, 0, 0
      );
      
      // Send tokens to locker contract
      await otherToken.connect(owner).transfer(liquidityLocker.target, ethers.parseEther("100"));
      
      // Recover them
      await liquidityLocker.connect(owner).recoverToken(otherToken.target, ethers.parseEther("100"));
      
      expect(await otherToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should not allow recovering locked tokens", async function () {
      const lockAmount = ethers.parseEther("1000");
      const unlockTime = (await time.latest()) + 86400;
      
      await testToken.connect(user1).approve(liquidityLocker.target, lockAmount);
      await liquidityLocker.connect(user1).lockLiquidity(
        testToken.target,
        lockAmount,
        unlockTime,
        "Test lock",
        { value: LOCK_FEE }
      );

      await expect(
        liquidityLocker.connect(owner).recoverToken(testToken.target, lockAmount)
      ).to.be.revertedWith("Cannot recover locked tokens");
    });
  });
});