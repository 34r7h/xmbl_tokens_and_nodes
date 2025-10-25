import { ethers } from 'ethers';
import { DepositManager__factory } from '../typechain-types';
import { ThorchainIntegration } from './ThorchainIntegration';

interface ConversionConfig {
  developmentPoolAddress: string;
  liquidityPoolAddress: string;
  minLiquidityPercentage: number; // 10% starting
  maxLiquidityPercentage: number; // 95% upper bound
  targetBTCForMaxLiquidity: number; // 100 BTC in satoshis
  thorchainConfig: {
    midgardUrl: string;
    thornodeUrl: string;
    network: 'testnet' | 'mainnet';
    btcTestnetLiquidityAddress?: string;
    btcTestnetLiquidityKey?: string;
    btcTestnetDeveloperAddress?: string;
    btcTestnetDeveloperKey?: string;
  };
}

/**
 * @title BTCConversionService
 * @dev Handles BTC conversion with logarithmic percentage split between development and liquidity pools
 * Implements logarithmic curves similar to pricing algorithm
 */
export class BTCConversionService {
  private provider: ethers.Provider;
  private depositManager: any;
  private config: ConversionConfig;
  private thorchainIntegration: ThorchainIntegration;

  constructor(
    provider: ethers.Provider,
    depositManagerAddress: string,
    config: ConversionConfig
  ) {
    this.provider = provider;
    this.depositManager = DepositManager__factory.connect(
      depositManagerAddress,
      provider
    );
    this.config = config;
    this.thorchainIntegration = new ThorchainIntegration({
      midgardUrl: 'https://testnet.multichain.midgard.thorchain.info/v2',
      thornodeUrl: 'https://testnet.thornode.thorchain.info',
      network: 'testnet',
      btcTestnetLiquidityAddress: process.env.BTC_TESTNET_LIQUIDITY_ADDRESS,
      btcTestnetLiquidityKey: process.env.BTC_TESTNET_LIQUIDITY_KEY,
      btcTestnetDeveloperAddress: process.env.BTC_TESTNET_DEVELOPER_ADDRESS,
      btcTestnetDeveloperKey: process.env.BTC_TESTNET_DEVELOPER_KEY
    });
  }

  /**
   * @dev Calculate liquidity percentage using logarithmic curve
   * Similar to pricing algorithm but rises more quickly
   * Formula: min + (max - min) * (1 - e^(-k * btcAmount))
   * Where k is chosen so that at 100 BTC we reach 95%
   */
  calculateLiquidityPercentage(btcAmountSats: number): number {
    const { minLiquidityPercentage, maxLiquidityPercentage, targetBTCForMaxLiquidity } = this.config;
    
    // Convert satoshis to BTC for calculation
    const btcAmount = btcAmountSats / 1e8;
    
    // Prevent negative or zero amounts
    if (btcAmount <= 0) return minLiquidityPercentage;
    
    // Calculate k so that at targetBTC we reach 90% of the range
    // We want: min + (max - min) * 0.9 = min + (max - min) * (1 - e^(-k * targetBTC))
    // So: 0.9 = 1 - e^(-k * targetBTC)
    // So: e^(-k * targetBTC) = 0.1
    // So: -k * targetBTC = ln(0.1)
    // So: k = -ln(0.1) / targetBTC
    const k = -Math.log(0.1) / targetBTCForMaxLiquidity;
    
    // Apply logarithmic curve with bounds checking
    const curveValue = Math.max(0, Math.min(1, 1 - Math.exp(-k * btcAmount)));
    const liquidityPercentage = minLiquidityPercentage + (maxLiquidityPercentage - minLiquidityPercentage) * curveValue;
    
    // Ensure we stay within bounds
    return Math.min(Math.max(liquidityPercentage, minLiquidityPercentage), maxLiquidityPercentage);
  }

  /**
   * @dev Calculate development percentage (inverse of liquidity)
   */
  calculateDevelopmentPercentage(btcAmountSats: number): number {
    return 100 - this.calculateLiquidityPercentage(btcAmountSats);
  }

  /**
   * @dev Split BTC amount between development and liquidity pools
   */
  splitBTCAmount(totalBTCSats: number): { developmentSats: number; liquiditySats: number } {
    const liquidityPercentage = this.calculateLiquidityPercentage(totalBTCSats);
    const developmentPercentage = 100 - liquidityPercentage;
    
    const liquiditySats = Math.floor((totalBTCSats * liquidityPercentage) / 100);
    const developmentSats = totalBTCSats - liquiditySats; // Remainder goes to development
    
    return { developmentSats, liquiditySats };
  }

  /**
   * @dev Calculate total costs for oracle calls, contract calls, etc.
   * Users must account for all costs - only net BTC deposited counts toward token activation
   */
  calculateTotalCosts(btcAmountSats: number): {
    oracleCosts: number;
    contractCosts: number;
    networkFees: number;
    totalCosts: number;
    netBTCForActivation: number;
  } {
    // Oracle costs (Pyth price feed updates)
    const oracleCosts = Math.ceil(btcAmountSats * 0.001); // 0.1% of BTC amount
    
    // Contract execution costs
    const contractCosts = Math.ceil(btcAmountSats * 0.002); // 0.2% of BTC amount
    
    // Network fees (gas, etc.)
    const networkFees = Math.ceil(btcAmountSats * 0.003); // 0.3% of BTC amount
    
    const totalCosts = oracleCosts + contractCosts + networkFees;
    const netBTCForActivation = Math.max(0, btcAmountSats - totalCosts);
    
    return {
      oracleCosts,
      contractCosts,
      networkFees,
      totalCosts,
      netBTCForActivation
    };
  }

  /**
   * @dev Process BTC conversion with real THORChain integration
   */
  async processBTCConversion(
    userAddress: string,
    btcAmountSats: number,
    activationId: number,
    fromAsset: 'ETH' | 'USDC' | 'USDT',
    fromAmount: string
  ): Promise<{
    success: boolean;
    developmentSats: number;
    liquiditySats: number;
    costs: any;
    netBTCForActivation: number;
    transactionHash?: string;
    thorchainTxHash?: string;
  }> {
    try {
      console.log(`🔄 Processing REAL BTC conversion for activation ${activationId}:`);
      console.log(`  From: ${fromAmount} ${fromAsset}`);
      console.log(`  Target BTC: ${btcAmountSats} sats`);
      
      // Calculate split between liquidity and developer pools
      const liquidityPercentage = this.calculateLiquidityPercentage(btcAmount);
      const developerPercentage = 100 - liquidityPercentage;
      
      const liquidityAmount = (btcAmount * liquidityPercentage) / 100;
      const developerAmount = (btcAmount * developerPercentage) / 100;
      
      console.log(`💰 BTC Split Calculation:`);
      console.log(`  Total BTC: ${ethers.formatUnits(btcAmount, 8)} BTC`);
      console.log(`  Liquidity Pool: ${liquidityPercentage}% = ${ethers.formatUnits(liquidityAmount, 8)} BTC`);
      console.log(`  Developer Pool: ${developerPercentage}% = ${ethers.formatUnits(developerAmount, 8)} BTC`);
      
      // Execute THORChain swaps to both pools
      let liquiditySwapResult;
      let developerSwapResult;
      
      switch (fromAsset) {
        case 'ETH':
          // Liquidity pool swap
          liquiditySwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.ETH',
            'BTC.BTC',
            (fromAmount * liquidityPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetLiquidityAddress || this.config.liquidityPoolAddress
          );
          
          // Developer pool swap
          developerSwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.ETH',
            'BTC.BTC',
            (fromAmount * developerPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetDeveloperAddress || this.config.developmentPoolAddress
          );
          break;
        case 'USDC':
          liquiditySwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.USDC-0XA0B86A33E6C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0',
            'BTC.BTC',
            (fromAmount * liquidityPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetLiquidityAddress || this.config.liquidityPoolAddress
          );
          
          developerSwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.USDC-0XA0B86A33E6C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0',
            'BTC.BTC',
            (fromAmount * developerPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetDeveloperAddress || this.config.developmentPoolAddress
          );
          break;
        case 'USDT':
          liquiditySwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
            'BTC.BTC',
            (fromAmount * liquidityPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetLiquidityAddress || this.config.liquidityPoolAddress
          );
          
          developerSwapResult = await this.thorchainIntegration.executeSwap(
            'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
            'BTC.BTC',
            (fromAmount * developerPercentage / 100).toString(),
            this.config.thorchainConfig.btcTestnetDeveloperAddress || this.config.developmentPoolAddress
          );
          break;
        default:
          throw new Error(`Unsupported asset: ${fromAsset}`);
      }
      
      // Combine results
      const swapResult = {
        success: liquiditySwapResult.success && developerSwapResult.success,
        liquidityTxHash: liquiditySwapResult.txHash,
        developerTxHash: developerSwapResult.txHash,
        liquidityOutput: liquiditySwapResult.estimatedOutput,
        developerOutput: developerSwapResult.estimatedOutput,
        totalOutput: (parseFloat(liquiditySwapResult.estimatedOutput || '0') + parseFloat(developerSwapResult.estimatedOutput || '0')).toString(),
        fees: {
          liquidity: liquiditySwapResult.fees,
          developer: developerSwapResult.fees
        }
      };
      
      if (!swapResult.success) {
        throw new Error(`THORChain swap failed: ${swapResult.error}`);
      }
      
      console.log(`✅ THORChain swap successful! TX: ${swapResult.txHash}`);
      console.log(`💰 Expected BTC output: ${swapResult.estimatedOutput}`);
      console.log(`💸 Swap fees: ${swapResult.fees?.total}`);
      
      // Calculate all costs including THORChain fees
      const costs = this.calculateTotalCosts(btcAmountSats);
      const thorchainFees = swapResult.fees?.total || '0';
      const totalCosts = costs.totalCosts + parseInt(thorchainFees);
      
      // Only net BTC counts toward token activation
      const netBTCForActivation = Math.max(0, btcAmountSats - totalCosts);
      
      if (netBTCForActivation <= 0) {
        throw new Error("Insufficient BTC after costs for activation");
      }
      
      // Split the net BTC between pools
      const { developmentSats, liquiditySats } = this.splitBTCAmount(netBTCForActivation);
      
      console.log(`📊 Final allocation:`);
      console.log(`  Total BTC received: ${btcAmountSats} sats`);
      console.log(`  Total costs: ${totalCosts} sats`);
      console.log(`  Net BTC for activation: ${netBTCForActivation} sats`);
      console.log(`  Development pool: ${developmentSats} sats (${this.calculateDevelopmentPercentage(netBTCForActivation).toFixed(2)}%)`);
      console.log(`  Liquidity pool: ${liquiditySats} sats (${this.calculateLiquidityPercentage(netBTCForActivation).toFixed(2)}%)`);
      
      // TODO: In production, this would:
      // 1. Transfer developmentSats to development pool
      // 2. Transfer liquiditySats to liquidity pool  
      // 3. Update activation record with net BTC amount
      // 4. Monitor THORChain transaction for completion
      
      return {
        success: true,
        developmentSats,
        liquiditySats,
        costs: {
          ...costs,
          thorchainFees: thorchainFees,
          totalCosts: totalCosts
        },
        netBTCForActivation,
        thorchainTxHash: swapResult.txHash
      };
      
    } catch (error) {
      console.error("❌ BTC conversion failed:", error);
      return {
        success: false,
        developmentSats: 0,
        liquiditySats: 0,
        costs: this.calculateTotalCosts(btcAmountSats),
        netBTCForActivation: 0
      };
    }
  }

  /**
   * @dev Get current pool allocation percentages
   */
  getCurrentAllocation(btcAmountSats: number): {
    liquidityPercentage: number;
    developmentPercentage: number;
    btcAmount: number;
  } {
    const liquidityPercentage = this.calculateLiquidityPercentage(btcAmountSats);
    const developmentPercentage = 100 - liquidityPercentage;
    const btcAmount = btcAmountSats / 1e8;
    
    return {
      liquidityPercentage,
      developmentPercentage,
      btcAmount
    };
  }

  /**
   * @dev Get allocation curve data for visualization
   */
  getAllocationCurve(maxBTC: number = 200): Array<{
    btcAmount: number;
    liquidityPercentage: number;
    developmentPercentage: number;
  }> {
    const curve = [];
    const step = maxBTC / 100; // 100 data points
    
    for (let btc = 0; btc <= maxBTC; btc += step) {
      const btcSats = Math.floor(btc * 1e8);
      const liquidityPercentage = this.calculateLiquidityPercentage(btcSats);
      const developmentPercentage = 100 - liquidityPercentage;
      
      curve.push({
        btcAmount: btc,
        liquidityPercentage,
        developmentPercentage
      });
    }
    
    return curve;
  }

  /**
   * @dev Update configuration
   */
  updateConfig(newConfig: Partial<ConversionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("BTC conversion configuration updated:", this.config);
  }

  /**
   * @dev Get current configuration
   */
  getConfig(): ConversionConfig {
    return { ...this.config };
  }
}
