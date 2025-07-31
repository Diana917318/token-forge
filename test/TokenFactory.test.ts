import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenFactory, BaseERC20, AdvancedERC20, BEP20Token, LiquidityLocker, VestingContract } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TokenFactory", function () {
  let tokenFactory: TokenFactory;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeReceiver: SignerWithAddress;

  const CREATION_FEE = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, user1, user2, feeReceiver] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = await TokenFactory.deploy(owner.address, feeReceiver.address);
    await tokenFactory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner and fee receiver", async function () {
      expect(await tokenFactory.owner()).to.equal(owner.address);
      expect(await tokenFactory.feeReceiver()).to.equal(feeReceiver.address);
    });

    it("Should deploy liquidity locker and vesting contract", async function () {
      const liquidityLockerAddress = await tokenFactory.getLiquidityLocker();
      const vestingContractAddress = await tokenFactory.getVestingContract();
      
      expect(liquidityLockerAddress).to.not.equal(ethers.ZeroAddress);
      expect(vestingContractAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set default creation fee", async function () {
      expect(await tokenFactory.creationFee()).to.equal(CREATION_FEE);
    });
  });

  describe("BaseERC20 Token Creation", function () {
    it("Should create a BaseERC20 token successfully", async function () {
      const initialBalance = await feeReceiver.provider!.getBalance(feeReceiver.address);

      const tx = await tokenFactory.connect(user1).createBaseERC20(
        "Test Token",
        "TEST",
        18,
        1000000,
        2000000,
        user1.address,
        500, // 5% buy tax
        600, // 6% sell tax
        100, // 1% transfer tax
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          return tokenFactory.interface.parseLog(log as any)?.name === "TokenCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const finalBalance = await feeReceiver.provider!.getBalance(feeReceiver.address);
      expect(finalBalance - initialBalance).to.equal(CREATION_FEE);

      expect(await tokenFactory.getTokenCount()).to.equal(1);
      expect(await tokenFactory.getCreatorTokenCount(user1.address)).to.equal(1);
    });

    it("Should revert if insufficient fee is provided", async function () {
      await expect(
        tokenFactory.connect(user1).createBaseERC20(
          "Test Token",
          "TEST",
          18,
          1000000,
          2000000,
          user1.address,
          500,
          600,
          100,
          { value: ethers.parseEther("0.005") }
        )
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should revert if name or symbol is empty", async function () {
      await expect(
        tokenFactory.connect(user1).createBaseERC20(
          "",
          "TEST",
          18,
          1000000,
          2000000,
          user1.address,
          500,
          600,
          100,
          { value: CREATION_FEE }
        )
      ).to.be.revertedWith("Name and symbol required");
    });
  });

  describe("AdvancedERC20 Token Creation", function () {
    it("Should create an AdvancedERC20 token successfully", async function () {
      const tx = await tokenFactory.connect(user1).createAdvancedERC20(
        "Advanced Token",
        "ADV",
        18,
        1000000,
        2000000,
        user1.address,
        500,
        600,
        100,
        ethers.ZeroAddress, // No DEX router for test
        false, // No auto liquidity
        1000,
        ethers.parseEther("1000000"), // Max wallet
        ethers.parseEther("100000"), // Max transaction
        { value: CREATION_FEE }
      );

      await expect(tx).to.emit(tokenFactory, "TokenCreated");
      expect(await tokenFactory.getTokenCount()).to.equal(1);
    });
  });

  describe("BEP20 Token Creation", function () {
    it("Should create a BEP20 token successfully", async function () {
      const tx = await tokenFactory.connect(user1).createBEP20Token(
        "BEP20 Token",
        "BEP",
        18,
        1000000,
        2000000,
        user1.address,
        user1.address,
        user1.address,
        500,
        600,
        100,
        ethers.ZeroAddress, // No PancakeSwap router for test
        { value: CREATION_FEE }
      );

      await expect(tx).to.emit(tokenFactory, "TokenCreated");
      expect(await tokenFactory.getTokenCount()).to.equal(1);
    });
  });

  describe("Token Management", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await tokenFactory.connect(user1).createBaseERC20(
        "Test Token",
        "TEST",
        18,
        1000000,
        2000000,
        user1.address,
        500,
        600,
        100,
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          const parsedLog = tokenFactory.interface.parseLog(log as any);
          return parsedLog?.name === "TokenCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = tokenFactory.interface.parseLog(event as any);
      tokenAddress = parsedEvent?.args[0];
    });

    it("Should return correct token info", async function () {
      const tokenInfo = await tokenFactory.getTokenInfo(tokenAddress);
      expect(tokenInfo.creator).to.equal(user1.address);
      expect(tokenInfo.tokenType).to.equal("BaseERC20");
      expect(tokenInfo.name).to.equal("Test Token");
      expect(tokenInfo.symbol).to.equal("TEST");
    });

    it("Should return creator tokens", async function () {
      const creatorTokens = await tokenFactory.getCreatorTokens(user1.address);
      expect(creatorTokens.length).to.equal(1);
      expect(creatorTokens[0]).to.equal(tokenAddress);
    });

    it("Should return all tokens", async function () {
      const allTokens = await tokenFactory.getAllTokens();
      expect(allTokens.length).to.equal(1);
      expect(allTokens[0]).to.equal(tokenAddress);
    });

    it("Should identify factory-created tokens", async function () {
      expect(await tokenFactory.isTokenCreatedByFactory(tokenAddress)).to.be.true;
      expect(await tokenFactory.isTokenCreatedByFactory(ethers.ZeroAddress)).to.be.false;
    });
  });

  describe("Pagination", function () {
    beforeEach(async function () {
      // Create multiple tokens
      for (let i = 0; i < 5; i++) {
        await tokenFactory.connect(user1).createBaseERC20(
          `Test Token ${i}`,
          `TEST${i}`,
          18,
          1000000,
          2000000,
          user1.address,
          500,
          600,
          100,
          { value: CREATION_FEE }
        );
      }
    });

    it("Should paginate creator tokens correctly", async function () {
      const tokens1 = await tokenFactory.getTokensByCreator(user1.address, 0, 3);
      const tokens2 = await tokenFactory.getTokensByCreator(user1.address, 3, 3);

      expect(tokens1.length).to.equal(3);
      expect(tokens2.length).to.equal(2);
    });

    it("Should paginate all tokens correctly", async function () {
      const tokens1 = await tokenFactory.getAllTokensPaginated(0, 2);
      const tokens2 = await tokenFactory.getAllTokensPaginated(2, 2);
      const tokens3 = await tokenFactory.getAllTokensPaginated(4, 2);

      expect(tokens1.length).to.equal(2);
      expect(tokens2.length).to.equal(2);
      expect(tokens3.length).to.equal(1);
    });

    it("Should handle pagination beyond bounds", async function () {
      const tokens = await tokenFactory.getAllTokensPaginated(10, 5);
      expect(tokens.length).to.equal(0);
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to update creation fee", async function () {
      const newFee = ethers.parseEther("0.02");
      await tokenFactory.connect(owner).setCreationFee(newFee);
      expect(await tokenFactory.creationFee()).to.equal(newFee);
    });

    it("Should not allow non-owner to update creation fee", async function () {
      const newFee = ethers.parseEther("0.02");
      await expect(
        tokenFactory.connect(user1).setCreationFee(newFee)
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update fee receiver", async function () {
      await tokenFactory.connect(owner).setFeeReceiver(user2.address);
      expect(await tokenFactory.feeReceiver()).to.equal(user2.address);
    });

    it("Should not allow setting zero address as fee receiver", async function () {
      await expect(
        tokenFactory.connect(owner).setFeeReceiver(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee receiver");
    });
  });

  describe("Integration with Utility Contracts", function () {
    let tokenAddress: string;
    let token: BaseERC20;

    beforeEach(async function () {
      const tx = await tokenFactory.connect(user1).createBaseERC20(
        "Test Token",
        "TEST",
        18,
        1000000,
        0, // No max supply
        user1.address,
        0, 0, 0, // No taxes
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          const parsedLog = tokenFactory.interface.parseLog(log as any);
          return parsedLog?.name === "TokenCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = tokenFactory.interface.parseLog(event as any);
      tokenAddress = parsedEvent?.args[0];
      
      token = await ethers.getContractAt("BaseERC20", tokenAddress);
    });

    it("Should create vesting schedule for token", async function () {
      const amount = ethers.parseEther("1000");
      
      // First mint some tokens to the creator
      await token.connect(user1).mint(user1.address, amount);
      
      // Approve factory to spend tokens
      await token.connect(user1).approve(tokenFactory.target, amount);
      
      const vestingTx = await tokenFactory.connect(user1).createVestingScheduleForToken(
        tokenAddress,
        user2.address, // beneficiary
        amount,
        0, // start now
        86400, // 1 day cliff
        86400 * 30, // 30 days duration
        86400, // 1 day slice period
        true, // revocable
        "Test vesting"
      );

      await expect(vestingTx).to.not.be.reverted;
    });

    it("Should lock liquidity for token", async function () {
      const amount = ethers.parseEther("1000");
      const lockFee = ethers.parseEther("0.01");
      
      // First mint some tokens to the creator
      await token.connect(user1).mint(user1.address, amount);
      
      // Approve factory to spend tokens
      await token.connect(user1).approve(tokenFactory.target, amount);
      
      const lockTx = await tokenFactory.connect(user1).lockLiquidityForToken(
        tokenAddress,
        amount,
        (await time.latest()) + 86400, // Lock for 1 day from now
        "Test liquidity lock",
        { value: lockFee }
      );

      await expect(lockTx).to.not.be.reverted;
    });

    it("Should not allow non-creator to create vesting or lock liquidity", async function () {
      const amount = ethers.parseEther("1000");
      
      await expect(
        tokenFactory.connect(user2).createVestingScheduleForToken(
          tokenAddress,
          user2.address,
          amount,
          0, 86400, 86400 * 30, 86400,
          true,
          "Test vesting"
        )
      ).to.be.revertedWith("Only token creator can create vesting");

      await expect(
        tokenFactory.connect(user2).lockLiquidityForToken(
          tokenAddress,
          amount,
          Math.floor(Date.now() / 1000) + 86400,
          "Test lock",
          { value: ethers.parseEther("0.01") }
        )
      ).to.be.revertedWith("Only token creator can lock liquidity");
    });
  });
});