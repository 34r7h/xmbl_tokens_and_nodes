#!/usr/bin/env node

import { ethers } from "hardhat";
import { PriceOracle } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔍 Debugging XMBL Tokenomics");
  console.log("=============================");

  // Deploy fresh PriceOracle for debugging
  const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracleFactory.deploy(
    "0x0000000000000000000000000000000000000000", // Mock Pyth address
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // Mock BTC/USD price feed ID
  );
  await priceOracle.waitForDeployment();

  console.log("📊 Initial State:");
  const initialState = await priceOracle.getTokenomicsState();
  console.log(`   xymNextPrice: ${initialState[2]}`);
  console.log(`   xymMinted: ${initialState[1]}`);
  console.log(`   GROWTH_FACTOR: 1618`);
  
  // Calculate what the price increase should be
  const cost = Number(initialState[2]);
  const xymMinted = Number(initialState[1]);
  const growthFactor = 1618;
  const growthMultiplier = growthFactor * (xymMinted + 1);
  const priceIncrease = Math.floor(cost / growthMultiplier);
  const newPrice = cost + priceIncrease;
  
  console.log(`\n🧮 Manual Calculation for Token ${xymMinted + 1}:`);
  console.log(`   cost: ${cost}`);
  console.log(`   growthMultiplier: ${growthMultiplier}`);
  console.log(`   priceIncrease: ${priceIncrease}`);
  console.log(`   newPrice: ${newPrice}`);
  
  // Activate a token
  console.log(`\n🔄 Activating Token ${xymMinted + 1}...`);
  await priceOracle.activateToken();
  
  const stateAfter = await priceOracle.getTokenomicsState();
  console.log(`\n📊 After Activation:`);
  console.log(`   xymNextPrice: ${stateAfter[2]}`);
  console.log(`   xymMinted: ${stateAfter[1]}`);
  console.log(`   proofOfFaith: ${stateAfter[0]}`);
  
  // Activate a few more to see the pattern
  console.log(`\n🔄 Activating 5 more tokens...`);
  for (let i = 0; i < 5; i++) {
    const beforeState = await priceOracle.getTokenomicsState();
    await priceOracle.activateToken();
    const afterState = await priceOracle.getTokenomicsState();
    
    const priceIncrease = Number(afterState[2]) - Number(beforeState[2]);
    console.log(`   Token ${Number(afterState[1])}: ${Number(afterState[2])} sats (+${priceIncrease})`);
  }
  
  console.log("\n✅ Debug completed!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
