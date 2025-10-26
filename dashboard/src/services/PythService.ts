import { ethers, Signer, Provider } from 'ethers';
import axios from 'axios';
import PriceOracleABI from '../../../artifacts/contracts/PriceOracle.sol/PriceOracle.json';

export class PythService {
  private hermesUrl: string;
  private btcUsdPriceId: string;
  private priceOracleAddress: string;
  private provider: Provider;
  private signer: Signer | null;
  private priceOracleContract: ethers.Contract | null;

  constructor(
    hermesUrl: string,
    btcUsdPriceId: string,
    priceOracleAddress: string,
    provider: Provider,
    signer: Signer | null
  ) {
    this.hermesUrl = hermesUrl;
    this.btcUsdPriceId = btcUsdPriceId;
    this.priceOracleAddress = priceOracleAddress;
    this.provider = provider;
    this.signer = signer;
    this.priceOracleContract = signer ? new ethers.Contract(this.priceOracleAddress, PriceOracleABI.abi, signer) : null;
  }

  async fetchBtcPrice(): Promise<number> {
    try {
      const response = await axios.get(`${this.hermesUrl}/v2/updates/price/latest?ids[]=${this.btcUsdPriceId}`);
      const priceFeed = response.data.parsed[0];
      
      if (priceFeed && priceFeed.price) {
        const price = parseInt(priceFeed.price.price);
        const exponent = parseInt(priceFeed.price.expo);
        return price * Math.pow(10, exponent);
      }
      throw new Error('BTC price not found in Pyth feed');
    } catch (error) {
      console.error('Error fetching BTC price from Pyth:', error);
      throw error;
    }
  }

  async updatePriceFeeds(): Promise<ethers.TransactionResponse> {
    if (!this.signer || !this.priceOracleContract) {
      throw new Error('Signer or PriceOracle contract not initialized.');
    }

    try {
      // Fetch price update data from Pyth Hermes
      const response = await axios.get(`${this.hermesUrl}/v2/updates/price/latest?ids[]=${this.btcUsdPriceId}`);
      const priceData = response.data.parsed[0];

      if (!priceData) {
        throw new Error('No price data found for update.');
      }

      // Call the updatePriceFeeds function on the PriceOracle contract
      const tx = await this.priceOracleContract.updatePriceFeeds(priceData);
      await tx.wait();
      console.log('Pyth price feeds updated on-chain:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error updating Pyth price feeds on-chain:', error);
      throw error;
    }
  }

  async getXMBLPrice(): Promise<bigint> {
    if (!this.priceOracleContract) {
      throw new Error('PriceOracle contract not initialized.');
    }
    
    try {
      const price = await this.priceOracleContract.getCurrentPrice();
      return price;
    } catch (error) {
      console.error('Error fetching XMBL price from PriceOracle:', error);
      throw error;
    }
  }
}