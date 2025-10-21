import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";

describe("PriceOracle", function () {
  let priceOracle: PriceOracle;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Mock Pyth contract address and BTC/USD price feed ID
    const mockPythAddress = "0x0000000000000000000000000000000000000000";
    const mockBtcUsdPriceId = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(mockPythAddress, mockBtcUsdPriceId);
    await priceOracle.waitForDeployment();
  });

  it("Should initialize with correct starting price (1 satoshi)", async function () {
    const startingPrice = await priceOracle.getCurrentPrice();
    expect(startingPrice).to.equal(1); // 1 satoshi
  });

  it("Should calculate price using golden ratio formula", async function () {
    // Test the formula: x / (Phi * y)
    // Where Phi = 1.618, using PHI = 1618 (1.618 * 1000)
    const tokensMinted = 100;
    // Expected: 1000 / (1618 * 100) = 1000 / 161800 ≈ 0.00618
    // Rounded up to satoshi: 100000000 (1 satoshi in wei)
    const expectedPrice = 100000000;
    
    await priceOracle.setTokensMinted(tokensMinted);
    const calculatedPrice = await priceOracle.getCurrentPrice();
    
    expect(calculatedPrice).to.equal(expectedPrice);
  });

  it("Should round up to nearest satoshi", async function () {
    const tokensMinted = 1000;
    await priceOracle.setTokensMinted(tokensMinted);
    
    const price = await priceOracle.getCurrentPrice();
    expect(price).to.be.greaterThan(0);
    // Price should be at least 1 satoshi (100000000 wei)
    expect(price).to.be.at.least(100000000);
  });

  it("Should increase price on activation", async function () {
    const initialPrice = await priceOracle.getCurrentPrice();
    
    await priceOracle.activateToken();
    const newPrice = await priceOracle.getCurrentPrice();
    
    expect(newPrice).to.be.greaterThan(initialPrice);
  });

  it("Should decrease price on deactivation", async function () {
    await priceOracle.activateToken();
    const activatedPrice = await priceOracle.getCurrentPrice();
    
    await priceOracle.deactivateToken();
    const deactivatedPrice = await priceOracle.getCurrentPrice();
    
    expect(deactivatedPrice).to.be.lessThan(activatedPrice);
  });

  it("Should calculate 3% network fee correctly", async function () {
    const amount = 1000;
    const fee = await priceOracle.calculateNetworkFee(amount);
    // Fee should be 3% of 1000 = 30, but rounded up to nearest satoshi = 100000000
    const expectedFee = 100000000;
    
    expect(fee).to.equal(expectedFee);
  });

  it("Should revert if settlement fails", async function () {
    await expect(
      priceOracle.processActivationWithSettlement(false)
    ).to.be.revertedWith("Settlement failed");
  });

  it("Should process activation if settlement succeeds", async function () {
    await expect(
      priceOracle.processActivationWithSettlement(true)
    ).to.not.be.reverted;
  });
});
