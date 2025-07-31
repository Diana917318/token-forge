# TokenForge Smart Contract Platform

A comprehensive web-based token creation platform that enables users to easily launch their own tokens on Ethereum, BSC, and Polygon networks with advanced tokenomics features.

## 🚀 Features

### Smart Contract Templates
- **BaseERC20**: Standard ERC20 token with customizable tax system
- **AdvancedERC20**: Enhanced ERC20 with reflection, auto-liquidity, and advanced tokenomics
- **BEP20Token**: BSC-compatible token with PancakeSwap integration

### Advanced Tokenomics
- ✅ Customizable buy/sell/transfer taxes
- ✅ Automatic liquidity generation
- ✅ Token burning mechanisms
- ✅ Reflection rewards
- ✅ Max wallet and transaction limits
- ✅ Trading controls and blacklisting

### Utility Contracts
- **LiquidityLocker**: Secure liquidity locking with time-based releases
- **VestingContract**: Token vesting schedules with cliff periods
- **TokenFactory**: Unified deployment and management interface

### Multi-Chain Support
- Ethereum Mainnet & Sepolia Testnet
- BSC Mainnet & Testnet
- Polygon Mainnet & Mumbai Testnet

## 📋 Prerequisites

- Node.js 18+ and npm
- Hardhat development environment
- MetaMask or compatible Web3 wallet

## ⚙️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd TokenForge-SmartContract
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your private keys and API keys
```

4. **Compile contracts**
```bash
npm run compile
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npx hardhat test test/TokenFactory.test.ts
```

## 🚀 Deployment

### Deploy to Local Network

1. **Start local hardhat node**
```bash
npm run node
```

2. **Deploy contracts**
```bash
npm run deploy
```

### Deploy to Testnets/Mainnets

```bash
# Sepolia testnet
npm run deploy:sepolia

# BSC testnet
npm run deploy:bsc-testnet

# BSC mainnet
npm run deploy:bsc

# Polygon mainnet
npm run deploy:polygon
```

### Verify Contracts

After deployment, verify contracts on block explorers:

```bash
npm run verify
```

## 📖 Usage Examples

### Create a Basic Token

```bash
# Deploy a base ERC20 token
npx hardhat run scripts/deploy-token.ts --network sepolia -- base
```

### Using the SDK in Frontend

```typescript
import { tokenForgeSDK, TokenConfig } from './utils/web3-integration';

// Connect to wallet
await tokenForgeSDK.connect(window.ethereum);

// Create a token
const config: TokenConfig = {
  name: "My Token",
  symbol: "MTK",
  decimals: 18,
  initialSupply: 1000000,
  maxSupply: 2000000,
  buyTax: 300,  // 3%
  sellTax: 500, // 5%
  transferTax: 100 // 1%
};

const tokenAddress = await tokenForgeSDK.createBaseToken(config);
console.log("Token deployed at:", tokenAddress);
```

## 📁 Project Structure

```
TokenForge-SmartContract/
├── contracts/
│   ├── tokens/
│   │   ├── BaseERC20.sol          # Standard ERC20 with taxes
│   │   ├── AdvancedERC20.sol      # Advanced tokenomics
│   │   └── BEP20Token.sol         # BSC-compatible token
│   ├── LiquidityLocker.sol        # Liquidity locking utility
│   ├── VestingContract.sol        # Token vesting utility
│   └── TokenFactory.sol           # Main factory contract
├── scripts/
│   ├── deploy.ts                  # Main deployment script
│   ├── deploy-token.ts            # Token deployment utility
│   └── verify.ts                  # Contract verification
├── test/                          # Comprehensive test suite
├── utils/
│   └── web3-integration.ts        # Frontend SDK
└── hardhat.config.ts              # Hardhat configuration
```

## 🔧 Configuration

### Network Configuration

The project supports multiple networks configured in `hardhat.config.ts`:

- **Ethereum**: Mainnet and Sepolia testnet
- **BSC**: Mainnet and testnet
- **Polygon**: Mainnet and Mumbai testnet

### Environment Variables

Required environment variables in `.env`:

```bash
PRIVATE_KEY=your_private_key_here
MAINNET_RPC_URL=https://mainnet.infura.io/v3/your_project_id
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## 🛡️ Security Features

- **Reentrancy Protection**: All state-changing functions protected
- **Access Control**: Owner-only administrative functions
- **Tax Limits**: Maximum tax rates to prevent honey pots
- **Emergency Functions**: Owner can pause trading and rescue tokens
- **Blacklist Support**: Prevent malicious addresses from trading

## 💡 Token Types

### BaseERC20
- Standard ERC20 functionality
- Customizable tax system
- Minting/burning capabilities
- Trading controls

### AdvancedERC20
- All BaseERC20 features
- Auto-liquidity generation
- Reflection rewards system
- Advanced DEX integration
- Wallet and transaction limits

### BEP20Token
- BSC-specific optimizations
- PancakeSwap integration
- Multiple fee wallets (marketing, liquidity)
- Gas-efficient operations

## 🔄 Utility Contracts

### LiquidityLocker
- Time-locked liquidity protection
- Transferable lock ownership
- Emergency unlock capabilities
- Multi-token support

### VestingContract
- Linear vesting schedules
- Cliff periods
- Revocable schedules
- Multi-beneficiary support

## 📊 Gas Optimization

- Optimized for minimal gas usage
- Efficient storage patterns
- Batch operations support
- Network-specific optimizations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

This software is provided as-is for educational and development purposes. Always audit smart contracts before deploying to mainnet. The developers are not responsible for any losses incurred through the use of this software.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing GitHub issues
3. Create a new issue with detailed information

## 🗺️ Roadmap

- [ ] AI-powered tokenomics suggestions
- [ ] Advanced governance features
- [ ] Cross-chain deployment
- [ ] Enhanced DeFi integrations
- [ ] Mobile SDK
- [ ] Audit and security enhancements