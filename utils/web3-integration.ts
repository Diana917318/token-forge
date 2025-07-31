import { ethers, Contract, BrowserProvider, JsonRpcSigner } from 'ethers';

// Contract ABIs (simplified for key functions)
export const TOKEN_FACTORY_ABI = [
  "function createBaseERC20(string name, string symbol, uint8 decimals, uint256 initialSupply, uint256 maxSupply, address taxWallet, uint256 buyTax, uint256 sellTax, uint256 transferTax) external payable returns (address)",
  "function createAdvancedERC20(string name, string symbol, uint8 decimals, uint256 initialSupply, uint256 maxSupply, address taxWallet, uint256 buyTax, uint256 sellTax, uint256 transferTax, address dexRouter, bool autoLiquidity, uint256 liquidityThreshold, uint256 maxWallet, uint256 maxTransaction) external payable returns (address)",
  "function createBEP20Token(string name, string symbol, uint8 decimals, uint256 initialSupply, uint256 maxSupply, address taxWallet, address marketingWallet, address liquidityWallet, uint256 buyTax, uint256 sellTax, uint256 transferTax, address pancakeRouter) external payable returns (address)",
  "function getTokenInfo(address tokenAddress) external view returns (tuple(address tokenAddress, address creator, uint256 createdAt, string tokenType, string name, string symbol))",
  "function getCreatorTokens(address creator) external view returns (address[])",
  "function getAllTokens() external view returns (address[])",
  "function getTokenCount() external view returns (uint256)",
  "function creationFee() external view returns (uint256)",
  "function lockLiquidityForToken(address token, uint256 amount, uint256 unlockTime, string description) external payable returns (uint256)",
  "function createVestingScheduleForToken(address token, address beneficiary, uint256 totalAmount, uint256 startTime, uint256 cliff, uint256 duration, uint256 slicePeriodSeconds, bool revocable, string description) external returns (bytes32)",
  "event TokenCreated(address indexed tokenAddress, address indexed creator, string tokenType, string name, string symbol, uint256 initialSupply)"
];

export const BASE_ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external",
  "function owner() external view returns (address)",
  "function taxWallet() external view returns (address)",
  "function buyTaxRate() external view returns (uint256)",
  "function sellTaxRate() external view returns (uint256)",
  "function transferTaxRate() external view returns (uint256)",
  "function tradingEnabled() external view returns (bool)",
  "function updateTaxRates(uint256 buyTax, uint256 sellTax, uint256 transferTax) external",
  "function setTradingEnabled(bool enabled) external",
  "function excludeFromFees(address account, bool excluded) external"
];

export const LIQUIDITY_LOCKER_ABI = [
  "function lockLiquidity(address token, uint256 amount, uint256 unlockTime, string description) external payable returns (uint256)",
  "function unlockLiquidity(uint256 lockId) external",
  "function extendLock(uint256 lockId, uint256 newUnlockTime) external",
  "function transferLockOwnership(uint256 lockId, address newOwner) external",
  "function getLockInfo(uint256 lockId) external view returns (tuple(address token, address owner, uint256 amount, uint256 lockTime, uint256 unlockTime, bool claimed, string description))",
  "function getUserLocks(address user) external view returns (uint256[])",
  "function getTokenLocks(address token) external view returns (uint256[])",
  "function isLockExpired(uint256 lockId) external view returns (bool)",
  "function getTimeToUnlock(uint256 lockId) external view returns (uint256)",
  "function lockFee() external view returns (uint256)"
];

export const VESTING_CONTRACT_ABI = [
  "function createVestingSchedule(address beneficiary, address token, uint256 totalAmount, uint256 startTime, uint256 cliff, uint256 duration, uint256 slicePeriodSeconds, bool revocable, string description) external returns (bytes32)",
  "function release(bytes32 scheduleId) external",
  "function revoke(bytes32 scheduleId) external",
  "function computeReleasableAmount(bytes32 scheduleId) external view returns (uint256)",
  "function getVestingSchedule(bytes32 scheduleId) external view returns (tuple(address beneficiary, address token, uint256 totalAmount, uint256 releasedAmount, uint256 startTime, uint256 cliff, uint256 duration, uint256 slicePeriodSeconds, bool revocable, bool revoked, string description))",
  "function getBeneficiarySchedules(address beneficiary) external view returns (bytes32[])",
  "function getVestingProgress(bytes32 scheduleId) external view returns (uint256 totalAmount, uint256 releasedAmount, uint256 releasableAmount, uint256 remainingAmount, uint256 progressPercentage)"
];

// Network configurations
export const NETWORKS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  },
  bscTestnet: {
    chainId: 97,
    name: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com/',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  }
};

// Contract addresses (to be updated after deployment)
export const CONTRACT_ADDRESSES = {
  ethereum: {
    tokenFactory: '',
    liquidityLocker: '',
    vestingContract: ''
  },
  sepolia: {
    tokenFactory: '',
    liquidityLocker: '',
    vestingContract: ''
  },
  bsc: {
    tokenFactory: '',
    liquidityLocker: '',
    vestingContract: ''
  },
  bscTestnet: {
    tokenFactory: '',
    liquidityLocker: '',
    vestingContract: ''
  },
  polygon: {
    tokenFactory: '',
    liquidityLocker: '',
    vestingContract: ''
  }
};

export interface TokenConfig {
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

export class TokenForgeSDK {
  private provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private tokenFactory: Contract | null = null;
  private liquidityLocker: Contract | null = null;
  private vestingContract: Contract | null = null;
  private networkName: string = '';

  constructor() {}

  async connect(windowEthereum: any): Promise<boolean> {
    try {
      if (!windowEthereum) {
        throw new Error('MetaMask is not installed');
      }

      this.provider = new BrowserProvider(windowEthereum);
      await this.provider.send("eth_requestAccounts", []);
      this.signer = await this.provider.getSigner();

      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Find network name by chainId
      this.networkName = Object.keys(NETWORKS).find(
        key => NETWORKS[key as keyof typeof NETWORKS].chainId === chainId
      ) || 'unknown';

      if (this.networkName === 'unknown') {
        throw new Error(`Unsupported network with chainId: ${chainId}`);
      }

      // Initialize contracts
      const addresses = CONTRACT_ADDRESSES[this.networkName as keyof typeof CONTRACT_ADDRESSES];
      
      if (addresses.tokenFactory) {
        this.tokenFactory = new Contract(addresses.tokenFactory, TOKEN_FACTORY_ABI, this.signer);
      }
      if (addresses.liquidityLocker) {
        this.liquidityLocker = new Contract(addresses.liquidityLocker, LIQUIDITY_LOCKER_ABI, this.signer);
      }
      if (addresses.vestingContract) {
        this.vestingContract = new Contract(addresses.vestingContract, VESTING_CONTRACT_ABI, this.signer);
      }

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }

  async switchNetwork(networkName: keyof typeof NETWORKS): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Not connected to wallet');
    }

    const network = NETWORKS[networkName];
    
    try {
      await this.provider.send('wallet_switchEthereumChain', [
        { chainId: '0x' + network.chainId.toString(16) }
      ]);
      
      // Reinitialize after network switch
      await this.connect((window as any).ethereum);
      return true;
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added, try to add it
        try {
          await this.provider.send('wallet_addEthereumChain', [{
            chainId: '0x' + network.chainId.toString(16),
            chainName: network.name,
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: [network.blockExplorer],
            nativeCurrency: network.nativeCurrency
          }]);
          return true;
        } catch (addError) {
          console.error('Failed to add network:', addError);
          return false;
        }
      }
      console.error('Failed to switch network:', error);
      return false;
    }
  }

  async getCreationFee(): Promise<string> {
    if (!this.tokenFactory) {
      throw new Error('TokenFactory not initialized');
    }
    const fee = await this.tokenFactory.creationFee();
    return ethers.formatEther(fee);
  }

  async createBaseToken(config: TokenConfig): Promise<string> {
    if (!this.tokenFactory || !this.signer) {
      throw new Error('Not connected or TokenFactory not initialized');
    }

    const creationFee = await this.tokenFactory.creationFee();
    
    const tx = await this.tokenFactory.createBaseERC20(
      config.name,
      config.symbol,
      config.decimals,
      config.initialSupply,
      config.maxSupply,
      config.taxWallet || await this.signer.getAddress(),
      config.buyTax,
      config.sellTax,
      config.transferTax,
      { value: creationFee }
    );

    const receipt = await tx.wait();
    
    // Find TokenCreated event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.tokenFactory!.interface.parseLog(log);
        return parsed?.name === 'TokenCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = this.tokenFactory.interface.parseLog(event);
      return parsed?.args[0]; // Token address
    }
    
    throw new Error('Token creation event not found');
  }

  async createAdvancedToken(config: TokenConfig): Promise<string> {
    if (!this.tokenFactory || !this.signer) {
      throw new Error('Not connected or TokenFactory not initialized');
    }

    const creationFee = await this.tokenFactory.creationFee();
    
    const tx = await this.tokenFactory.createAdvancedERC20(
      config.name,
      config.symbol,
      config.decimals,
      config.initialSupply,
      config.maxSupply,
      config.taxWallet || await this.signer.getAddress(),
      config.buyTax,
      config.sellTax,
      config.transferTax,
      config.dexRouter || ethers.ZeroAddress,
      config.autoLiquidity || false,
      ethers.parseEther(config.liquidityThreshold || '1000'),
      ethers.parseEther(config.maxWallet || '1000000'),
      ethers.parseEther(config.maxTransaction || '100000'),
      { value: creationFee }
    );

    const receipt = await tx.wait();
    
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.tokenFactory!.interface.parseLog(log);
        return parsed?.name === 'TokenCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = this.tokenFactory.interface.parseLog(event);
      return parsed?.args[0];
    }
    
    throw new Error('Token creation event not found');
  }

  async createBEP20Token(config: TokenConfig): Promise<string> {
    if (!this.tokenFactory || !this.signer) {
      throw new Error('Not connected or TokenFactory not initialized');
    }

    const creationFee = await this.tokenFactory.creationFee();
    const signerAddress = await this.signer.getAddress();
    
    const tx = await this.tokenFactory.createBEP20Token(
      config.name,
      config.symbol,
      config.decimals,
      config.initialSupply,
      config.maxSupply,
      config.taxWallet || signerAddress,
      config.marketingWallet || signerAddress,
      config.liquidityWallet || signerAddress,
      config.buyTax,
      config.sellTax,
      config.transferTax,
      config.pancakeRouter || ethers.ZeroAddress,
      { value: creationFee }
    );

    const receipt = await tx.wait();
    
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.tokenFactory!.interface.parseLog(log);
        return parsed?.name === 'TokenCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = this.tokenFactory.interface.parseLog(event);
      return parsed?.args[0];
    }
    
    throw new Error('Token creation event not found');
  }

  async getTokenInfo(tokenAddress: string) {
    if (!this.tokenFactory) {
      throw new Error('TokenFactory not initialized');
    }
    return await this.tokenFactory.getTokenInfo(tokenAddress);
  }

  async getUserTokens(userAddress?: string): Promise<string[]> {
    if (!this.tokenFactory) {
      throw new Error('TokenFactory not initialized');
    }
    
    const address = userAddress || await this.signer?.getAddress();
    if (!address) {
      throw new Error('No user address available');
    }
    
    return await this.tokenFactory.getCreatorTokens(address);
  }

  async getTokenContract(tokenAddress: string): Promise<Contract> {
    if (!this.signer) {
      throw new Error('Not connected to wallet');
    }
    return new Contract(tokenAddress, BASE_ERC20_ABI, this.signer);
  }

  async lockLiquidity(
    tokenAddress: string,
    amount: string,
    unlockTimeSeconds: number,
    description: string
  ): Promise<number> {
    if (!this.tokenFactory) {
      throw new Error('TokenFactory not initialized');
    }

    const lockFee = await this.liquidityLocker?.lockFee() || ethers.parseEther('0.01');
    
    const tx = await this.tokenFactory.lockLiquidityForToken(
      tokenAddress,
      ethers.parseEther(amount),
      unlockTimeSeconds,
      description,
      { value: lockFee }
    );

    const receipt = await tx.wait();
    
    // Parse logs for lock ID
    // This would need to be implemented based on the specific event structure
    return 1; // Placeholder
  }

  async createVestingSchedule(
    tokenAddress: string,
    beneficiary: string,
    totalAmount: string,
    startTime: number,
    cliffDuration: number,
    vestingDuration: number,
    slicePeriod: number,
    revocable: boolean,
    description: string
  ): Promise<string> {
    if (!this.tokenFactory) {
      throw new Error('TokenFactory not initialized');
    }

    const tx = await this.tokenFactory.createVestingScheduleForToken(
      tokenAddress,
      beneficiary,
      ethers.parseEther(totalAmount),
      startTime,
      cliffDuration,
      vestingDuration,
      slicePeriod,
      revocable,
      description
    );

    const receipt = await tx.wait();
    
    // Return schedule ID from events
    // This would need to be implemented based on the specific event structure
    return '0x' + '0'.repeat(64); // Placeholder
  }

  getNetworkInfo() {
    return {
      name: this.networkName,
      config: NETWORKS[this.networkName as keyof typeof NETWORKS]
    };
  }

  isConnected(): boolean {
    return !!this.signer;
  }

  async getAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error('Not connected to wallet');
    }
    return await this.signer.getAddress();
  }

  async getBalance(): Promise<string> {
    if (!this.signer || !this.provider) {
      throw new Error('Not connected to wallet');
    }
    const address = await this.signer.getAddress();
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }
}

// Helper functions for frontend integration
export const formatTokenAmount = (amount: bigint, decimals: number): string => {
  return ethers.formatUnits(amount, decimals);
};

export const parseTokenAmount = (amount: string, decimals: number): bigint => {
  return ethers.parseUnits(amount, decimals);
};

export const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getBlockExplorerUrl = (networkName: string, address: string, type: 'address' | 'tx' = 'address'): string => {
  const network = NETWORKS[networkName as keyof typeof NETWORKS];
  if (!network) return '';
  
  return `${network.blockExplorer}/${type}/${address}`;
};

// Export singleton instance
export const tokenForgeSDK = new TokenForgeSDK();