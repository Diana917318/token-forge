import { run } from "hardhat";
import deploymentInfo from "../deployment-addresses.json";

async function verifyContracts() {
  console.log("Starting contract verification...");
  
  if (!deploymentInfo.contracts) {
    console.error("No deployment info found. Please run deploy script first.");
    return;
  }

  const { TokenFactory, LiquidityLocker, VestingContract } = deploymentInfo.contracts;
  const deployer = deploymentInfo.deployer;

  try {
    // Verify TokenFactory
    console.log("Verifying TokenFactory at:", TokenFactory);
    await run("verify:verify", {
      address: TokenFactory,
      constructorArguments: [deployer, deployer],
    });
    console.log("✅ TokenFactory verified");

    // Verify LiquidityLocker
    console.log("Verifying LiquidityLocker at:", LiquidityLocker);
    await run("verify:verify", {
      address: LiquidityLocker,
      constructorArguments: [deployer, deployer],
    });
    console.log("✅ LiquidityLocker verified");

    // Verify VestingContract
    console.log("Verifying VestingContract at:", VestingContract);
    await run("verify:verify", {
      address: VestingContract,
      constructorArguments: [deployer],
    });
    console.log("✅ VestingContract verified");

    console.log("\n🎉 All contracts verified successfully!");

  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

verifyContracts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });