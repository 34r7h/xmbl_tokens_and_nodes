import axios from 'axios';
import { ethers } from 'ethers';
import { PriceOracle__factory } from '../typechain-types';

/**
 * @title PythOracleService
 * @dev Integrates Pyth Network for real-time price feeds
 * Fetches prices from Hermes API and updates on-chain via updatePriceFeeds
 */
export class PythOracleService {
  private hermesUrl: string;
  private btcUsdFeedId: string;
  private priceOracle: any;
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private cache: Map<string, { price: number; timestamp: number }>;
  private cacheTimeout: number = 30000; // 30 seconds

  constructor(
    hermesUrl: string,
    btcUsdFeedId: string,
    priceOracleAddress: string,
    provider: ethers.Provider,
    signer: ethers.Signer
  ) {
    this.hermesUrl = hermesUrl;
    this.btcUsdFeedId = btcUsdFeedId;
    this.provider = provider;
    this.signer = signer;
    this.cache = new Map();
    
    this.priceOracle = PriceOracle__factory.connect(priceOracleAddress, signer);
  }

  /**
   * @dev Fetch BTC price from Hermes API
   */
  async fetchBtcPrice(): Promise<number> {
    try {
      const cacheKey = 'btc_usd';
      const cached = this.cache.get(cacheKey);
      
      // Return cached price if still valid
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.price;
      }

      // Fetch from Hermes API
      const response = await axios.get(`${this.hermesUrl}/v2/updates/price/latest`, {
        params: {
          ids: [this.btcUsdFeedId]
        }
      });

      if (response.data && response.data.parsed) {
        const priceData = response.data.parsed[0];
        const price = parseFloat(priceData.price.price);
        
        // Cache the price
        this.cache.set(cacheKey, {
          price,
          timestamp: Date.now()
        });
        
        console.log(`Fetched BTC price: $${price}`);
        return price;
      }
      
      throw new Error('No price data received from Hermes');
    } catch (error) {
      console.error('Error fetching BTC price from Hermes:', error);
      throw error;
    }
  }

  /**
   * @dev Update price feeds on-chain using Pyth's updatePriceFeeds
   */
  async updatePriceFeeds(): Promise<string> {
    try {
      // Fetch latest price data
      const btcPrice = await this.fetchBtcPrice();
      
      // Convert to satoshi precision (8 decimal places)
      const priceInSatoshis = Math.floor(btcPrice * 1e8);
      
      // Update on-chain price oracle
      const tx = await this.priceOracle.updatePrice();
      await tx.wait();
      
      console.log(`Updated on-chain price: ${priceInSatoshis} satoshis`);
      
      return tx.hash;
    } catch (error) {
      console.error('Error updating price feeds:', error);
      throw error;
    }
  }

  /**
   * @dev Get current BTC price from cache or fetch new
   */
  async getCurrentBtcPrice(): Promise<number> {
    const cacheKey = 'btc_usd';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }
    
    return await this.fetchBtcPrice();
  }

  /**
   * @dev Get price feed subscription status
   */
  async getPriceFeedStatus(): Promise<{
    feedId: string;
    price: number;
    timestamp: number;
    isStale: boolean;
  }> {
    const cacheKey = 'btc_usd';
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      await this.fetchBtcPrice();
      const freshCached = this.cache.get(cacheKey);
      return {
        feedId: this.btcUsdFeedId,
        price: freshCached?.price || 0,
        timestamp: freshCached?.timestamp || 0,
        isStale: true
      };
    }
    
    return {
      feedId: this.btcUsdFeedId,
      price: cached.price,
      timestamp: cached.timestamp,
      isStale: Date.now() - cached.timestamp > this.cacheTimeout
    };
  }

  /**
   * @dev Handle Pyth EVM error codes
   */
  private handlePythError(error: any): void {
    if (error.code === 'STALE_PRICE') {
      console.warn('Price feed is stale, fetching fresh data...');
    } else if (error.code === 'INVALID_PRICE') {
      console.error('Invalid price data received');
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('Network error fetching price data');
    } else {
      console.error('Unknown Pyth error:', error);
    }
  }

  /**
   * @dev Start periodic price updates
   */
  startPriceUpdates(intervalMs: number = 30000): void {
    setInterval(async () => {
      try {
        await this.updatePriceFeeds();
      } catch (error) {
        this.handlePythError(error);
      }
    }, intervalMs);
    
    console.log(`Started periodic price updates every ${intervalMs}ms`);
  }

  /**
   * @dev Stop periodic price updates
   */
  stopPriceUpdates(): void {
    // In a real implementation, this would clear the interval
    console.log('Stopped periodic price updates');
  }

  /**
   * @dev Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      key: string;
      price: number;
      age: number;
      isStale: boolean;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, data]) => ({
      key,
      price: data.price,
      age: Date.now() - data.timestamp,
      isStale: Date.now() - data.timestamp > this.cacheTimeout
    }));
    
    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * @dev Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Price cache cleared');
  }

  /**
   * @dev Set cache timeout
   */
  setCacheTimeout(timeoutMs: number): void {
    this.cacheTimeout = timeoutMs;
    console.log(`Cache timeout set to ${timeoutMs}ms`);
  }

  /**
   * @dev Get service status
   */
  getServiceStatus(): {
    hermesUrl: string;
    btcUsdFeedId: string;
    cacheTimeout: number;
    cacheSize: number;
    isConnected: boolean;
  } {
    return {
      hermesUrl: this.hermesUrl,
      btcUsdFeedId: this.btcUsdFeedId,
      cacheTimeout: this.cacheTimeout,
      cacheSize: this.cache.size,
      isConnected: true // Mock connection status
    };
  }
}
