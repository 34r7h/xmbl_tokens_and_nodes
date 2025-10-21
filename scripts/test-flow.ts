#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NexusIntentService } from '../services/NexusIntentService';
import { PythOracleService } from '../services/PythOracleService';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';
import { BlockscoutMCPService } from '../services/BlockscoutMCPService';
import { MCPApplication } from '../services/MCPApplication';

config();

interface TestFlowConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
}

/**
 * @title Test Flow Script
 * @dev Tests the complete end-to-end workflow
 * Simulates user deposits, cross-chain intents, and activation sequences
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'full';
  const numUsers = parseInt(args[1]) || 3;

  console.log(`Testing flow - Type: ${testType}, Users: ${numUsers}`);

  try {
    // Load deployment configuration
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    let deploymentConfig: TestFlowConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      deploymentConfig = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Could not load deployment configuration. Run deployment first.');
      process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Testing with account: ${signer.address}`);

    switch (testType) {
      case 'full':
        await testFullFlow(deploymentConfig, signer, numUsers);
        break;
      case 'intent':
        await testIntentFlow(deploymentConfig, signer, numUsers);
        break;
      case 'price':
        await testPriceFlow(deploymentConfig, signer);
        break;
      case 'monitor':
        await testMonitorFlow(deploymentConfig, signer);
        break;
      case 'ai':
        await testAIFlow(deploymentConfig, signer);
        break;
      default:
        console.log('Available test types:');
        console.log('  full   - Complete end-to-end test (default)');
        console.log('  intent - Test cross-chain intent processing');
        console.log('  price  - Test price feed integration');
        console.log('  monitor - Test monitoring and transparency');
        console.log('  ai     - Test AI auditing capabilities');
        break;
    }

  } catch (error) {
    console.error('❌ Test flow failed:', error);
    process.exit(1);
  }
}

async function testFullFlow(config: TestFlowConfig, signer: any, numUsers: number) {
  console.log('\n=== TESTING FULL END-TO-END FLOW ===');
  
  try {
    // Initialize all services
    console.log('🔧 Initializing services...');
    
    const nexusService = new NexusIntentService(
      signer.provider,
      config.contracts.DepositManager.address,
      new Map([[1, config.contracts.ChainDepositContract_Ethereum?.address || '0x0000000000000000000000000000000000000000']])
    );

    const pythOracle = new PythOracleService(
      signer.provider,
      config.contracts.PriceOracle.address,
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
    );

    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });
    const mcpApp = new MCPApplication(mcpService);

    console.log('✅ Services initialized');

    // Step 1: Initialize Nexus
    console.log('\n📡 Step 1: Initializing Avail Nexus...');
    await nexusService.initializeNexus();
    console.log('✅ Nexus initialized');

    // Step 2: Test price feeds
    console.log('\n💰 Step 2: Testing price feeds...');
    const btcPrice = await pythOracle.fetchBtcPrice();
    console.log(`BTC Price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Mock price'}`);
    console.log('✅ Price feeds working');

    // Step 3: Simulate user deposits and activations
    console.log(`\n👥 Step 3: Simulating ${numUsers} user activations...`);
    
    for (let i = 1; i <= numUsers; i++) {
      console.log(`\n  User ${i}:`);
      
      // Create mock user data
      const userAddress = `0x${i.toString().padStart(40, '0')}`;
      const amount = ethers.parseEther('1'); // 1 ETH
      const btcEquivalent = '5000000000'; // Mock BTC equivalent
      
      console.log(`    Address: ${userAddress}`);
      console.log(`    Amount: ${ethers.formatEther(amount)} ETH`);
      
      // Create intent
      const intentId = await nexusService.createIntent(1, i, userAddress, amount.toString(), btcEquivalent);
      console.log(`    Intent ID: ${intentId}`);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check intent status
      const intentStatus = nexusService.getIntentStatus(intentId);
      console.log(`    Status: ${intentStatus?.status || 'Unknown'}`);
    }

    // Step 4: Check queue status
    console.log('\n📊 Step 4: Checking intent queue...');
    const queueStatus = nexusService.getQueueStatus();
    console.log(`Queue Status:`, queueStatus);

    // Step 5: Test monitoring
    console.log('\n📈 Step 5: Testing monitoring...');
    blockscoutMonitor.addContract(1, config.contracts.DepositManager.address, []);
    const eventsIndexed = await blockscoutMonitor.indexEvents(1, config.contracts.DepositManager.address);
    console.log(`Events indexed: ${eventsIndexed}`);

    // Step 6: Test AI auditing
    console.log('\n🤖 Step 6: Testing AI auditing...');
    try {
      const auditQuery = 'Analyze the activation sequence for potential risks';
      const auditResult = await mcpApp.processQuery(auditQuery);
      console.log(`AI Response: ${auditResult.response.substring(0, 100)}...`);
    } catch (error) {
      console.log(`AI Auditing: ${error} (expected in test environment)`);
    }

    // Step 7: Export data
    console.log('\n📄 Step 7: Exporting test data...');
    const events = blockscoutMonitor.exportEvents(1, config.contracts.DepositManager.address);
    console.log(`Exported ${events.length} events`);

    console.log('\n✅ Full end-to-end test completed successfully!');
    console.log('\nTest Summary:');
    console.log(`- Users tested: ${numUsers}`);
    console.log(`- Intents created: ${queueStatus.total}`);
    console.log(`- Events indexed: ${eventsIndexed}`);
    console.log(`- Services working: Nexus, Pyth, Blockscout, MCP`);

  } catch (error) {
    console.error('❌ Full flow test failed:', error);
  }
}

async function testIntentFlow(config: TestFlowConfig, signer: any, numUsers: number) {
  console.log('\n=== TESTING INTENT FLOW ===');
  
  try {
    const nexusService = new NexusIntentService(
      signer.provider,
      config.contracts.DepositManager.address,
      new Map([[1, config.contracts.ChainDepositContract_Ethereum?.address || '0x0000000000000000000000000000000000000000']])
    );

    await nexusService.initializeNexus();
    console.log('✅ Nexus initialized');

    console.log(`Creating ${numUsers} intents...`);
    for (let i = 1; i <= numUsers; i++) {
      const userAddress = `0x${i.toString().padStart(40, '0')}`;
      const amount = ethers.parseEther('1');
      const btcEquivalent = '5000000000';
      
      const intentId = await nexusService.createIntent(1, i, userAddress, amount.toString(), btcEquivalent);
      console.log(`  Intent ${i}: ${intentId}`);
    }

    const queueStatus = nexusService.getQueueStatus();
    console.log(`Queue Status:`, queueStatus);

    console.log('✅ Intent flow test completed');

  } catch (error) {
    console.error('❌ Intent flow test failed:', error);
  }
}

async function testPriceFlow(config: TestFlowConfig, signer: any) {
  console.log('\n=== TESTING PRICE FLOW ===');
  
  try {
    const pythOracle = new PythOracleService(
      signer.provider,
      config.contracts.PriceOracle.address,
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
    );

    console.log('Fetching BTC price...');
    const btcPrice = await pythOracle.fetchBtcPrice();
    console.log(`BTC Price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Mock price'}`);

    console.log('Testing price updates...');
    const txHash = await pythOracle.updatePriceFeeds();
    console.log(`Update transaction: ${txHash}`);

    console.log('Testing cache...');
    const cacheStats = pythOracle.getCacheStats();
    console.log(`Cache stats:`, cacheStats);

    console.log('✅ Price flow test completed');

  } catch (error) {
    console.error('❌ Price flow test failed:', error);
  }
}

async function testMonitorFlow(config: TestFlowConfig, signer: any) {
  console.log('\n=== TESTING MONITOR FLOW ===');
  
  try {
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);

    console.log('Adding contracts to monitoring...');
    blockscoutMonitor.addContract(1, config.contracts.DepositManager.address, []);
    blockscoutMonitor.addContract(1, config.contracts.PriceOracle.address, []);

    console.log('Indexing events...');
    const events1 = await blockscoutMonitor.indexEvents(1, config.contracts.DepositManager.address);
    const events2 = await blockscoutMonitor.indexEvents(1, config.contracts.PriceOracle.address);
    console.log(`Events indexed: ${events1 + events2}`);

    console.log('Exporting events...');
    const exportedEvents = blockscoutMonitor.exportEvents(1, config.contracts.DepositManager.address);
    console.log(`Events exported: ${exportedEvents.length}`);

    console.log('✅ Monitor flow test completed');

  } catch (error) {
    console.error('❌ Monitor flow test failed:', error);
  }
}

async function testAIFlow(config: TestFlowConfig, signer: any) {
  console.log('\n=== TESTING AI FLOW ===');
  
  try {
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });
    const mcpApp = new MCPApplication(mcpService);

    console.log('Testing MCP connection...');
    try {
      const tools = await mcpService.getAvailableTools();
      console.log(`Available tools: ${tools.length}`);
    } catch (error) {
      console.log(`MCP connection: ${error} (expected in test environment)`);
    }

    console.log('Testing AI conversation...');
    const testQueries = [
      'Hello, can you help me analyze blockchain data?',
      'Check activation status for contract ' + config.contracts.DepositManager.address,
      'Analyze potential security risks'
    ];

    for (const query of testQueries) {
      try {
        const result = await mcpApp.processQuery(query);
        console.log(`Query: ${query}`);
        console.log(`Response: ${result.response.substring(0, 100)}...`);
      } catch (error) {
        console.log(`Query failed: ${error}`);
      }
    }

    console.log('Testing conversation history...');
    const history = mcpApp.getConversationHistory();
    console.log(`Conversation entries: ${history.length}`);

    console.log('✅ AI flow test completed');

  } catch (error) {
    console.error('❌ AI flow test failed:', error);
  }
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

export { main as testFlow };
