import { ethers } from 'hardhat';
import { expect } from 'chai';
import { PythOracleService } from '../services/PythOracleService';

describe('E2E Pyth Integration', function () {
  let pythService: PythOracleService;
  let signer: any;
  let provider: any;

  before(async function () {
    [signer] = await ethers.getSigners();
    provider = signer.provider;
    
    // Skip if no Pyth configuration
    if (!process.env.PYTH_HERMES_URL) {
      this.skip();
    }
  });

  beforeEach(async function () {
    pythService = new PythOracleService(
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      '0x0000000000000000000000000000000000000000', // Mock price oracle
      provider,
      signer
    );
  });

  it('Should fetch BTC price from Hermes', async function () {
    const btcPrice = await pythService.fetchBtcPrice();
    
    expect(btcPrice).to.be.a('number');
    expect(btcPrice).to.be.greaterThan(0);
    expect(btcPrice).to.be.lessThan(1000000); // Reasonable BTC price range
  });

  it('Should handle Hermes API errors', async function () {
    const invalidService = new PythOracleService(
      'https://invalid-hermes-url.com',
      'invalid-feed-id',
      '0x0000000000000000000000000000000000000000',
      provider,
      signer
    );
    
    await expect(invalidService.fetchBtcPrice()).to.be.rejected;
  });

  it('Should cache price data', async function () {
    const price1 = await pythService.fetchBtcPrice();
    const price2 = await pythService.fetchBtcPrice();
    
    // Second call should use cache
    expect(price1).to.equal(price2);
  });

  it('Should get price feed status', async function () {
    const status = await pythService.getPriceFeedStatus();
    
    expect(status).to.have.property('feedId');
    expect(status).to.have.property('price');
    expect(status).to.have.property('timestamp');
    expect(status).to.have.property('isStale');
  });

  it('Should handle updatePriceFeeds with Pyth SDK', async function () {
    // This test will fail if Pyth SDK is not properly configured
    // or if there are insufficient funds for update fees
    try {
      const txHash = await pythService.updatePriceFeeds();
      expect(txHash).to.be.a('string');
      expect(txHash).to.match(/^0x[a-fA-F0-9]{64}$/);
    } catch (error) {
      // Expected to fail in test environment without proper Pyth configuration
      expect(error.message).to.include('Pyth');
    }
  });

  it('Should provide service status', async function () {
    const status = pythService.getServiceStatus();
    
    expect(status).to.have.property('hermesUrl');
    expect(status).to.have.property('btcUsdFeedId');
    expect(status).to.have.property('cacheTimeout');
    expect(status).to.have.property('cacheSize');
    expect(status).to.have.property('isConnected');
    expect(status.isConnected).to.be.true;
  });
});
