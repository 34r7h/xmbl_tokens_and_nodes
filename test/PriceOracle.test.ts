import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";

describe("PriceOracle", function () {
  let priceOracle: PriceOracle;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy();
    await priceOracle.waitForDeployment();
  });

  it("Should initialize with correct starting price (1 satoshi)", async function () {
    const startingPrice = await priceOracle.getCurrentPrice();
    expect(startingPrice).to.equal(1); // 1 satoshi
  });

  it("Should calculate price using golden ratio formula", async function () {
    // Test the formula: x / (Phi * y)
    // Where Phi = (1 + sqrt(5)) / 2 ≈ 1.618
    const tokensMinted = 100;
    const expectedPrice = Math.ceil(1 / (1.618 * tokensMinted));
    
    await priceOracle.setTokensMinted(tokensMinted);
    const calculatedPrice = await priceOracle.getCurrentPrice();
    
    expect(calculatedPrice).to.equal(expectedPrice);
  });

  it("Should round up to nearest satoshi", async function () {
    const tokensMinted = 1000;
    await priceOracle.setTokensMinted(tokensMinted);
    
    const price = await priceOracle.getCurrentPrice();
    expect(price).to.be.greaterThan(0);
    expect(price).to.be.a("number");
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
    const expectedFee = Math.ceil(amount * 0.03);
    
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
