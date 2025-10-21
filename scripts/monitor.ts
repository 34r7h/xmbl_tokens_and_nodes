#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';
import { PythOracleService } from '../services/PythOracleService';

config();

interface MonitorConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
}

/**
 * @title Monitor Script
 * @dev Monitors blockchain events, price feeds, and activation sequences
 * Integrates with Blockscout for transparency and Pyth for price updates
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  console.log(`Starting XMBL Monitor - Command: ${command}`);

  try {
    // Load deployment configuration
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    let deploymentConfig: MonitorConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      deploymentConfig = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Could not load deployment configuration. Run deployment first.');
      process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Monitoring with account: ${signer.address}`);

    // Initialize services
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    const pythOracle = new PythOracleService(
      signer.provider,
      deploymentConfig.contracts.PriceOracle.address,
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
    );

    switch (command) {
      case 'start':
        await startMonitoring(blockscoutMonitor, pythOracle, deploymentConfig);
        break;
      case 'events':
        await monitorEvents(blockscoutMonitor, deploymentConfig);
        break;
      case 'prices':
        await monitorPrices(pythOracle);
        break;
      case 'status':
        await showStatus(blockscoutMonitor, pythOracle, deploymentConfig);
        break;
      case 'export':
        await exportData(blockscoutMonitor, deploymentConfig);
        break;
      default:
        console.log('Available commands:');
        console.log('  start  - Start full monitoring (events + prices)');
        console.log('  events - Monitor blockchain events only');
        console.log('  prices - Monitor price feeds only');
        console.log('  status - Show current status');
        console.log('  export - Export monitoring data');
        break;
    }

  } catch (error) {
    console.error('❌ Monitoring failed:', error);
    process.exit(1);
  }
}

async function startMonitoring(
  blockscoutMonitor: BlockscoutMonitorService,
  pythOracle: PythOracleService,
  config: MonitorConfig
) {
  console.log('\n=== STARTING FULL MONITORING ===');
  
  // Add contracts to monitoring
  const contractsToMonitor = [
    { name: 'PriceOracle', address: config.contracts.PriceOracle.address },
    { name: 'DepositManager', address: config.contracts.DepositManager.address }
  ];

  // Add chain-specific contracts
  for (const [name, contract] of Object.entries(config.contracts)) {
    if (name.startsWith('ChainDepositContract_')) {
      contractsToMonitor.push({ name, address: contract.address });
    }
  }

  console.log('Adding contracts to monitoring:');
  for (const contract of contractsToMonitor) {
    blockscoutMonitor.addContract(1, contract.address, []); // Mock ABI for now
    console.log(`  ✓ ${contract.name}: ${contract.address}`);
  }

  // Start price monitoring
  console.log('\nStarting price feed monitoring...');
  pythOracle.startPeriodicUpdates(30000); // Update every 30 seconds

  // Start event monitoring
  console.log('\nStarting event monitoring...');
  for (const contract of contractsToMonitor) {
    try {
      const eventsIndexed = await blockscoutMonitor.indexEvents(1, contract.address);
      console.log(`  ✓ Indexed ${eventsIndexed} events for ${contract.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to index events for ${contract.name}:`, error);
    }
  }

  console.log('\n✅ Monitoring started successfully!');
  console.log('Press Ctrl+C to stop monitoring...');

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping monitoring...');
    pythOracle.stopPeriodicUpdates();
    console.log('✅ Monitoring stopped');
    process.exit(0);
  });

  // Keep alive
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Monitoring active...`);
  }, 60000); // Log every minute
}

async function monitorEvents(
  blockscoutMonitor: BlockscoutMonitorService,
  config: MonitorConfig
) {
  console.log('\n=== MONITORING BLOCKCHAIN EVENTS ===');
  
  const contractsToMonitor = [
    { name: 'PriceOracle', address: config.contracts.PriceOracle.address },
    { name: 'DepositManager', address: config.contracts.DepositManager.address }
  ];

  for (const contract of contractsToMonitor) {
    console.log(`\nMonitoring ${contract.name}...`);
    blockscoutMonitor.addContract(1, contract.address, []);
    
    try {
      const eventsIndexed = await blockscoutMonitor.indexEvents(1, contract.address);
      console.log(`  ✓ Indexed ${eventsIndexed} events`);
      
      const events = blockscoutMonitor.exportEvents(1, contract.address);
      console.log(`  📊 Total events: ${events.length}`);
      
      if (events.length > 0) {
        console.log('  Recent events:');
        events.slice(-3).forEach((event, index) => {
          console.log(`    ${index + 1}. ${event.event}: ${JSON.stringify(event.data)}`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Failed to monitor ${contract.name}:`, error);
    }
  }
}

async function monitorPrices(pythOracle: PythOracleService) {
  console.log('\n=== MONITORING PRICE FEEDS ===');
  
  try {
    // Get current BTC price
    const btcPrice = await pythOracle.fetchBtcPrice();
    if (btcPrice) {
      console.log(`Current BTC price: $${btcPrice.toFixed(2)}`);
    } else {
      console.log('❌ Could not fetch BTC price');
    }

    // Get price feed status
    const status = await pythOracle.getPriceFeedStatus();
    if (status) {
      console.log(`Price feed status: ${JSON.stringify(status, null, 2)}`);
    }

    // Get cache statistics
    const cacheStats = pythOracle.getCacheStats();
    console.log(`Cache stats: ${JSON.stringify(cacheStats, null, 2)}`);

    // Start periodic updates
    console.log('\nStarting periodic price updates...');
    pythOracle.startPeriodicUpdates(10000); // Update every 10 seconds

    console.log('✅ Price monitoring started. Press Ctrl+C to stop...');

    // Keep alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping price monitoring...');
      pythOracle.stopPeriodicUpdates();
      console.log('✅ Price monitoring stopped');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Price monitoring failed:', error);
  }
}

async function showStatus(
  blockscoutMonitor: BlockscoutMonitorService,
  pythOracle: PythOracleService,
  config: MonitorConfig
) {
  console.log('\n=== MONITORING STATUS ===');
  
  console.log('\n📊 Contract Status:');
  for (const [name, contract] of Object.entries(config.contracts)) {
    console.log(`  ${name}: ${contract.address}`);
  }

  console.log('\n💰 Price Feed Status:');
  try {
    const btcPrice = await pythOracle.fetchBtcPrice();
    console.log(`  BTC Price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Unknown'}`);
    
    const cacheStats = pythOracle.getCacheStats();
    console.log(`  Cache Size: ${cacheStats.size} entries`);
    console.log(`  Oldest Entry: ${cacheStats.oldestEntry ? new Date(cacheStats.oldestEntry).toISOString() : 'None'}`);
    console.log(`  Newest Entry: ${cacheStats.newestEntry ? new Date(cacheStats.newestEntry).toISOString() : 'None'}`);
  } catch (error) {
    console.log(`  ❌ Price feed error: ${error}`);
  }

  console.log('\n📈 Event Monitoring:');
  const contractsToCheck = [
    { name: 'PriceOracle', address: config.contracts.PriceOracle.address },
    { name: 'DepositManager', address: config.contracts.DepositManager.address }
  ];

  for (const contract of contractsToCheck) {
    try {
      const events = blockscoutMonitor.exportEvents(1, contract.address);
      console.log(`  ${contract.name}: ${events.length} events indexed`);
    } catch (error) {
      console.log(`  ${contract.name}: ❌ Error - ${error}`);
    }
  }
}

async function exportData(
  blockscoutMonitor: BlockscoutMonitorService,
  config: MonitorConfig
) {
  console.log('\n=== EXPORTING MONITORING DATA ===');
  
  const exportData = {
    timestamp: new Date().toISOString(),
    network: config.network,
    contracts: config.contracts,
    events: {}
  };

  const contractsToExport = [
    { name: 'PriceOracle', address: config.contracts.PriceOracle.address },
    { name: 'DepositManager', address: config.contracts.DepositManager.address }
  ];

  for (const contract of contractsToExport) {
    try {
      const events = blockscoutMonitor.exportEvents(1, contract.address);
      exportData.events[contract.name] = events;
      console.log(`  ✓ Exported ${events.length} events for ${contract.name}`);
    } catch (error) {
      console.log(`  ❌ Failed to export events for ${contract.name}: ${error}`);
      exportData.events[contract.name] = [];
    }
  }

  // Save to file
  const exportPath = join(process.cwd(), 'exports', `monitoring_${Date.now()}.json`);
  const fs = require('fs');
  const path = require('path');
  
  // Ensure exports directory exists
  const exportsDir = path.dirname(exportPath);
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ Data exported to: ${exportPath}`);
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

export { main as monitor };
