import { ethers } from "hardhat";
import { TokenFactory } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy TokenFactory (which also deploys LiquidityLocker and VestingContract)
  console.log("\nDeploying TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactory.deploy(deployer.address, deployer.address);
  
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  
  console.log("TokenFactory deployed to:", tokenFactoryAddress);
  
  // Get the deployed utility contract addresses
  const liquidityLockerAddress = await tokenFactory.getLiquidityLocker();
  const vestingContractAddress = await tokenFactory.getVestingContract();
  
  console.log("LiquidityLocker deployed to:", liquidityLockerAddress);
  console.log("VestingContract deployed to:", vestingContractAddress);
  
  // Get creation fee
  const creationFee = await tokenFactory.creationFee();
  console.log("Token creation fee:", ethers.formatEther(creationFee), "ETH");

  console.log("\nDeployment completed successfully!");
  console.log("\nContract addresses:");
  console.log("==================");
  console.log(`TokenFactory: ${tokenFactoryAddress}`);
  console.log(`LiquidityLocker: ${liquidityLockerAddress}`);
  console.log(`VestingContract: ${vestingContractAddress}`);
  
  console.log("\nDeployment summary saved to deployment-addresses.json");
  
  // Save deployment addresses to file
  const fs = require('fs');
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TokenFactory: tokenFactoryAddress,
      LiquidityLocker: liquidityLockerAddress,
      VestingContract: vestingContractAddress
    },
    settings: {
      creationFee: ethers.formatEther(creationFee)
    }
  };
  
  fs.writeFileSync('deployment-addresses.json', JSON.stringify(deploymentInfo, null, 2));
  
  // Verify contracts if on a testnet/mainnet
  const networkName = (await ethers.provider.getNetwork()).name;
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\nWaiting 60 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    try {
      console.log("Verifying TokenFactory...");
      await run("verify:verify", {
        address: tokenFactoryAddress,
        constructorArguments: [deployer.address, deployer.address],
      });
      
      console.log("Verifying LiquidityLocker...");
      await run("verify:verify", {
        address: liquidityLockerAddress,
        constructorArguments: [deployer.address, deployer.address],
      });
      
      console.log("Verifying VestingContract...");
      await run("verify:verify", {
        address: vestingContractAddress,
        constructorArguments: [deployer.address],
      });
      
      console.log("All contracts verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
}

// Function to deploy individual token types for testing
async function deployTestTokens() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\nDeploying test tokens...");
  
  // Deploy BaseERC20
  const BaseERC20 = await ethers.getContractFactory("BaseERC20");
  const baseToken = await BaseERC20.deploy(
    "Base Test Token",
    "BASE",
    18,
    1000000, // 1M initial supply
    2000000, // 2M max supply
    deployer.address,
    deployer.address,
    500, // 5% buy tax
    600, // 6% sell tax
    100  // 1% transfer tax
  );
  await baseToken.waitForDeployment();
  console.log("BaseERC20 test token deployed to:", await baseToken.getAddress());
  
  // Deploy AdvancedERC20
  const AdvancedERC20 = await ethers.getContractFactory("AdvancedERC20");
  const advancedToken = await AdvancedERC20.deploy(
    "Advanced Test Token",
    "ADV",
    18,
    1000000,
    2000000,
    deployer.address,
    deployer.address,
    500, 600, 100,
    ethers.ZeroAddress, // No DEX router
    false, // No auto liquidity
    ethers.parseEther("1000"), // Liquidity threshold
    ethers.parseEther("100000"), // Max wallet
    ethers.parseEther("10000")   // Max transaction
  );
  await advancedToken.waitForDeployment();
  console.log("AdvancedERC20 test token deployed to:", await advancedToken.getAddress());
  
  // Deploy BEP20Token
  const BEP20Token = await ethers.getContractFactory("BEP20Token");
  const bepToken = await BEP20Token.deploy(
    "BEP20 Test Token",
    "BEP",
    18,
    1000000,
    2000000,
    deployer.address,
    deployer.address,
    deployer.address,
    deployer.address,
    500, 600, 100,
    ethers.ZeroAddress // No PancakeSwap router
  );
  await bepToken.waitForDeployment();
  console.log("BEP20Token test token deployed to:", await bepToken.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Export for potential use in other scripts
export { main, deployTestTokens };