import { ethers } from "hardhat";
import { TokenFactory } from "../typechain-types";
import deploymentInfo from "../deployment-addresses.json";

interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  maxSupply: number;
  taxWallet?: string;
  marketingWallet?: string;
  liquidityWallet?: string;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  dexRouter?: string;
  pancakeRouter?: string;
  autoLiquidity?: boolean;
  liquidityThreshold?: string;
  maxWallet?: string;
  maxTransaction?: string;
}

async function deployToken(tokenType: "base" | "advanced" | "bep20", config: TokenConfig) {
  const [deployer] = await ethers.getSigners();
  
  if (!deploymentInfo.contracts?.TokenFactory) {
    throw new Error("TokenFactory not deployed. Please run deploy script first.");
  }

  const tokenFactory = await ethers.getContractAt("TokenFactory", deploymentInfo.contracts.TokenFactory) as TokenFactory;
  const creationFee = await tokenFactory.creationFee();

  console.log(`\nDeploying ${tokenType.toUpperCase()} token: ${config.name} (${config.symbol})`);
  console.log("Creation fee:", ethers.formatEther(creationFee), "ETH");

  let tx;
  
  switch (tokenType) {
    case "base":
      tx = await tokenFactory.createBaseERC20(
        config.name,
        config.symbol,
        config.decimals,
        config.initialSupply,
        config.maxSupply,
        config.taxWallet || deployer.address,
        config.buyTax,
        config.sellTax,
        config.transferTax,
        { value: creationFee }
      );
      break;
      
    case "advanced":
      tx = await tokenFactory.createAdvancedERC20(
        config.name,
        config.symbol,
        config.decimals,
        config.initialSupply,
        config.maxSupply,
        config.taxWallet || deployer.address,
        config.buyTax,
        config.sellTax,
        config.transferTax,
        config.dexRouter || ethers.ZeroAddress,
        config.autoLiquidity || false,
        ethers.parseEther(config.liquidityThreshold || "1000"),
        ethers.parseEther(config.maxWallet || "1000000"),
        ethers.parseEther(config.maxTransaction || "100000"),
        { value: creationFee }
      );
      break;
      
    case "bep20":
      tx = await tokenFactory.createBEP20Token(
        config.name,
        config.symbol,
        config.decimals,
        config.initialSupply,
        config.maxSupply,
        config.taxWallet || deployer.address,
        config.marketingWallet || deployer.address,
        config.liquidityWallet || deployer.address,
        config.buyTax,
        config.sellTax,
        config.transferTax,
        config.pancakeRouter || ethers.ZeroAddress,
        { value: creationFee }
      );
      break;
      
    default:
      throw new Error("Invalid token type");
  }

  const receipt = await tx.wait();
  
  // Find the TokenCreated event
  const event = receipt?.logs.find(log => {
    try {
      const parsedLog = tokenFactory.interface.parseLog(log as any);
      return parsedLog?.name === "TokenCreated";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsedEvent = tokenFactory.interface.parseLog(event as any);
    const tokenAddress = parsedEvent?.args[0];
    
    console.log("✅ Token deployed successfully!");
    console.log("Token address:", tokenAddress);
    console.log("Transaction hash:", tx.hash);
    
    // Save token info
    const fs = require('fs');
    const tokenInfo = {
      address: tokenAddress,
      type: tokenType,
      config: config,
      deployer: deployer.address,
      txHash: tx.hash,
      timestamp: new Date().toISOString()
    };
    
    const filename = `deployed-tokens.json`;
    let existingTokens = [];
    
    try {
      existingTokens = JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch {
      // File doesn't exist, start with empty array
    }
    
    existingTokens.push(tokenInfo);
    fs.writeFileSync(filename, JSON.stringify(existingTokens, null, 2));
    
    console.log(`Token info saved to ${filename}`);
    
    return tokenAddress;
  } else {
    throw new Error("Token creation event not found");
  }
}

// Example configurations
const exampleConfigs = {
  base: {
    name: "My Base Token",
    symbol: "MBT",
    decimals: 18,
    initialSupply: 1000000,
    maxSupply: 2000000,
    buyTax: 300,  // 3%
    sellTax: 500, // 5%
    transferTax: 100 // 1%
  },
  
  advanced: {
    name: "My Advanced Token",
    symbol: "MAT",
    decimals: 18,
    initialSupply: 1000000,
    maxSupply: 2000000,
    buyTax: 500,
    sellTax: 800,
    transferTax: 200,
    autoLiquidity: true,
    liquidityThreshold: "1000",
    maxWallet: "50000",
    maxTransaction: "10000"
  },
  
  bep20: {
    name: "My BEP20 Token",
    symbol: "MBP",
    decimals: 18,
    initialSupply: 1000000,
    maxSupply: 2000000,
    buyTax: 400,
    sellTax: 600,
    transferTax: 150
  }
};

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("Usage: npx hardhat run scripts/deploy-token.ts --network <network> -- <tokenType>");
    console.log("Token types: base, advanced, bep20");
    console.log("\nExample configurations:");
    console.log(JSON.stringify(exampleConfigs, null, 2));
    return;
  }
  
  const tokenType = args[0] as "base" | "advanced" | "bep20";
  
  if (!["base", "advanced", "bep20"].includes(tokenType)) {
    console.error("Invalid token type. Use: base, advanced, or bep20");
    return;
  }
  
  // Use example config for demonstration
  const config = exampleConfigs[tokenType];
  
  try {
    await deployToken(tokenType, config);
  } catch (error) {
    console.error("❌ Token deployment failed:", error);
  }
}

// Export for use in other scripts
export { deployToken, exampleConfigs };

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}