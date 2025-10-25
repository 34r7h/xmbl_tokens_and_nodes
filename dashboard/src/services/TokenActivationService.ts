import { ethers } from 'ethers';

export interface ActivationResult {
  success: boolean;
  transactionHash?: string;
  depositId?: string;
  blockNumber?: number;
  gasUsed?: string;
  newTokenCount?: number;
  newXMBLPrice?: string;
  btcDeposited?: string;
  error?: string;
}

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  explorer?: string;
}

export class TokenActivationService {
  private chains: ChainConfig[] = [];
  private oracleAddress: string;
  private depositManagerAddress: string;

  constructor(
    oracleAddress: string,
    depositManagerAddress: string,
    chains: ChainConfig[]
  ) {
    this.oracleAddress = oracleAddress;
    this.depositManagerAddress = depositManagerAddress;
    this.chains = chains;
  }

  /**
   * Get current XMBL price from oracle
   */
  async getCurrentXMBLPrice(): Promise<{ price: string; tokensActivated: number }> {
    try {
      const response = await fetch('/api/oracle/prices');
      const data = await response.json();
      return {
        price: data.xmblPrice || '0.00000001', // 1 satoshi if no tokens activated
        tokensActivated: data.tokensActivated || 0
      };
    } catch (error) {
      console.error('Error fetching XMBL price:', error);
      return { price: '0.00000001', tokensActivated: 0 };
    }
  }

  /**
   * Calculate the cost in chain tokens for the activation
   */
  async calculateActivationCost(amount: string, chainId: number): Promise<string> {
    const { price } = await this.getCurrentXMBLPrice();
    const xmblPriceInBTC = parseFloat(price);
    const amountFloat = parseFloat(amount);
    
    // Calculate BTC equivalent
    const btcEquivalent = xmblPriceInBTC * amountFloat;
    
    // Get BTC price in USD
    const response = await fetch('/api/oracle/prices');
    const data = await response.json();
    const btcPriceUSD = parseFloat(data.btcPrice || '100000');
    
    // Convert to USD
    const usdCost = btcEquivalent * btcPriceUSD;
    
    // For testnet, we'll use a simplified conversion
    // In production, this would use real price feeds
    const chainTokenCost = usdCost * 0.0003; // Approximate ETH cost
    
    return chainTokenCost.toFixed(6);
  }

  /**
   * Activate tokens on the selected chain
   */
  async activateTokens(
    chainId: number,
    amount: string,
    userAddress: string,
    walletProvider: any,
    privateKey?: string
  ): Promise<ActivationResult> {
    try {
      const chain = this.chains.find(c => c.id === chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }

      // Get current price and calculate cost
      const { price: currentPrice, tokensActivated } = await this.getCurrentXMBLPrice();
      const activationCost = await this.calculateActivationCost(amount, chainId);

      console.log(`Activating ${amount} XMBL tokens at price ${currentPrice} BTC per token`);
      console.log(`Activation cost: ${activationCost} ETH`);

      let provider, signer;
      
      if (privateKey) {
        // Use private key for direct signing
        const rpcUrl = chain.rpcUrl;
        provider = new ethers.JsonRpcProvider(rpcUrl);
        signer = new ethers.Wallet(privateKey, provider);
      } else {
        // Use wallet provider
        provider = new ethers.BrowserProvider(walletProvider);
        signer = await provider.getSigner();
      }
      
      const contract = new ethers.Contract(chain.contractAddress, this.getContractABI(), provider);
      const contractWithSigner = contract.connect(signer);

      // Convert amount to wei
      const amountWei = ethers.parseEther(amount);
      const costWei = ethers.parseEther(activationCost);

      // Create the transaction
      console.log('Creating deposit transaction...');
      const tx = await contractWithSigner.deposit(userAddress, amountWei);

      console.log('Transaction sent:', tx.hash);

      // Wait for transaction to be mined
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      // Get the deposit ID from the transaction logs
      const depositId = receipt.logs[0]?.args?.depositId?.toString();
      
      console.log('Transaction confirmed:', receipt);

      // Update oracle with new token count
      await this.updateOracleAfterActivation(parseInt(amount), tokensActivated);

      return {
        success: true,
        transactionHash: tx.hash,
        depositId: depositId,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        newTokenCount: tokensActivated + parseInt(amount),
        newXMBLPrice: this.calculateNewPrice(tokensActivated + parseInt(amount)),
        btcDeposited: (parseFloat(currentPrice) * parseInt(amount)).toFixed(8)
      };

    } catch (error) {
      console.error('Error activating tokens:', error);
      return {
        success: false,
        error: error.message || 'Failed to activate tokens'
      };
    }
  }

  /**
   * Update oracle after successful activation
   */
  private async updateOracleAfterActivation(amount: number, currentCount: number): Promise<void> {
    try {
      const newCount = currentCount + amount;
      const newPrice = this.calculateNewPrice(newCount);
      
      console.log(`Updating oracle: ${currentCount} -> ${newCount} tokens, new price: ${newPrice} BTC`);
      
      // In a real implementation, this would call the oracle contract
      // For now, we'll simulate the update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Oracle updated successfully');
    } catch (error) {
      console.error('Error updating oracle:', error);
    }
  }

  /**
   * Calculate new XMBL price based on token count (Golden Ratio)
   */
  private calculateNewPrice(tokenCount: number): string {
    if (tokenCount === 0) return '0.00000001'; // 1 satoshi
    
    // Golden Ratio pricing: price increases with each activation
    const goldenRatio = 1.618;
    const basePrice = 0.00000001; // 1 satoshi
    const priceMultiplier = Math.pow(goldenRatio, tokenCount);
    
    const newPrice = basePrice * priceMultiplier;
    return newPrice.toFixed(8);
  }

  /**
   * Get contract ABI for ChainDepositContract
   */
  private getContractABI(): any[] {
    return [
      {
        "inputs": [
          {"internalType": "address", "name": "token", "type": "address"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "deposit",
        "outputs": [
          {"internalType": "uint256", "name": "depositId", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return this.chains;
  }

  /**
   * Get chain by ID
   */
  getChainById(chainId: number): ChainConfig | undefined {
    return this.chains.find(c => c.id === chainId);
  }
}
