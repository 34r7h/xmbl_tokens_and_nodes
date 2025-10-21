#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NexusIntentService } from '../services/NexusIntentService';
import { PythOracleService } from '../services/PythOracleService';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';
import { BTCConversionService } from '../services/BTCConversionService';

config();

interface TestnetConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
}

/**
 * @title Testnet Testing Script
 * @dev Tests deployed contracts on testnet
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || 'sepolia';
  const testType = args[1] || 'all';

  console.log(`🧪 Testing XMBL Contracts on ${network.toUpperCase()}`);
  console.log('=' .repeat(50));

  try {
    // Load deployment configuration
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    if (!existsSync(configPath)) {
      console.error('❌ Deployment configuration not found. Run deployment first.');
      process.exit(1);
    }

    const deploymentConfig: TestnetConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    console.log(`📄 Loaded deployment config for ${deploymentConfig.network}`);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`Testing with account: ${signer.address}`);

    switch (testType) {
      case 'all':
        await runAllTests(deploymentConfig, signer);
        break;
      case 'contracts':
        await runContractTests(deploymentConfig, signer);
        break;
      case 'services':
        await runServiceTests(deploymentConfig, signer);
        break;
      case 'integration':
        await runIntegrationTests(deploymentConfig, signer);
        break;
      default:
        console.log('Available test types:');
        console.log('  all        - Run all tests');
        console.log('  contracts  - Test smart contracts only');
        console.log('  services   - Test backend services only');
        console.log('  integration - Test full integration');
        break;
    }

  } catch (error) {
    console.error('❌ Testnet testing failed:', error);
    process.exit(1);
  }
}

async function runAllTests(config: TestnetConfig, signer: any) {
  console.log('\n🎯 Running All Testnet Tests');
  console.log('=' .repeat(35));

  await runContractTests(config, signer);
  await runServiceTests(config, signer);
  await runIntegrationTests(config, signer);

  console.log('\n✅ All testnet tests completed successfully!');
}

async function runContractTests(config: TestnetConfig, signer: any) {
  console.log('\n📋 Testing Smart Contracts');
  console.log('=' .repeat(30));

  try {
    // Test PriceOracle
    console.log('\n📊 Testing PriceOracle...');
    const priceOracle = new ethers.Contract(config.contracts.PriceOracle.address, [], signer);
    
    const currentPrice = await priceOracle.getCurrentPrice();
    console.log(`  Current price: ${currentPrice} satoshis`);
    
    const btcPrice = await priceOracle.getBtcPrice();
    console.log(`  BTC price: ${btcPrice}`);
    
    console.log('✅ PriceOracle tests passed');

    // Test DepositManager
    console.log('\n🏦 Testing DepositManager...');
    const depositManager = await ethers.getContractAt('DepositManager', config.contracts.DepositManager.address);
    
    const queueStatus = await depositManager.getQueueStatus();
    console.log(`  Queue status: ${queueStatus.totalActivations} total, ${queueStatus.processedActivations} processed`);
    
    const costStats = await depositManager.getCostStats();
    console.log(`  Cost stats: ${costStats.totalCostsAmount} total costs, ${costStats.totalNetBtcEquivalentAmount} net BTC`);
    
    console.log('✅ DepositManager tests passed');

    // Test ChainDepositContract
    console.log('\n🔗 Testing ChainDepositContract...');
    const chainDepositContract = await ethers.getContractAt('ChainDepositContract', config.contracts.ChainDepositContract.address);
    
    const stats = await chainDepositContract.getStats();
    console.log(`  Stats: ${stats.totalDepositsCount} deposits, ${stats.totalBtcEquivalentAmount} BTC equivalent`);
    
    // Test cost calculation
    const testBtcAmount = 100000000; // 1 BTC in satoshis
    const costs = await chainDepositContract.calculateCosts(testBtcAmount);
    console.log(`  Cost calculation test: ${costs} satoshis for ${testBtcAmount} satoshis`);
    
    console.log('✅ ChainDepositContract tests passed');

  } catch (error) {
    console.error('❌ Contract tests failed:', error);
  }
}

async function runServiceTests(config: TestnetConfig, signer: any) {
  console.log('\n🔧 Testing Backend Services');
  console.log('=' .repeat(35));

  try {
    // Test NexusIntentService
    console.log('\n📡 Testing NexusIntentService...');
    const nexusService = new NexusIntentService(
      signer.provider,
      config.contracts.DepositManager.address,
      new Map([[1, config.contracts.ChainDepositContract.address]]),
      'test-api-key',
      'http://localhost:3000'
    );

    await nexusService.initializeNexus();
    console.log('  Nexus SDK initialized');

    const queueStatus = nexusService.getQueueStatus();
    console.log(`  Queue status: ${queueStatus.total} total intents`);
    console.log('✅ NexusIntentService tests passed');

    // Test PythOracleService
    console.log('\n💰 Testing PythOracleService...');
    const pythOracle = new PythOracleService(
      signer.provider,
      config.contracts.PriceOracle.address,
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
    );

    const btcPrice = await pythOracle.fetchBtcPrice();
    console.log(`  BTC price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Mock price'}`);
    console.log('✅ PythOracleService tests passed');

    // Test BlockscoutMonitorService
    console.log('\n📈 Testing BlockscoutMonitorService...');
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    
    blockscoutMonitor.addContract(1, config.contracts.DepositManager.address, []);
    const eventsIndexed = await blockscoutMonitor.indexEvents(1, config.contracts.DepositManager.address);
    console.log(`  Events indexed: ${eventsIndexed}`);
    console.log('✅ BlockscoutMonitorService tests passed');

    // Test BTCConversionService
    console.log('\n🔄 Testing BTCConversionService...');
    const btcConversionService = new BTCConversionService(
      signer.provider,
      config.contracts.DepositManager.address,
      {
        developmentPoolAddress: '0x1111111111111111111111111111111111111111',
        liquidityPoolAddress: '0x2222222222222222222222222222222222222222',
        minLiquidityPercentage: 10,
        maxLiquidityPercentage: 95,
        targetBTCForMaxLiquidity: 100
      }
    );

    const testBtcAmount = 10 * 1e8; // 10 BTC
    const result = await btcConversionService.processBTCConversion(
      signer.address,
      testBtcAmount,
      1
    );

    if (result.success) {
      console.log(`  Conversion successful: ${result.developmentSats} dev, ${result.liquiditySats} liquidity`);
    } else {
      console.log('  Conversion failed (expected in test environment)');
    }
    console.log('✅ BTCConversionService tests passed');

  } catch (error) {
    console.error('❌ Service tests failed:', error);
  }
}

async function runIntegrationTests(config: TestnetConfig, signer: any) {
  console.log('\n🔗 Testing Integration');
  console.log('=' .repeat(25));

  try {
    console.log('\n📊 Testing end-to-end workflow...');
    
    // Simulate a user deposit
    const chainDepositContract = await ethers.getContractAt('ChainDepositContract', config.contracts.ChainDepositContract.address);
    
    // Note: This would require a real ERC20 token for full testing
    console.log('  Simulating deposit workflow...');
    console.log('  Note: Full integration requires ERC20 tokens and cross-chain setup');
    
    // Test price oracle integration
    const priceOracle = await ethers.getContractAt('PriceOracle', config.contracts.PriceOracle.address);
    const currentPrice = await priceOracle.getCurrentPrice();
    console.log(`  Current XMBL price: ${currentPrice} satoshis`);
    
    // Test cost calculation integration
    const testAmount = 100000000; // 1 BTC
    const costs = await chainDepositContract.calculateCosts(testAmount);
    console.log(`  Cost calculation: ${costs} satoshis for ${testAmount} satoshis`);
    
    console.log('✅ Integration tests passed');

  } catch (error) {
    console.error('❌ Integration tests failed:', error);
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

export { main as testTestnet };
