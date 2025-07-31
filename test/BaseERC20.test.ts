import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BaseERC20", function () {
  let token: BaseERC20;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let taxWallet: SignerWithAddress;

  const NAME = "Test Token";
  const SYMBOL = "TEST";
  const DECIMALS = 18;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const MAX_SUPPLY = ethers.parseEther("2000000");
  const INITIAL_SUPPLY_RAW = 1000000;
  const MAX_SUPPLY_RAW = 2000000;

  beforeEach(async function () {
    [owner, user1, user2, taxWallet] = await ethers.getSigners();

    const BaseERC20 = await ethers.getContractFactory("BaseERC20");
    token = await BaseERC20.deploy(
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY_RAW, // Initial supply (before decimals)
      MAX_SUPPLY_RAW, // Max supply (before decimals) 
      owner.address,
      taxWallet.address,
      500, // 5% buy tax
      600, // 6% sell tax
      100  // 1% transfer tax
    );
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct token parameters", async function () {
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
      expect(await token.decimals()).to.equal(DECIMALS);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should set the correct owner and tax wallet", async function () {
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.taxWallet()).to.equal(taxWallet.address);
    });

    it("Should set the correct tax rates", async function () {
      expect(await token.buyTaxRate()).to.equal(500);
      expect(await token.sellTaxRate()).to.equal(600);
      expect(await token.transferTaxRate()).to.equal(100);
    });

    it("Should mint initial supply to owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should exclude owner and contracts from fees", async function () {
      expect(await token.excludedFromFees(owner.address)).to.be.true;
      expect(await token.excludedFromFees(await token.getAddress())).to.be.true;
      expect(await token.excludedFromFees(taxWallet.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("100000");
      await token.connect(owner).mint(user1.address, mintAmount);
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow minting beyond max supply", async function () {
      const mintAmount = ethers.parseEther("1000001"); // Exceeds remaining supply
      await expect(
        token.connect(owner).mint(user1.address, mintAmount)
      ).to.be.revertedWith("Would exceed max supply");
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        token.connect(user1).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow minting after finishing", async function () {
      await token.connect(owner).finishMinting();
      await expect(
        token.connect(owner).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Minting is finished");
    });
  });

  describe("Tax System", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for testing
      await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
    });

    it("Should apply transfer tax on regular transfers", async function () {
      const transferAmount = ethers.parseEther("1000");
      const expectedTax = transferAmount * BigInt(100) / BigInt(10000); // 1%
      const expectedReceived = transferAmount - expectedTax;

      const initialTaxWalletBalance = await token.balanceOf(taxWallet.address);
      
      await token.connect(user1).transfer(user2.address, transferAmount);

      expect(await token.balanceOf(user2.address)).to.equal(expectedReceived);
      expect(await token.balanceOf(taxWallet.address)).to.equal(initialTaxWalletBalance + expectedTax);
    });

    it("Should not apply tax for excluded addresses", async function () {
      const transferAmount = ethers.parseEther("1000");
      
      await token.connect(owner).transfer(user2.address, transferAmount);
      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should allow owner to update tax rates", async function () {
      await token.connect(owner).updateTaxRates(300, 400, 200);
      expect(await token.buyTaxRate()).to.equal(300);
      expect(await token.sellTaxRate()).to.equal(400);
      expect(await token.transferTaxRate()).to.equal(200);
    });

    it("Should not allow tax rates above maximum", async function () {
      await expect(
        token.connect(owner).updateTaxRates(1001, 400, 200)
      ).to.be.revertedWith("Tax rate too high");
    });

    it("Should allow owner to exclude/include addresses from fees", async function () {
      await token.connect(owner).excludeFromFees(user1.address, true);
      expect(await token.excludedFromFees(user1.address)).to.be.true;

      await token.connect(owner).excludeFromFees(user1.address, false);
      expect(await token.excludedFromFees(user1.address)).to.be.false;
    });
  });

  describe("Trading Control", function () {
    beforeEach(async function () {
      await token.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow owner to disable trading", async function () {
      await token.connect(owner).setTradingEnabled(false);
      expect(await token.tradingEnabled()).to.be.false;

      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Trading is disabled");
    });

    it("Should allow excluded addresses to trade when trading is disabled", async function () {
      await token.connect(owner).setTradingEnabled(false);
      await token.connect(owner).excludeFromFees(user1.address, true);

      await token.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should allow owner to blacklist addresses", async function () {
      await token.connect(owner).setBlacklisted(user1.address, true);
      expect(await token.blacklisted(user1.address)).to.be.true;

      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Address is blacklisted");
    });

    it("Should not allow blacklisting the owner", async function () {
      await expect(
        token.connect(owner).setBlacklisted(owner.address, true)
      ).to.be.revertedWith("Cannot blacklist owner");
    });
  });

  describe("Tax Wallet Management", function () {
    it("Should allow owner to update tax wallet", async function () {
      await token.connect(owner).updateTaxWallet(user1.address);
      expect(await token.taxWallet()).to.equal(user1.address);
      expect(await token.excludedFromFees(user1.address)).to.be.true;
    });

    it("Should not allow setting zero address as tax wallet", async function () {
      await expect(
        token.connect(owner).updateTaxWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Tax wallet cannot be zero address");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to rescue accidentally sent tokens", async function () {
      // Deploy another token to simulate accidentally sent tokens
      const TestToken = await ethers.getContractFactory("BaseERC20");
      const testToken = await TestToken.deploy(
        "Other Token", "OTHER", 18, 1000, 0,
        owner.address, owner.address, 0, 0, 0
      );
      
      // Send some tokens to the main contract
      await testToken.connect(owner).transfer(await token.getAddress(), ethers.parseEther("100"));
      
      // Rescue them
      await token.connect(owner).rescueTokens(await testToken.getAddress(), ethers.parseEther("100"));
      
      expect(await testToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1000")); // Back to original amount
    });

    it("Should not allow rescuing own tokens", async function () {
      await expect(
        token.connect(owner).rescueTokens(await token.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("Cannot rescue own tokens");
    });

    it("Should allow rescuing ETH", async function () {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await owner.provider!.getBalance(owner.address);
      
      await token.connect(owner).rescueTokens(ethers.ZeroAddress, ethers.parseEther("1"));
      
      // Note: We can't check exact balance due to gas costs
      const finalBalance = await owner.provider!.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow token holders to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialSupply = await token.totalSupply();
      
      await token.connect(user1).burn(burnAmount);
      
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });

    it("Should allow burning tokens from another account with allowance", async function () {
      const burnAmount = ethers.parseEther("100");
      
      await token.connect(user1).approve(user2.address, burnAmount);
      await token.connect(user2).burnFrom(user1.address, burnAmount);
      
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount transfers", async function () {
      await token.connect(owner).transfer(user1.address, 0);
      expect(await token.balanceOf(user1.address)).to.equal(0);
    });

    it("Should handle deployment with zero max supply", async function () {
      const TestToken = await ethers.getContractFactory("BaseERC20");
      const testToken = await TestToken.deploy(
        "Test", "TEST", 18, 1000, 0, // Zero max supply
        owner.address, owner.address, 0, 0, 0
      );
      
      expect(await testToken.maxSupply()).to.equal(0);
      
      // Should be able to mint without limit
      await testToken.connect(owner).mint(user1.address, ethers.parseEther("999999999"));
      expect(await testToken.balanceOf(user1.address)).to.equal(ethers.parseEther("999999999"));
    });

    it("Should revert on invalid constructor parameters", async function () {
      const TestToken = await ethers.getContractFactory("BaseERC20");
      
      // Test zero owner
      await expect(
        TestToken.deploy("Test", "TEST", 18, 1000, 2000, ethers.ZeroAddress, owner.address, 0, 0, 0)
      ).to.be.revertedWithCustomError(TestToken, "OwnableInvalidOwner");
      
      // Test initial supply > max supply
      await expect(
        TestToken.deploy("Test", "TEST", 18, 2001, 2000, owner.address, owner.address, 0, 0, 0)
      ).to.be.revertedWith("Initial supply exceeds max supply");
      
      // Test tax rate too high
      await expect(
        TestToken.deploy("Test", "TEST", 18, 1000, 2000, owner.address, owner.address, 1001, 0, 0)
      ).to.be.revertedWith("Tax rate too high");
    });
  });
});