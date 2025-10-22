#!/usr/bin/env node

import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";
import { TokenomicsService } from "../services/TokenomicsService";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🚀 XMBL Tokenomics Quick Demo");
  console.log("=============================");

  // Deploy fresh PriceOracle
  const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracleFactory.deploy(
    "0x0000000000000000000000000000000000000000",
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  );
  await priceOracle.waitForDeployment();

  const tokenomicsService = new TokenomicsService(
    await priceOracle.getAddress(),
    deployer.provider,
    deployer
  );

  console.log("📊 Initial State:");
  const initialState = await tokenomicsService.getTokenomicsState();
  console.log(`   Price: ${initialState.xymNextPrice} sats`);
  console.log(`   Tokens: ${initialState.xymMinted}`);
  console.log(`   Coins: ${initialState.xyRemaining}`);

  console.log("\n🔄 Activating 10 tokens...\n");

  for (let i = 1; i <= 10; i++) {
    const before = await tokenomicsService.getTokenomicsState();
    await tokenomicsService.activateToken();
    const after = await tokenomicsService.getTokenomicsState();
    
    const priceIncrease = after.xymNextPrice - before.xymNextPrice;
    const coinsReleased = after.xyReleased - before.xyReleased;
    
    console.log(`Token ${i}:`);
    console.log(`   💰 Price: ${(after.xymNextPrice / 1e8).toFixed(8)} BTC (${after.xymNextPrice} sats)`);
    console.log(`   📈 Increase: +${priceIncrease} sats`);
    console.log(`   🏦 Total deposited: ${(after.proofOfFaith / 1e8).toFixed(8)} BTC`);
    console.log(`   🪙 Coins released: ${coinsReleased > 0 ? coinsReleased : 'None'}`);
    console.log(`   🪙 Remaining: ${after.xyRemaining}`);
    console.log("");
  }

  console.log("✅ Demo completed!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
