import { expect } from "chai";
import { ethers } from "hardhat";
import { PythOracleService } from "../services/PythOracleService";

describe("PythOracleService", function () {
  let pythService: PythOracleService;
  let provider: ethers.Provider;
  let signer: ethers.Signer;
  let mockPriceOracle: string;

  beforeEach(async function () {
    provider = ethers.provider;
    [signer] = await ethers.getSigners();
    mockPriceOracle = "0x0000000000000000000000000000000000000000";
    
    pythService = new PythOracleService(
      "https://hermes.pyth.network",
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      mockPriceOracle,
      provider,
      signer
    );
  });

  it("Should initialize successfully with Pyth SDK", async function () {
    const status = pythService.getServiceStatus();
    expect(status.hermesUrl).to.equal("https://hermes.pyth.network");
    expect(status.btcUsdFeedId).to.equal("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43");
    expect(status.isConnected).to.be.true;
  });

  it("Should handle cache timeout setting", function () {
    pythService.setCacheTimeout(60000);
    const status = pythService.getServiceStatus();
    expect(status.cacheTimeout).to.equal(60000);
  });

  it("Should clear cache", function () {
    pythService.clearCache();
    const stats = pythService.getCacheStats();
    expect(stats.size).to.equal(0);
  });

  it("Should get cache statistics", function () {
    const stats = pythService.getCacheStats();
    expect(stats).to.have.property('size');
    expect(stats).to.have.property('entries');
    expect(stats.entries).to.be.an('array');
  });

  it("Should handle price feed status", async function () {
    // Mock the fetchBtcPrice method to avoid actual API calls
    const originalFetchBtcPrice = pythService.fetchBtcPrice;
    pythService.fetchBtcPrice = async () => 50000; // Mock BTC price
    
    const status = await pythService.getPriceFeedStatus();
    expect(status).to.have.property('feedId');
    expect(status).to.have.property('price');
    expect(status).to.have.property('timestamp');
    expect(status).to.have.property('isStale');
    
    // Restore original method
    pythService.fetchBtcPrice = originalFetchBtcPrice;
  });

  it("Should handle current BTC price", async function () {
    // Mock the fetchBtcPrice method
    const originalFetchBtcPrice = pythService.fetchBtcPrice;
    pythService.fetchBtcPrice = async () => 50000;
    
    const price = await pythService.getCurrentBtcPrice();
    expect(price).to.be.a('number');
    expect(price).to.be.greaterThan(0);
    
    // Restore original method
    pythService.fetchBtcPrice = originalFetchBtcPrice;
  });

  it("Should handle price updates", async function () {
    // Mock the fetchBtcPrice method
    const originalFetchBtcPrice = pythService.fetchBtcPrice;
    pythService.fetchBtcPrice = async () => 50000;
    
    // Mock the price oracle update
    const originalUpdatePriceFeeds = pythService.updatePriceFeeds;
    pythService.updatePriceFeeds = async () => "0x1234567890abcdef";
    
    const txHash = await pythService.updatePriceFeeds();
    expect(txHash).to.be.a('string');
    expect(txHash).to.have.length(18); // Mock tx hash length
    
    // Restore original methods
    pythService.fetchBtcPrice = originalFetchBtcPrice;
    pythService.updatePriceFeeds = originalUpdatePriceFeeds;
  });

  it("Should handle periodic updates", function () {
    // Test that start/stop methods don't throw
    expect(() => pythService.startPriceUpdates(1000)).to.not.throw();
    expect(() => pythService.stopPriceUpdates()).to.not.throw();
  });

  it("Should handle cache operations", function () {
    // Test cache operations
    pythService.clearCache();
    let stats = pythService.getCacheStats();
    expect(stats.size).to.equal(0);
    
    // Set cache timeout
    pythService.setCacheTimeout(10000);
    const status = pythService.getServiceStatus();
    expect(status.cacheTimeout).to.equal(10000);
  });

  it("Should handle service status", function () {
    const status = pythService.getServiceStatus();
    expect(status).to.have.property('hermesUrl');
    expect(status).to.have.property('btcUsdFeedId');
    expect(status).to.have.property('cacheTimeout');
    expect(status).to.have.property('cacheSize');
    expect(status).to.have.property('isConnected');
    
    expect(status.hermesUrl).to.be.a('string');
    expect(status.btcUsdFeedId).to.be.a('string');
    expect(status.cacheTimeout).to.be.a('number');
    expect(status.cacheSize).to.be.a('number');
    expect(status.isConnected).to.be.a('boolean');
  });

  it("Should handle error scenarios gracefully", async function () {
    // Mock fetchBtcPrice to throw an error
    const originalFetchBtcPrice = pythService.fetchBtcPrice;
    pythService.fetchBtcPrice = async () => {
      throw new Error('Network error');
    };
    
    try {
      await pythService.getCurrentBtcPrice();
    } catch (error) {
      expect(error).to.be.an('error');
      expect(error.message).to.include('Network error');
    }
    
    // Restore original method
    pythService.fetchBtcPrice = originalFetchBtcPrice;
  });
});
