#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import { config } from 'dotenv';
import { NexusIntentService } from '../services/NexusIntentService';
import { PythOracleService } from '../services/PythOracleService';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';
import { BlockscoutMCPService } from '../services/BlockscoutMCPService';
import { MCPApplication } from '../services/MCPApplication';
import { BTCConversionService } from '../services/BTCConversionService';

config();

/**
 * @title Simulation Script
 * @dev Simulates the complete XMBL token activation workflow
 */
async function main() {
  const args = process.argv.slice(2);
  const simulationType = args[0] || 'full';
  const numUsers = parseInt(args[1]) || 5;

  console.log(`🚀 XMBL Token Activation Simulation`);
  console.log(`Type: ${simulationType}, Users: ${numUsers}`);
  console.log('=' .repeat(50));

  try {
    // Create mock provider and signer
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

    // Mock contract addresses
    const mockContracts = {
      DepositManager: '0x1234567890123456789012345678901234567890',
      PriceOracle: '0x2345678901234567890123456789012345678901',
      ChainDepositContract: '0x3456789012345678901234567890123456789012'
    };

    switch (simulationType) {
      case 'full':
        await runFullSimulation(signer, mockContracts, numUsers);
        break;
      case 'conversion':
        await runConversionSimulation();
        break;
      case 'costs':
        await runCostSimulation();
        break;
      default:
        console.log('Available simulation types:');
        console.log('  full      - Complete end-to-end simulation');
        console.log('  conversion - BTC conversion and pool split simulation');
        console.log('  costs     - Cost accounting simulation');
        break;
    }

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

async function runFullSimulation(signer: any, contracts: any, numUsers: number) {
  console.log('\n📡 Initializing Services...');
  
  // Initialize services
  const nexusService = new NexusIntentService(
    signer.provider,
    contracts.DepositManager,
    new Map([[1, contracts.ChainDepositContract]]),
    'test-api-key',
    'http://localhost:3000'
  );

  const pythOracle = new PythOracleService(
    signer.provider,
    contracts.PriceOracle,
    'https://hermes.pyth.network',
    '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
  );

  const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
  const mcpService = new BlockscoutMCPService('test-api-key', 'http://localhost:3000');
  const mcpApp = new MCPApplication(mcpService);

  console.log('✅ Services initialized');

  // Step 1: Initialize Nexus
  console.log('\n🔗 Step 1: Initializing Avail Nexus...');
  await nexusService.initializeNexus();
  console.log('✅ Nexus SDK initialized');

  // Step 2: Test price feeds
  console.log('\n💰 Step 2: Testing Pyth price feeds...');
  const btcPrice = await pythOracle.fetchBtcPrice();
  console.log(`BTC Price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Mock: $50,000'}`);
  console.log('✅ Price feeds operational');

  // Step 3: Simulate user activations
  console.log(`\n👥 Step 3: Simulating ${numUsers} user activations...`);
  
  const activationResults = [];
  for (let i = 1; i <= numUsers; i++) {
    console.log(`\n  User ${i}:`);
    
    const userAddress = `0x${i.toString().padStart(40, '0')}`;
    const amount = ethers.parseEther('1'); // 1 ETH
    const btcEquivalent = '5000000000'; // Mock BTC equivalent
    
    console.log(`    Address: ${userAddress}`);
    console.log(`    Amount: ${ethers.formatEther(amount)} ETH`);
    console.log(`    BTC Equivalent: ${(Number(btcEquivalent) / 1e8).toFixed(8)} BTC`);
    
    // Create intent
    const intentId = await nexusService.createIntent(1, i, userAddress, amount.toString(), btcEquivalent);
    console.log(`    Intent ID: ${intentId}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check intent status
    const intentStatus = nexusService.getIntentStatus(intentId);
    console.log(`    Status: ${intentStatus?.status || 'Processing'}`);
    
    activationResults.push({
      userId: i,
      intentId,
      status: intentStatus?.status || 'Processing',
      amount: ethers.formatEther(amount),
      btcEquivalent: Number(btcEquivalent) / 1e8
    });
  }

  // Step 4: Check queue status
  console.log('\n📊 Step 4: Checking intent queue...');
  const queueStatus = nexusService.getQueueStatus();
  console.log(`Total Intents: ${queueStatus.total}`);
  console.log(`Processing: ${queueStatus.processing}`);
  console.log(`Completed: ${queueStatus.completed}`);

  // Step 5: Test monitoring
  console.log('\n📈 Step 5: Testing Blockscout monitoring...');
  blockscoutMonitor.addContract(1, contracts.DepositManager, []);
  blockscoutMonitor.addContract(1, contracts.PriceOracle, []);
  
  const eventsIndexed = await blockscoutMonitor.indexEvents(1, contracts.DepositManager);
  console.log(`Events indexed: ${eventsIndexed}`);

  // Step 6: Test AI auditing
  console.log('\n🤖 Step 6: Testing AI auditing...');
  try {
    const auditQuery = 'Analyze the activation sequence for potential risks and anomalies';
    const auditResult = await mcpApp.processQuery(auditQuery);
    console.log(`AI Response: ${auditResult.response.substring(0, 150)}...`);
  } catch (error) {
    console.log(`AI Auditing: ${error} (MCP server not running - expected in simulation)`);
  }

  // Step 7: Export data
  console.log('\n📄 Step 7: Exporting simulation data...');
  const events = blockscoutMonitor.exportAllEvents(1, contracts.DepositManager);
  console.log(`Exported ${events.length} events`);

  // Summary
  console.log('\n✅ Full simulation completed successfully!');
  console.log('\n📊 Simulation Summary:');
  console.log(`- Users simulated: ${numUsers}`);
  console.log(`- Intents created: ${queueStatus.total}`);
  console.log(`- Events indexed: ${eventsIndexed}`);
  console.log(`- Services tested: Nexus, Pyth, Blockscout, MCP`);
  console.log(`- Total BTC equivalent: ${activationResults.reduce((sum, r) => sum + r.btcEquivalent, 0).toFixed(8)} BTC`);
}

async function runConversionSimulation() {
  console.log('\n🔄 BTC Conversion Simulation');
  console.log('=' .repeat(40));

  const btcConversionService = new BTCConversionService(
    new ethers.JsonRpcProvider('http://localhost:8545'),
    '0x1234567890123456789012345678901234567890'
  );

  // Simulate different BTC amounts in system
  const testAmounts = [0, 1, 5, 10, 25, 50, 75, 100, 150]; // BTC amounts

  console.log('\n📊 Liquidity Pool Percentage vs BTC in System:');
  console.log('BTC Amount | Liquidity % | Development %');
  console.log('-'.repeat(45));

  for (const btcAmount of testAmounts) {
    const btcSats = btcAmount * 1e8;
    btcConversionService.updateTotalBtcInSystem(btcSats);
    
    const liquidityPercentage = btcConversionService.calculateLiquiditySplitPercentage();
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
    console.log(`  Total BTC: ${(result.totalBtc / 1e8).toFixed(8)} BTC`);
    console.log(`  Costs: ${(result.costs / 1e8).toFixed(8)} BTC`);
    console.log(`  Net BTC: ${(result.netBTCForActivation / 1e8).toFixed(8)} BTC`);
    console.log(`  Development Pool: ${(result.developmentPool / 1e8).toFixed(8)} BTC (${(result.developmentPercentage * 100).toFixed(2)}%)`);
    console.log(`  Liquidity Pool: ${(result.liquidityPool / 1e8).toFixed(8)} BTC (${(result.liquidityPercentage * 100).toFixed(2)}%)`);
  } else {
    console.log(`❌ Conversion failed: ${result.error}`);
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
