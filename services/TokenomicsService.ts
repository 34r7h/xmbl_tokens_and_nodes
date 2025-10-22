import { ethers } from 'ethers';
import { PriceOracle } from '../typechain-types';

export interface TokenomicsState {
  proofOfFaith: number;
  xymMinted: number;
  xymNextPrice: number;
  xymPrevPrice: number;
  xyDivisor: number;
  xyReleased: number;
  xyRemaining: number;
  xyReleaseTarget: number;
  xyNextAmount: number;
}

export interface CoinDistributionStatus {
  canReleaseCoins: boolean;
  nextReleaseAmount: number;
  releaseTarget: number;
  totalReleased: number;
  remaining: number;
}

export class TokenomicsService {
  private priceOracle: PriceOracle;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(priceOracleAddress: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.priceOracle = new ethers.Contract(
      priceOracleAddress,
      [
        'function getTokenomicsState() view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
        'function getCoinDistributionStatus() view returns (bool,uint256,uint256,uint256,uint256)',
        'function activateToken() external',
        'function deactivateToken() external',
        'function getCurrentPrice() view returns (uint256)',
        'function calculatePrice(uint256) view returns (uint256)',
        'event TokenomicsUpdated(uint256,uint256,uint256)',
        'event CoinsReleased(uint256,uint256,uint256)',
        'event ActivationProcessed(uint256,uint256,bool)'
      ],
      signer || provider
    ) as unknown as PriceOracle;
  }

  /**
   * @dev Get current tokenomics state from contract
   */
  async getTokenomicsState(): Promise<TokenomicsState> {
    const [
      proofOfFaith,
      xymMinted,
      xymNextPrice,
      xymPrevPrice,
      xyDivisor,
      xyReleased,
      xyRemaining,
      xyReleaseTarget,
      xyNextAmount
    ] = await this.priceOracle.getTokenomicsState();

    return {
      proofOfFaith: Number(proofOfFaith),
      xymMinted: Number(xymMinted),
      xymNextPrice: Number(xymNextPrice),
      xymPrevPrice: Number(xymPrevPrice),
      xyDivisor: Number(xyDivisor),
      xyReleased: Number(xyReleased),
      xyRemaining: Number(xyRemaining),
      xyReleaseTarget: Number(xyReleaseTarget),
      xyNextAmount: Number(xyNextAmount)
    };
  }

  /**
   * @dev Get coin distribution status
   */
  async getCoinDistributionStatus(): Promise<CoinDistributionStatus> {
    const [
      canReleaseCoins,
      nextReleaseAmount,
      releaseTarget,
      totalReleased,
      remaining
    ] = await this.priceOracle.getCoinDistributionStatus();

    return {
      canReleaseCoins,
      nextReleaseAmount: Number(nextReleaseAmount),
      releaseTarget: Number(releaseTarget),
      totalReleased: Number(totalReleased),
      remaining: Number(remaining)
    };
  }

  /**
   * @dev Activate a token (mint new token)
   */
  async activateToken(): Promise<void> {
    const tx = await this.priceOracle.activateToken();
    await tx.wait();
  }

  /**
   * @dev Deactivate a token (burn token)
   */
  async deactivateToken(): Promise<void> {
    const tx = await this.priceOracle.deactivateToken();
    await tx.wait();
  }

  /**
   * @dev Get current token price
   */
  async getCurrentPrice(): Promise<number> {
    const price = await this.priceOracle.getCurrentPrice();
    return Number(price);
  }

  /**
   * @dev Calculate price for given token number
   */
  async calculatePrice(tokenNumber: number): Promise<number> {
    const price = await this.priceOracle.calculatePrice(tokenNumber);
    return Number(price);
  }

  /**
   * @dev Listen to tokenomics events
   */
  onTokenomicsUpdated(callback: (proofOfFaith: number, xymMinted: number, xymNextPrice: number) => void): void {
    this.priceOracle.on('TokenomicsUpdated', (proofOfFaith, xymMinted, xymNextPrice) => {
      callback(Number(proofOfFaith), Number(xymMinted), Number(xymNextPrice));
    });
  }

  /**
   * @dev Listen to coin release events
   */
  onCoinsReleased(callback: (amount: number, totalReleased: number, remaining: number) => void): void {
    this.priceOracle.on('CoinsReleased', (amount, totalReleased, remaining) => {
      callback(Number(amount), Number(totalReleased), Number(remaining));
    });
  }

  /**
   * @dev Listen to activation events
   */
  onActivationProcessed(callback: (activationId: number, price: number, settled: boolean) => void): void {
    this.priceOracle.on('ActivationProcessed', (activationId, price, settled) => {
      callback(Number(activationId), Number(price), settled);
    });
  }

  /**
   * @dev Remove all event listeners
   */
  removeAllListeners(): void {
    this.priceOracle.removeAllListeners();
  }

  /**
   * @dev Get tokenomics summary for display
   */
  async getTokenomicsSummary(): Promise<{
    totalTokensMinted: number;
    currentPrice: number;
    totalBTCDeposited: number;
    coinsReleased: number;
    coinsRemaining: number;
    nextReleaseTarget: number;
    canReleaseCoins: boolean;
  }> {
    const state = await this.getTokenomicsState();
    const distribution = await this.getCoinDistributionStatus();
    const currentPrice = await this.getCurrentPrice();

    return {
      totalTokensMinted: state.xymMinted,
      currentPrice,
      totalBTCDeposited: state.proofOfFaith,
      coinsReleased: state.xyReleased,
      coinsRemaining: state.xyRemaining,
      nextReleaseTarget: state.xyReleaseTarget,
      canReleaseCoins: distribution.canReleaseCoins
    };
  }
}
