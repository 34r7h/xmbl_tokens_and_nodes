#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import { config } from 'dotenv';
import { BTCConversionService } from '../services/BTCConversionService';

config();

/**
 * @title Simple Simulation Script
 * @dev Simulates the XMBL token activation workflow components
 */
async function main() {
  const args = process.argv.slice(2);
  const simulationType = args[0] || 'all';

  console.log(`🚀 XMBL Token Activation Simulation`);
  console.log(`Type: ${simulationType}`);
  console.log('=' .repeat(50));

  try {
    switch (simulationType) {
      case 'all':
        await runAllSimulations();
        break;
      case 'conversion':
        await runConversionSimulation();
        break;
      case 'costs':
        await runCostSimulation();
        break;
      case 'pricing':
        await runPricingSimulation();
        break;
      default:
        console.log('Available simulation types:');
        console.log('  all       - Run all simulations');
        console.log('  conversion - BTC conversion and pool split');
        console.log('  costs     - Cost accounting');
        console.log('  pricing   - Token pricing algorithm');
        break;
    }

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

async function runAllSimulations() {
  console.log('\n🎯 Running All Simulations');
  console.log('=' .repeat(30));

  await runConversionSimulation();
  await runCostSimulation();
  await runPricingSimulation();

  console.log('\n✅ All simulations completed successfully!');
}

async function runConversionSimulation() {
  console.log('\n🔄 BTC Conversion Simulation');
  console.log('=' .repeat(40));

  const btcConversionService = new BTCConversionService(
    new ethers.JsonRpcProvider('http://localhost:8545'),
    '0x1234567890123456789012345678901234567890',
    {
      developmentPoolAddress: '0x1111111111111111111111111111111111111111',
      liquidityPoolAddress: '0x2222222222222222222222222222222222222222',
      minLiquidityPercentage: 10,
      maxLiquidityPercentage: 95,
      targetBTCForMaxLiquidity: 100
    }
  );

  // Simulate different BTC amounts in system
  const testAmounts = [0, 1, 5, 10, 25, 50, 75, 100, 150]; // BTC amounts

  console.log('\n📊 Liquidity Pool Percentage vs BTC in System:');
  console.log('BTC Amount | Liquidity % | Development %');
  console.log('-'.repeat(45));

  for (const btcAmount of testAmounts) {
    const btcSats = btcAmount * 1e8;
    
    const liquidityPercentage = btcConversionService.calculateLiquidityPercentage(btcSats);
    const developmentPercentage = btcConversionService.calculateDevelopmentPercentage(btcSats);
    
    console.log(`${btcAmount.toString().padStart(10)} | ${(liquidityPercentage * 100).toFixed(2).padStart(10)}% | ${(developmentPercentage * 100).toFixed(2).padStart(12)}%`);
  }

  // Test actual conversion
  console.log('\n💰 Testing BTC Conversion:');
  const testBtcAmount = 10 * 1e8; // 10 BTC in satoshis
  const result = await btcConversionService.processBTCConversion(
    '0x1234567890123456789012345678901234567890',
    testBtcAmount,
    1
  );

  if (result.success) {
    console.log(`✅ Conversion successful:`);
    console.log(`  Development Pool: ${(result.developmentSats / 1e8).toFixed(8)} BTC`);
    console.log(`  Liquidity Pool: ${(result.liquiditySats / 1e8).toFixed(8)} BTC`);
    console.log(`  Net BTC for Activation: ${(result.netBTCForActivation / 1e8).toFixed(8)} BTC`);
    console.log(`  Costs: ${JSON.stringify(result.costs)}`);
  } else {
    console.log(`❌ Conversion failed`);
  }
}

async function runCostSimulation() {
  console.log('\n💸 Cost Accounting Simulation');
  console.log('=' .repeat(40));

  // Simulate different deposit amounts and their costs
  const testAmounts = [
    { name: 'Small', amount: 1000000 }, // 0.01 BTC
    { name: 'Medium', amount: 100000000 }, // 1 BTC  
    { name: 'Large', amount: 1000000000 }, // 10 BTC
    { name: 'Very Large', amount: 10000000000 } // 100 BTC
  ];

  console.log('\n📊 Cost Breakdown by Deposit Size:');
  console.log('Size       | BTC Amount | Oracle | Contract | Network | Total   | Net BTC');
  console.log('-'.repeat(75));

  for (const test of testAmounts) {
    const btcAmount = test.amount;
    
    // Calculate costs (matching contract logic)
    const oracleCosts = 1000; // Base oracle cost
    const contractCosts = 2000; // Base contract cost
    const networkFees = Math.ceil((btcAmount * 3) / 100); // 3% network fee, rounded up
    const totalCosts = oracleCosts + contractCosts + networkFees;
    const netBtc = btcAmount > totalCosts ? btcAmount - totalCosts : 0;

    console.log(
      `${test.name.padStart(10)} | ${(btcAmount / 1e8).toFixed(8).padStart(10)} | ${oracleCosts.toString().padStart(6)} | ${contractCosts.toString().padStart(8)} | ${networkFees.toString().padStart(6)} | ${totalCosts.toString().padStart(7)} | ${(netBtc / 1e8).toFixed(8).padStart(8)}`
    );
  }

  console.log('\n✅ Cost accounting simulation completed');
  console.log('Note: All costs are in satoshis, rounded up to nearest satoshi');
}

async function runPricingSimulation() {
  console.log('\n💰 Token Pricing Algorithm Simulation');
  console.log('=' .repeat(45));

  // Simulate XMBL token pricing using golden ratio formula
  const PHI = 1.618033988749895; // Golden ratio
  const STARTING_PRICE = 1; // 1 satoshi

  console.log('\n📈 XMBL Token Price Progression:');
  console.log('Tokens Minted | Price (sats) | Price (BTC)');
  console.log('-'.repeat(45));

  const tokenAmounts = [1, 10, 100, 1000, 10000, 100000, 1000000];

  for (const tokensMinted of tokenAmounts) {
    // Price formula: x / (Phi * y) where x=Token Price, y=Tokens Minted
    const price = Math.ceil(STARTING_PRICE / (PHI * tokensMinted));
    const priceBtc = price / 1e8;
    
    console.log(
      `${tokensMinted.toString().padStart(12)} | ${price.toString().padStart(11)} | ${priceBtc.toFixed(8).padStart(10)}`
    );
  }

  console.log('\n📊 Price Increase on Activation:');
  let currentPrice = STARTING_PRICE;
  console.log('Activation | Price Before | Price After | Increase');
  console.log('-'.repeat(50));

  for (let i = 1; i <= 10; i++) {
    const priceBefore = currentPrice;
    // Simulate price increase (simplified)
    currentPrice = Math.ceil(currentPrice * 1.1); // 10% increase
    const increase = ((currentPrice - priceBefore) / priceBefore * 100).toFixed(2);
    
    console.log(
      `${i.toString().padStart(10)} | ${priceBefore.toString().padStart(11)} | ${currentPrice.toString().padStart(10)} | ${increase.padStart(7)}%`
    );
  }

  console.log('\n✅ Pricing algorithm simulation completed');
  console.log('Note: All prices rounded up to nearest satoshi as required');
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as simulation };
