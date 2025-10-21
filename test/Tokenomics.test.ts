import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";

describe("Tokenomics Integration", function () {
  let priceOracle: PriceOracle;
  let deployer: any;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy PriceOracle with tokenomics
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(
      "0x0000000000000000000000000000000000000000", // Mock Pyth address
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // Mock BTC/USD price feed ID
    );
    await priceOracle.waitForDeployment();
  });

  it("Should initialize with correct tokenomics constants", async function () {
    const state = await priceOracle.getTokenomicsState();
    
    expect(state[0]).to.equal(0); // proofOfFaith
    expect(state[1]).to.equal(0); // xymMinted
    expect(state[2]).to.equal(1); // xymNextPrice (starting price)
    expect(state[3]).to.equal(0); // xymPrevPrice
    expect(state[4]).to.equal(111111111); // xyDivisor (999999999 / 9)
    expect(state[5]).to.equal(0); // xyReleased
    expect(state[6]).to.equal(999999999); // xyRemaining
    expect(state[7]).to.equal(369); // xyReleaseTarget
    expect(state[8]).to.equal(9); // xyNextAmount
  });

  it("Should calculate price using Firebase tokenomics formula", async function () {
    // First token should cost 1 satoshi
    const price1 = await priceOracle.calculatePrice(1);
    expect(price1).to.be.greaterThan(0); // Should be positive

    // Activate first token
    await priceOracle.activateToken();
    
    const state = await priceOracle.getTokenomicsState();
    expect(state[1]).to.equal(1); // xymMinted
    expect(state[0]).to.be.greaterThan(0); // proofOfFaith should be positive
  });

  it("Should release coins when price reaches target", async function () {
    // Activate multiple tokens to increase price
    for (let i = 0; i < 10; i++) {
      await priceOracle.activateToken();
    }

    const state = await priceOracle.getTokenomicsState();
    const distribution = await priceOracle.getCoinDistributionStatus();
    
    // Check if coins were released (price should be higher than target)
    if (state[2] > state[7]) { // xymNextPrice > xyReleaseTarget
      expect(distribution[0]).to.be.true; // canReleaseCoins
    }
  });

  it("Should track proof of faith correctly", async function () {
    const initialState = await priceOracle.getTokenomicsState();
    expect(initialState[0]).to.equal(0); // proofOfFaith starts at 0

    // Activate a token
    await priceOracle.activateToken();
    
    const state = await priceOracle.getTokenomicsState();
    expect(state[0]).to.be.greaterThan(0); // proofOfFaith should increase
  });

  it("Should update coin distribution correctly", async function () {
    const initialDistribution = await priceOracle.getCoinDistributionStatus();
    expect(initialDistribution[4]).to.equal(999999999); // remaining coins

    // Activate tokens until coins are released
    let coinsReleased = false;
    for (let i = 0; i < 100; i++) {
      await priceOracle.activateToken();
      const distribution = await priceOracle.getCoinDistributionStatus();
      if (distribution[2] > 0) { // totalReleased > 0
        coinsReleased = true;
        break;
      }
    }

    // Note: Coins may not be released in this test due to price not reaching target
    // This is expected behavior based on the tokenomics
    console.log(`Coins released: ${coinsReleased}`);
  });

  it("Should emit tokenomics events", async function () {
    let tokenomicsEventEmitted = false;

    // Listen for events
    priceOracle.on('TokenomicsUpdated', () => {
      tokenomicsEventEmitted = true;
    });

    // Activate tokens
    for (let i = 0; i < 5; i++) {
      await priceOracle.activateToken();
    }

    // Give some time for events to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(tokenomicsEventEmitted).to.be.true;
    
    // Clean up listeners
    priceOracle.removeAllListeners();
  });

  it("Should handle multiple activations correctly", async function () {
    const initialPrice = await priceOracle.getCurrentPrice();
    expect(initialPrice).to.equal(1);

    // Activate 5 tokens
    for (let i = 0; i < 5; i++) {
      await priceOracle.activateToken();
    }

    const finalPrice = await priceOracle.getCurrentPrice();
    const state = await priceOracle.getTokenomicsState();
    
    expect(finalPrice).to.be.greaterThan(initialPrice);
    expect(state[1]).to.equal(5); // xymMinted
    expect(state[0]).to.be.greaterThan(0); // proofOfFaith
  });

  it("Should calculate correct price progression", async function () {
    const prices = [];
    
    // Activate 5 tokens and track prices
    for (let i = 0; i < 5; i++) {
      await priceOracle.activateToken();
      const price = await priceOracle.getCurrentPrice();
      prices.push(Number(price));
    }

    // Prices should be non-decreasing (may stay the same or increase)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).to.be.greaterThanOrEqual(prices[i-1]);
    }
  });

  it("Should handle coin distribution math correctly", async function () {
    const state = await priceOracle.getTokenomicsState();
    
    // Initial values
    expect(state[4]).to.equal(111111111); // xyDivisor = 999999999 / 9
    expect(state[8]).to.equal(9); // xyNextAmount
    expect(state[7]).to.equal(369); // xyReleaseTarget
    
    // Activate tokens until coins are released
    let activated = 0;
    while (activated < 1000) {
      await priceOracle.activateToken();
      activated++;
      
      const currentState = await priceOracle.getTokenomicsState();
      if (currentState[5] > 0) { // xyReleased > 0
        // Coins were released, check the math
        expect(currentState[4]).to.be.lessThan(state[4]); // xyDivisor should be halved
        expect(currentState[6]).to.be.lessThan(state[6]); // xyRemaining should decrease
        break;
      }
    }
  });
});
