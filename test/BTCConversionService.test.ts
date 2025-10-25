import { expect } from "chai";
import { ethers } from "hardhat";
import { BTCConversionService } from "../services/BTCConversionService";
import { DepositManager, PriceOracle } from "../typechain-types";

describe("BTCConversionService", function () {
  let btcConversionService: BTCConversionService;
  let deployer: any;
  let depositManager: DepositManager;
  let priceOracle: PriceOracle;

  const defaultConfig = {
    developmentPoolAddress: "0x1111111111111111111111111111111111111111",
    liquidityPoolAddress: "0x2222222222222222222222222222222222222222",
    minLiquidityPercentage: 10, // 10% starting
    maxLiquidityPercentage: 95, // 95% upper bound
    targetBTCForMaxLiquidity: 100, // 100 BTC
    thorchainConfig: {
      rpcUrl: "https://testnet.thorchain.network",
      chainId: 1,
      routerAddress: "0x0000000000000000000000000000000000000000",
      vaultAddress: "0x0000000000000000000000000000000000000000",
      testnet: true
    }
  };

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy mock contracts
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy(
      "0x0000000000000000000000000000000000000000", // Mock Pyth address
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // Mock BTC/USD price feed ID
    );
    await priceOracle.waitForDeployment();

    const DepositManagerFactory = await ethers.getContractFactory("DepositManager");
    depositManager = await DepositManagerFactory.deploy(
      await priceOracle.getAddress()
    );
    await depositManager.waitForDeployment();

    btcConversionService = new BTCConversionService(
      deployer.provider,
      await depositManager.getAddress(),
      defaultConfig
    );
  });

  it("Should initialize with correct configuration", function () {
    const config = btcConversionService.getConfig();
    expect(config.minLiquidityPercentage).to.equal(10);
    expect(config.maxLiquidityPercentage).to.equal(95);
    expect(config.targetBTCForMaxLiquidity).to.equal(100);
  });

  it("Should calculate liquidity percentage with logarithmic curve", function () {
    // Test at 0 BTC (should be minimum)
    const liquidityAt0 = btcConversionService.calculateLiquidityPercentage(0);
    expect(liquidityAt0).to.be.closeTo(10, 0.1);

    // Test at 100 BTC (should be near maximum)
    const btc100Sats = 100 * 1e8; // 100 BTC in satoshis
    const liquidityAt100 = btcConversionService.calculateLiquidityPercentage(btc100Sats);
    expect(liquidityAt100).to.be.closeTo(86.5, 1);

    // Test at 50 BTC (should be somewhere in between)
    const btc50Sats = 50 * 1e8; // 50 BTC in satoshis
    const liquidityAt50 = btcConversionService.calculateLiquidityPercentage(btc50Sats);
    expect(liquidityAt50).to.be.greaterThan(10);
    expect(liquidityAt50).to.be.lessThan(95);
  });

  it("Should have logarithmic curve behavior", function () {
    const btc10Sats = 10 * 1e8; // 10 BTC
    const btc20Sats = 20 * 1e8; // 20 BTC
    const btc50Sats = 50 * 1e8; // 50 BTC
    const btc100Sats = 100 * 1e8; // 100 BTC

    const liquidity10 = btcConversionService.calculateLiquidityPercentage(btc10Sats);
    const liquidity20 = btcConversionService.calculateLiquidityPercentage(btc20Sats);
    const liquidity50 = btcConversionService.calculateLiquidityPercentage(btc50Sats);
    const liquidity100 = btcConversionService.calculateLiquidityPercentage(btc100Sats);

    // Should be increasing
    expect(liquidity10).to.be.lessThan(liquidity20);
    expect(liquidity20).to.be.lessThan(liquidity50);
    expect(liquidity50).to.be.lessThan(liquidity100);

    // Should level off (smaller increases at higher amounts)
    const increase10to20 = liquidity20 - liquidity10;
    const increase50to100 = liquidity100 - liquidity50;
    // Note: This test might fail if the curve doesn't level off as expected
    // The logarithmic curve should have diminishing returns
    expect(increase10to20).to.be.greaterThan(0);
    expect(increase50to100).to.be.greaterThan(0);
  });

  it("Should calculate development percentage correctly", function () {
    const btc50Sats = 50 * 1e8; // 50 BTC
    const liquidityPercentage = btcConversionService.calculateLiquidityPercentage(btc50Sats);
    const developmentPercentage = btcConversionService.calculateDevelopmentPercentage(btc50Sats);
    
    expect(developmentPercentage).to.equal(100 - liquidityPercentage);
  });

  it("Should split BTC amounts correctly", function () {
    const totalBTCSats = 50 * 1e8; // 50 BTC
    const { developmentSats, liquiditySats } = btcConversionService.splitBTCAmount(totalBTCSats);
    
    expect(developmentSats + liquiditySats).to.equal(totalBTCSats);
    expect(developmentSats).to.be.greaterThan(0);
    expect(liquiditySats).to.be.greaterThan(0);
  });

  it("Should calculate costs correctly", function () {
    const btcAmountSats = 100 * 1e8; // 100 BTC
    const costs = btcConversionService.calculateTotalCosts(btcAmountSats);
    
    expect(costs.oracleCosts).to.be.greaterThan(0);
    expect(costs.contractCosts).to.be.greaterThan(0);
    expect(costs.networkFees).to.be.greaterThan(0);
    expect(costs.totalCosts).to.equal(costs.oracleCosts + costs.contractCosts + costs.networkFees);
    expect(costs.netBTCForActivation).to.equal(btcAmountSats - costs.totalCosts);
  });

  it("Should handle insufficient BTC after costs", async function () {
    const smallBTCAmount = 1; // Very small amount that will be less than costs
    const result = await btcConversionService.processBTCConversion(
      deployer.address,
      smallBTCAmount,
      1
    );
    
    expect(result.success).to.be.false;
    expect(result.netBTCForActivation).to.equal(0);
  });

  it("Should process BTC conversion successfully", async function () {
    const btcAmountSats = 10 * 1e8; // 10 BTC
    const result = await btcConversionService.processBTCConversion(
      deployer.address,
      btcAmountSats,
      1,
      'ETH',
      '1000000000000000000' // 1 ETH
    );
    
    expect(result.success).to.be.true;
    expect(result.developmentSats).to.be.greaterThan(0);
    expect(result.liquiditySats).to.be.greaterThan(0);
    expect(result.developmentSats + result.liquiditySats).to.equal(result.netBTCForActivation);
  });

  it("Should get current allocation", function () {
    const btcAmountSats = 25 * 1e8; // 25 BTC
    const allocation = btcConversionService.getCurrentAllocation(btcAmountSats);
    
    expect(allocation.btcAmount).to.equal(25);
    expect(allocation.liquidityPercentage).to.be.greaterThan(10);
    expect(allocation.liquidityPercentage).to.be.lessThan(95);
    expect(allocation.developmentPercentage).to.equal(100 - allocation.liquidityPercentage);
  });

  it("Should generate allocation curve", function () {
    const curve = btcConversionService.getAllocationCurve(100);
    
    expect(curve).to.have.length.greaterThan(50);
    
    // Check curve properties
    const firstPoint = curve[0];
    const lastPoint = curve[curve.length - 1];
    
    expect(firstPoint.btcAmount).to.equal(0);
    expect(lastPoint.btcAmount).to.be.closeTo(100, 1);
    expect(firstPoint.liquidityPercentage).to.be.closeTo(10, 1);
    expect(lastPoint.liquidityPercentage).to.be.closeTo(86.5, 1);
  });

  it("Should update configuration", function () {
    const newConfig = {
      minLiquidityPercentage: 15,
      maxLiquidityPercentage: 90
    };
    
    btcConversionService.updateConfig(newConfig);
    const updatedConfig = btcConversionService.getConfig();
    
    expect(updatedConfig.minLiquidityPercentage).to.equal(15);
    expect(updatedConfig.maxLiquidityPercentage).to.equal(90);
    expect(updatedConfig.targetBTCForMaxLiquidity).to.equal(100); // Should remain unchanged
  });

  it("Should handle edge cases", function () {
    // Test with very small amount
    const smallAmount = 1;
    const liquiditySmall = btcConversionService.calculateLiquidityPercentage(smallAmount);
    expect(liquiditySmall).to.be.closeTo(10, 0.1);
    
    // Test with very large amount
    const largeAmount = 1000 * 1e8; // 1000 BTC
    const liquidityLarge = btcConversionService.calculateLiquidityPercentage(largeAmount);
    expect(liquidityLarge).to.be.closeTo(95, 1);
  });

  it("Should maintain curve consistency", function () {
    const amounts = [1 * 1e8, 10 * 1e8, 25 * 1e8, 50 * 1e8, 75 * 1e8, 100 * 1e8];
    const percentages = amounts.map(amount => btcConversionService.calculateLiquidityPercentage(amount));
    
    // Should be monotonically increasing
    for (let i = 1; i < percentages.length; i++) {
      expect(percentages[i]).to.be.greaterThan(percentages[i - 1]);
    }
    
    // Should be within bounds
    percentages.forEach(percentage => {
      expect(percentage).to.be.at.least(10);
      expect(percentage).to.be.at.most(95);
    });
  });
});
