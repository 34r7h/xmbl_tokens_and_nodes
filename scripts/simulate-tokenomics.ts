#!/usr/bin/env node

import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";
import { TokenomicsService } from "../services/TokenomicsService";

interface SimulationResult {
  step: number;
  tokenPrice: number;
  totalDeposited: number;
  tokensMinted: number;
  coinsReleased: number;
  coinsRemaining: number;
  releaseTarget: number;
  canRelease: boolean;
  priceIncrease: number;
}

class TokenomicsSimulation {
  private priceOracle: PriceOracle;
  private tokenomicsService: TokenomicsService;
  private results: SimulationResult[] = [];
  private initialPrice: number = 0;

  constructor(priceOracle: PriceOracle, tokenomicsService: TokenomicsService) {
    this.priceOracle = priceOracle;
    this.tokenomicsService = tokenomicsService;
  }

  async runSimulation(steps: number = 50): Promise<SimulationResult[]> {
    console.log("🚀 Starting XMBL Tokenomics Simulation");
    console.log("=====================================");
    console.log(`📊 Simulating ${steps} token activations...\n`);

    this.results = [];
    this.initialPrice = await this.tokenomicsService.getCurrentPrice();

    for (let step = 1; step <= steps; step++) {
      console.log(`\n🔄 Step ${step}: Activating Token ${step}`);
      
      // Get state before activation
      const stateBefore = await this.tokenomicsService.getTokenomicsState();
      const distributionBefore = await this.tokenomicsService.getCoinDistributionStatus();
      
      // Activate token
      await this.tokenomicsService.activateToken();
      
      // Get state after activation
      const stateAfter = await this.tokenomicsService.getTokenomicsState();
      const distributionAfter = await this.tokenomicsService.getCoinDistributionStatus();
      const currentPrice = await this.tokenomicsService.getCurrentPrice();
      
      // Calculate price increase
      const priceIncrease = step === 1 ? 0 : currentPrice - this.results[step - 2].tokenPrice;
      
      const result: SimulationResult = {
        step,
        tokenPrice: currentPrice,
        totalDeposited: stateAfter.proofOfFaith,
        tokensMinted: stateAfter.xymMinted,
        coinsReleased: stateAfter.xyReleased,
        coinsRemaining: stateAfter.xyRemaining,
        releaseTarget: stateAfter.xyReleaseTarget,
        canRelease: distributionAfter.canReleaseCoins,
        priceIncrease
      };
      
      this.results.push(result);
      
      // Display step results
      this.displayStepResult(result, step);
      
      // Check for coin releases
      if (distributionAfter.canReleaseCoins && !distributionBefore.canReleaseCoins) {
        console.log(`🪙 COIN RELEASE EVENT! Released ${distributionAfter.nextReleaseAmount} coins`);
        console.log(`   Total released: ${stateAfter.xyReleased}`);
        console.log(`   Remaining: ${stateAfter.xyRemaining}`);
      }
      
      // Add delay for readability
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.results;
  }

  private displayStepResult(result: SimulationResult, step: number): void {
    const priceFormatted = (result.tokenPrice / 1e8).toFixed(8);
    const totalFormatted = (result.totalDeposited / 1e8).toFixed(8);
    
    console.log(`   💰 Price: ${priceFormatted} BTC (${result.tokenPrice} sats)`);
    console.log(`   📈 Price increase: +${result.priceIncrease} sats`);
    console.log(`   🏦 Total deposited: ${totalFormatted} BTC`);
    console.log(`   🪙 Tokens minted: ${result.tokensMinted}`);
    console.log(`   🎯 Release target: ${result.releaseTarget} sats`);
    console.log(`   🪙 Coins released: ${result.coinsReleased}`);
    console.log(`   🪙 Coins remaining: ${result.coinsRemaining}`);
    
    if (result.canRelease) {
      console.log(`   ⚡ Can release coins: YES`);
    }
  }

  displaySummary(): void {
    if (this.results.length === 0) return;

    const final = this.results[this.results.length - 1];
    const first = this.results[0];
    
    console.log("\n📊 SIMULATION SUMMARY");
    console.log("====================");
    console.log(`🎯 Total activations: ${final.step}`);
    console.log(`💰 Starting price: ${(first.tokenPrice / 1e8).toFixed(8)} BTC`);
    console.log(`💰 Final price: ${(final.tokenPrice / 1e8).toFixed(8)} BTC`);
    console.log(`📈 Total price increase: ${((final.tokenPrice - first.tokenPrice) / 1e8).toFixed(8)} BTC`);
    console.log(`🏦 Total BTC deposited: ${(final.totalDeposited / 1e8).toFixed(8)} BTC`);
    console.log(`🪙 Total tokens minted: ${final.tokensMinted}`);
    console.log(`🪙 Total coins released: ${final.coinsReleased}`);
    console.log(`🪙 Coins remaining: ${final.coinsRemaining}`);
    console.log(`📊 Coins distribution: ${((final.coinsReleased / 999999999) * 100).toFixed(2)}%`);
    
    // Price progression analysis
    console.log("\n📈 PRICE PROGRESSION ANALYSIS");
    console.log("============================");
    
    const priceIncreases = this.results.slice(1).map(r => r.priceIncrease);
    const avgIncrease = priceIncreases.reduce((a, b) => a + b, 0) / priceIncreases.length;
    const maxIncrease = Math.max(...priceIncreases);
    const minIncrease = Math.min(...priceIncreases.filter(x => x > 0));
    
    console.log(`📊 Average price increase: ${avgIncrease.toFixed(0)} sats`);
    console.log(`📊 Maximum price increase: ${maxIncrease} sats`);
    console.log(`📊 Minimum price increase: ${minIncrease} sats`);
    
    // Coin release analysis
    const coinReleaseSteps = this.results.filter(r => r.canRelease);
    if (coinReleaseSteps.length > 0) {
      console.log(`\n🪙 COIN RELEASE ANALYSIS`);
      console.log("=======================");
      console.log(`🎯 First coin release at step: ${coinReleaseSteps[0].step}`);
      console.log(`💰 Price at first release: ${(coinReleaseSteps[0].tokenPrice / 1e8).toFixed(8)} BTC`);
      console.log(`📊 Total coin release events: ${coinReleaseSteps.length}`);
    }
  }

  generateCSV(): string {
    const headers = [
      'Step',
      'Token Price (sats)',
      'Token Price (BTC)',
      'Price Increase (sats)',
      'Total Deposited (sats)',
      'Total Deposited (BTC)',
      'Tokens Minted',
      'Coins Released',
      'Coins Remaining',
      'Release Target (sats)',
      'Can Release Coins'
    ].join(',');
    
    const rows = this.results.map(r => [
      r.step,
      r.tokenPrice,
      (r.tokenPrice / 1e8).toFixed(8),
      r.priceIncrease,
      r.totalDeposited,
      (r.totalDeposited / 1e8).toFixed(8),
      r.tokensMinted,
      r.coinsReleased,
      r.coinsRemaining,
      r.releaseTarget,
      r.canRelease ? 'YES' : 'NO'
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔮 XMBL Tokenomics Simulation");
  console.log("===============================");
  console.log(`Using account: ${deployer.address}\n`);

  // Deploy fresh PriceOracle for simulation
  const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracleFactory.deploy(
    "0x0000000000000000000000000000000000000000", // Mock Pyth address
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // Mock BTC/USD price feed ID
  );
  await priceOracle.waitForDeployment();

  const tokenomicsService = new TokenomicsService(
    await priceOracle.getAddress(),
    deployer.provider,
    deployer
  );

  // Get simulation parameters
  const steps = parseInt(process.argv[2]) || 50;
  const outputCSV = process.argv.includes('--csv');
  
  console.log(`📊 Simulation parameters:`);
  console.log(`   Steps: ${steps}`);
  console.log(`   CSV output: ${outputCSV ? 'Yes' : 'No'}\n`);

  // Run simulation
  const simulation = new TokenomicsSimulation(priceOracle, tokenomicsService);
  const results = await simulation.runSimulation(steps);
  
  // Display summary
  simulation.displaySummary();
  
  // Generate CSV if requested
  if (outputCSV) {
    const csv = simulation.generateCSV();
    const fs = require('fs');
    const filename = `tokenomics-simulation-${Date.now()}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`\n📄 CSV exported to: ${filename}`);
  }

  console.log("\n✅ Simulation completed successfully!");
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error("❌ Simulation error:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
