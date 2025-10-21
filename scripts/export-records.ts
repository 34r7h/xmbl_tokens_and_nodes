#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';

config();

interface ExportConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
}

/**
 * @title Export Records Script
 * @dev Exports blockchain records, events, and monitoring data
 * Supports multiple formats: JSON, CSV, and blockchain-specific formats
 */
async function main() {
  const args = process.argv.slice(2);
  const format = args[0] || 'json';
  const outputDir = args[1] || 'exports';

  console.log(`Exporting records - Format: ${format}, Output: ${outputDir}`);

  try {
    // Load deployment configuration
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    let deploymentConfig: ExportConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      deploymentConfig = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Could not load deployment configuration. Run deployment first.');
      process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Exporting with account: ${signer.address}`);

    // Initialize monitoring service
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);

    // Ensure output directory exists
    const fullOutputDir = join(process.cwd(), outputDir);
    if (!require('fs').existsSync(fullOutputDir)) {
      mkdirSync(fullOutputDir, { recursive: true });
    }

    // Export different types of records
    await exportContractEvents(blockscoutMonitor, deploymentConfig, format, fullOutputDir);
    await exportDeploymentRecords(deploymentConfig, format, fullOutputDir);
    await exportMonitoringData(blockscoutMonitor, deploymentConfig, format, fullOutputDir);

    console.log('\n✅ Export completed successfully!');
    console.log(`Files saved to: ${fullOutputDir}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

async function exportContractEvents(
  blockscoutMonitor: BlockscoutMonitorService,
  config: ExportConfig,
  format: string,
  outputDir: string
) {
  console.log('\n=== EXPORTING CONTRACT EVENTS ===');
  
  const contractsToExport = [
    { name: 'PriceOracle', address: config.contracts.PriceOracle.address },
    { name: 'DepositManager', address: config.contracts.DepositManager.address }
  ];

  // Add chain-specific contracts
  for (const [name, contract] of Object.entries(config.contracts)) {
    if (name.startsWith('ChainDepositContract_')) {
      contractsToExport.push({ name, address: contract.address });
    }
  }

  const allEvents: any[] = [];

  for (const contract of contractsToExport) {
    console.log(`Exporting events for ${contract.name}...`);
    
    try {
      // Add contract to monitoring
      blockscoutMonitor.addContract(1, contract.address, []);
      
      // Index events
      const eventsIndexed = await blockscoutMonitor.indexEvents(1, contract.address);
      console.log(`  ✓ Indexed ${eventsIndexed} events`);
      
      // Export events
      const events = blockscoutMonitor.exportEvents(1, contract.address);
      allEvents.push(...events.map(event => ({
        ...event,
        contractName: contract.name,
        contractAddress: contract.address
      })));
      
      console.log(`  ✓ Exported ${events.length} events`);
      
    } catch (error) {
      console.error(`  ❌ Failed to export events for ${contract.name}:`, error);
    }
  }

  // Save events in requested format
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const eventsFile = join(outputDir, `events_${timestamp}.${format}`);
  
  switch (format.toLowerCase()) {
    case 'json':
      writeFileSync(eventsFile, JSON.stringify(allEvents, null, 2));
      break;
    case 'csv':
      const csvContent = convertToCSV(allEvents);
      writeFileSync(eventsFile, csvContent);
      break;
    default:
      writeFileSync(eventsFile, JSON.stringify(allEvents, null, 2));
  }
  
  console.log(`Events exported to: ${eventsFile}`);
}

async function exportDeploymentRecords(
  config: ExportConfig,
  format: string,
  outputDir: string
) {
  console.log('\n=== EXPORTING DEPLOYMENT RECORDS ===');
  
  const deploymentData = {
    network: config.network,
    timestamp: new Date().toISOString(),
    contracts: config.contracts,
    deploymentInfo: {
      totalContracts: Object.keys(config.contracts).length,
      contractTypes: Object.keys(config.contracts).map(name => name.split('_')[0]).filter((v, i, a) => a.indexOf(v) === i)
    }
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const deploymentFile = join(outputDir, `deployment_${timestamp}.${format}`);
  
  switch (format.toLowerCase()) {
    case 'json':
      writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
      break;
    case 'csv':
      const csvContent = convertDeploymentToCSV(deploymentData);
      writeFileSync(deploymentFile, csvContent);
      break;
    default:
      writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  }
  
  console.log(`Deployment records exported to: ${deploymentFile}`);
}

async function exportMonitoringData(
  blockscoutMonitor: BlockscoutMonitorService,
  config: ExportConfig,
  format: string,
  outputDir: string
) {
  console.log('\n=== EXPORTING MONITORING DATA ===');
  
  const monitoringData = {
    timestamp: new Date().toISOString(),
    network: config.network,
    contracts: {},
    summary: {
      totalContracts: Object.keys(config.contracts).length,
      totalEvents: 0
    }
  };

  // Collect monitoring data for each contract
  for (const [name, contract] of Object.entries(config.contracts)) {
    try {
      blockscoutMonitor.addContract(1, contract.address, []);
      const events = blockscoutMonitor.exportEvents(1, contract.address);
      
      monitoringData.contracts[name] = {
        address: contract.address,
        events: events,
        eventCount: events.length
      };
      
      monitoringData.summary.totalEvents += events.length;
      
    } catch (error) {
      console.error(`  ❌ Failed to collect monitoring data for ${name}:`, error);
      monitoringData.contracts[name] = {
        address: contract.address,
        events: [],
        eventCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const monitoringFile = join(outputDir, `monitoring_${timestamp}.${format}`);
  
  switch (format.toLowerCase()) {
    case 'json':
      writeFileSync(monitoringFile, JSON.stringify(monitoringData, null, 2));
      break;
    case 'csv':
      const csvContent = convertMonitoringToCSV(monitoringData);
      writeFileSync(monitoringFile, csvContent);
      break;
    default:
      writeFileSync(monitoringFile, JSON.stringify(monitoringData, null, 2));
  }
  
  console.log(`Monitoring data exported to: ${monitoringFile}`);
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = ['contractName', 'contractAddress', 'event', 'data'];
  const rows = data.map(item => [
    item.contractName || '',
    item.contractAddress || '',
    item.event || '',
    JSON.stringify(item.data || {})
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function convertDeploymentToCSV(data: any): string {
  const headers = ['network', 'timestamp', 'contractName', 'contractAddress', 'contractType'];
  const rows = Object.entries(data.contracts).map(([name, contract]: [string, any]) => [
    data.network,
    data.timestamp,
    name,
    contract.address,
    name.split('_')[0]
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function convertMonitoringToCSV(data: any): string {
  const headers = ['timestamp', 'network', 'contractName', 'contractAddress', 'eventCount', 'totalEvents'];
  const rows = Object.entries(data.contracts).map(([name, contract]: [string, any]) => [
    data.timestamp,
    data.network,
    name,
    contract.address,
    contract.eventCount || 0,
    data.summary.totalEvents
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
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

export { main as exportRecords };
