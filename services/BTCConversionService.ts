import { ethers } from 'ethers';
import { DepositManager__factory } from '../typechain-types';

interface ConversionConfig {
  developmentPoolAddress: string;
  liquidityPoolAddress: string;
  minLiquidityPercentage: number; // 10% starting
  maxLiquidityPercentage: number; // 95% upper bound
  targetBTCForMaxLiquidity: number; // 100 BTC in satoshis
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
    
    // Calculate k so that at targetBTC we reach 90% of the range
    // We want: min + (max - min) * 0.9 = min + (max - min) * (1 - e^(-k * targetBTC))
    // So: 0.9 = 1 - e^(-k * targetBTC)
    // So: e^(-k * targetBTC) = 0.1
    // So: -k * targetBTC = ln(0.1)
    // So: k = -ln(0.1) / targetBTC
    const k = -Math.log(0.1) / targetBTCForMaxLiquidity;
    
    // Apply logarithmic curve
    const curveValue = 1 - Math.exp(-k * btcAmount);
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
   * @dev Process BTC conversion with cost accounting and pool splitting
   */
  async processBTCConversion(
    userAddress: string,
    btcAmountSats: number,
    activationId: number
  ): Promise<{
    success: boolean;
    developmentSats: number;
    liquiditySats: number;
    costs: any;
    netBTCForActivation: number;
    transactionHash?: string;
  }> {
    try {
      // Calculate all costs
      const costs = this.calculateTotalCosts(btcAmountSats);
      
      // Only net BTC counts toward token activation
      const netBTCForActivation = costs.netBTCForActivation;
      
      if (netBTCForActivation <= 0) {
        throw new Error("Insufficient BTC after costs for activation");
      }
      
      // Split the net BTC between pools
      const { developmentSats, liquiditySats } = this.splitBTCAmount(netBTCForActivation);
      
      // Mock conversion process (in production, this would involve actual BTC transfers)
      console.log(`Processing BTC conversion for activation ${activationId}:`);
      console.log(`  Total BTC: ${btcAmountSats} sats`);
      console.log(`  Costs: ${costs.totalCosts} sats`);
      console.log(`  Net BTC for activation: ${netBTCForActivation} sats`);
      console.log(`  Development pool: ${developmentSats} sats (${this.calculateDevelopmentPercentage(netBTCForActivation).toFixed(2)}%)`);
      console.log(`  Liquidity pool: ${liquiditySats} sats (${this.calculateLiquidityPercentage(netBTCForActivation).toFixed(2)}%)`);
      
      // In production, this would:
      // 1. Transfer developmentSats to development pool
      // 2. Transfer liquiditySats to liquidity pool
      // 3. Update activation record with net BTC amount
      
      return {
        success: true,
        developmentSats,
        liquiditySats,
        costs,
        netBTCForActivation
      };
      
    } catch (error) {
      console.error("BTC conversion failed:", error);
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
