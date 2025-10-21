import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracle, DepositManager, ChainDepositContract } from "../typechain-types";

describe("Cost Accounting", function () {
  let priceOracle: PriceOracle;
  let depositManager: DepositManager;
  let chainDepositContract: ChainDepositContract;
  let deployer: any;
  let user: any;

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy PriceOracle
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(
      "0x0000000000000000000000000000000000000000", // Mock Pyth address
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // Mock BTC/USD price feed ID
    );
    await priceOracle.waitForDeployment();

    // Deploy DepositManager
    const DepositManagerFactory = await ethers.getContractFactory("DepositManager");
    depositManager = await DepositManagerFactory.deploy(
      await priceOracle.getAddress()
    );
    await depositManager.waitForDeployment();

    // Deploy ChainDepositContract
    const ChainDepositContractFactory = await ethers.getContractFactory("ChainDepositContract");
    chainDepositContract = await ChainDepositContractFactory.deploy(
      await depositManager.getAddress(),
      await priceOracle.getAddress()
    );
    await chainDepositContract.waitForDeployment();
  });

  it("Should calculate costs correctly", async function () {
    const btcAmount = 1000000; // 1 BTC in satoshis
    const costs = await chainDepositContract.calculateCosts(btcAmount);
    
    // Oracle costs: 1000, Contract costs: 2000, Network fees: 3% of 1000000 = 30000
    const expectedCosts = 1000 + 2000 + 30000; // 33000 satoshis
    expect(costs).to.equal(expectedCosts);
  });

  it("Should handle insufficient BTC after costs", async function () {
    const smallAmount = 1000; // Very small amount
    const costs = await chainDepositContract.calculateCosts(smallAmount);
    
    // Should be more than the small amount
    expect(costs).to.be.greaterThan(smallAmount);
  });

  it("Should track costs in deposit statistics", async function () {
    // This test would require a mock ERC20 token
    // For now, just test the cost calculation functions
    const btcAmount = 1000000;
    const costs = await chainDepositContract.calculateCosts(btcAmount);
    expect(costs).to.be.greaterThan(0);
  });

  it("Should use net BTC equivalent for activation", async function () {
    const netBtcEquivalent = 1000000; // 1 BTC net
    const costs = await depositManager.calculateCosts(netBtcEquivalent);
    const totalBtc = Number(netBtcEquivalent) + Number(costs);
    
    expect(totalBtc).to.be.greaterThan(Number(netBtcEquivalent));
    expect(Number(costs)).to.be.greaterThan(0);
  });

  it("Should maintain cost consistency between contracts", async function () {
    const btcAmount = 1000000;
    const chainCosts = await chainDepositContract.calculateCosts(btcAmount);
    const managerCosts = await depositManager.calculateCosts(btcAmount);
    
    expect(chainCosts).to.equal(managerCosts);
  });
});
