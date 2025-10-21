#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BlockscoutMonitorService } from '../services/BlockscoutMonitorService';
import { BlockscoutMCPService } from '../services/BlockscoutMCPService';
import { MCPApplication } from '../services/MCPApplication';

config();

interface AutoscoutConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
  autoscout: {
    enabled: boolean;
    serverUrl: string;
    apiKey: string;
    monitoringInterval: number;
  };
}

/**
 * @title Setup Autoscout Script
 * @dev Sets up Autoscout explorer instance with MCP integration
 * Configures monitoring, AI auditing, and transparency features
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  console.log(`Setting up Autoscout - Command: ${command}`);

  try {
    // Load deployment configuration
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    let deploymentConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      deploymentConfig = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Could not load deployment configuration. Run deployment first.');
      process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Setting up Autoscout with account: ${signer.address}`);

    switch (command) {
      case 'setup':
        await setupAutoscout(deploymentConfig, signer);
        break;
      case 'configure':
        await configureAutoscout(deploymentConfig);
        break;
      case 'test':
        await testAutoscout(deploymentConfig, signer);
        break;
      case 'start':
        await startAutoscout(deploymentConfig, signer);
        break;
      default:
        console.log('Available commands:');
        console.log('  setup     - Initial Autoscout setup');
        console.log('  configure - Configure Autoscout settings');
        console.log('  test      - Test Autoscout functionality');
        console.log('  start     - Start Autoscout services');
        break;
    }

  } catch (error) {
    console.error('❌ Autoscout setup failed:', error);
    process.exit(1);
  }
}

async function setupAutoscout(deploymentConfig: any, signer: any) {
  console.log('\n=== SETTING UP AUTOSCOUT ===');
  
  try {
    // Initialize services
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });
    const mcpApp = new MCPApplication(mcpService);

    console.log('✅ Services initialized');

    // Add contracts to monitoring
    console.log('\n📊 Adding contracts to monitoring...');
    const contractsToMonitor = [
      { name: 'PriceOracle', address: deploymentConfig.contracts.PriceOracle.address },
      { name: 'DepositManager', address: deploymentConfig.contracts.DepositManager.address }
    ];

    // Add chain-specific contracts
    for (const [name, contract] of Object.entries(deploymentConfig.contracts)) {
      if (name.startsWith('ChainDepositContract_')) {
        contractsToMonitor.push({ name, address: contract.address });
      }
    }

    for (const contract of contractsToMonitor) {
      blockscoutMonitor.addContract(1, contract.address, []);
      console.log(`  ✓ Added ${contract.name}: ${contract.address}`);
    }

    // Test MCP connection
    console.log('\n🤖 Testing MCP connection...');
    try {
      const tools = await mcpService.getAvailableTools();
      console.log(`  ✓ MCP connection successful. Available tools: ${tools.length}`);
    } catch (error) {
      console.log(`  ⚠️  MCP connection failed (expected in test environment): ${error}`);
    }

    // Create Autoscout configuration
    const autoscoutConfig: AutoscoutConfig = {
      network: deploymentConfig.network,
      contracts: deploymentConfig.contracts,
      autoscout: {
        enabled: true,
        serverUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000',
        apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
        monitoringInterval: 30000 // 30 seconds
      }
    };

    // Save configuration
    const configPath = join(process.cwd(), 'autoscout-config.json');
    writeFileSync(configPath, JSON.stringify(autoscoutConfig, null, 2));
    console.log(`\n✅ Autoscout configuration saved to: ${configPath}`);

    console.log('\n✅ Autoscout setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure environment variables in .env');
    console.log('2. Start MCP server: npm run setup-autoscout start');
    console.log('3. Test functionality: npm run setup-autoscout test');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

async function configureAutoscout(deploymentConfig: any) {
  console.log('\n=== CONFIGURING AUTOSCOUT ===');
  
  try {
    // Load existing configuration
    const configPath = join(process.cwd(), 'autoscout-config.json');
    let autoscoutConfig: AutoscoutConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      autoscoutConfig = JSON.parse(configData);
    } catch (error) {
      console.log('Creating new Autoscout configuration...');
      autoscoutConfig = {
        network: deploymentConfig.network,
        contracts: deploymentConfig.contracts,
        autoscout: {
          enabled: true,
          serverUrl: 'http://localhost:3000',
          apiKey: 'test-api-key',
          monitoringInterval: 30000
        }
      };
    }

    // Update configuration based on environment variables
    if (process.env.BLOCKSCOUT_MCP_SERVER_URL) {
      autoscoutConfig.autoscout.serverUrl = process.env.BLOCKSCOUT_MCP_SERVER_URL;
    }
    if (process.env.BLOCKSCOUT_API_KEY) {
      autoscoutConfig.autoscout.apiKey = process.env.BLOCKSCOUT_API_KEY;
    }

    // Save updated configuration
    writeFileSync(configPath, JSON.stringify(autoscoutConfig, null, 2));
    console.log(`✅ Configuration updated: ${configPath}`);

    // Display configuration
    console.log('\n📋 Current Configuration:');
    console.log(`  Network: ${autoscoutConfig.network}`);
    console.log(`  Server URL: ${autoscoutConfig.autoscout.serverUrl}`);
    console.log(`  API Key: ${autoscoutConfig.autoscout.apiKey ? 'Set' : 'Not set'}`);
    console.log(`  Monitoring Interval: ${autoscoutConfig.autoscout.monitoringInterval}ms`);
    console.log(`  Contracts: ${Object.keys(autoscoutConfig.contracts).length}`);

    console.log('\n✅ Configuration completed');

  } catch (error) {
    console.error('❌ Configuration failed:', error);
  }
}

async function testAutoscout(deploymentConfig: any, signer: any) {
  console.log('\n=== TESTING AUTOSCOUT ===');
  
  try {
    // Initialize services
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });
    const mcpApp = new MCPApplication(mcpService);

    console.log('🧪 Testing services...');

    // Test 1: Contract monitoring
    console.log('\n1. Testing contract monitoring...');
    const testContract = deploymentConfig.contracts.DepositManager.address;
    blockscoutMonitor.addContract(1, testContract, []);
    
    try {
      const eventsIndexed = await blockscoutMonitor.indexEvents(1, testContract);
      console.log(`  ✓ Contract monitoring: ${eventsIndexed} events indexed`);
    } catch (error) {
      console.log(`  ⚠️  Contract monitoring: ${error}`);
    }

    // Test 2: MCP connection
    console.log('\n2. Testing MCP connection...');
    try {
      const tools = await mcpService.getAvailableTools();
      console.log(`  ✓ MCP connection: ${tools.length} tools available`);
    } catch (error) {
      console.log(`  ⚠️  MCP connection: ${error}`);
    }

    // Test 3: AI conversation
    console.log('\n3. Testing AI conversation...');
    try {
      const testQuery = 'Hello, can you help me analyze blockchain data?';
      const result = await mcpApp.processQuery(testQuery);
      console.log(`  ✓ AI conversation: Response received`);
      console.log(`    Response: ${result.response.substring(0, 100)}...`);
    } catch (error) {
      console.log(`  ⚠️  AI conversation: ${error}`);
    }

    // Test 4: Event export
    console.log('\n4. Testing event export...');
    try {
      const events = blockscoutMonitor.exportEvents(1, testContract);
      console.log(`  ✓ Event export: ${events.length} events exported`);
    } catch (error) {
      console.log(`  ⚠️  Event export: ${error}`);
    }

    console.log('\n✅ Autoscout testing completed');

  } catch (error) {
    console.error('❌ Testing failed:', error);
  }
}

async function startAutoscout(deploymentConfig: any, signer: any) {
  console.log('\n=== STARTING AUTOSCOUT SERVICES ===');
  
  try {
    // Initialize services
    const blockscoutMonitor = new BlockscoutMonitorService(signer.provider);
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });
    const mcpApp = new MCPApplication(mcpService);

    console.log('🚀 Starting Autoscout services...');

    // Add all contracts to monitoring
    const contractsToMonitor = [
      { name: 'PriceOracle', address: deploymentConfig.contracts.PriceOracle.address },
      { name: 'DepositManager', address: deploymentConfig.contracts.DepositManager.address }
    ];

    for (const [name, contract] of Object.entries(deploymentConfig.contracts)) {
      if (name.startsWith('ChainDepositContract_')) {
        contractsToMonitor.push({ name, address: contract.address });
      }
    }

    console.log('📊 Starting contract monitoring...');
    for (const contract of contractsToMonitor) {
      blockscoutMonitor.addContract(1, contract.address, []);
      console.log(`  ✓ Monitoring ${contract.name}: ${contract.address}`);
    }

    // Start periodic monitoring
    console.log('⏰ Starting periodic monitoring...');
    const monitoringInterval = setInterval(async () => {
      try {
        console.log(`[${new Date().toISOString()}] Monitoring contracts...`);
        
        for (const contract of contractsToMonitor) {
          const events = blockscoutMonitor.exportEvents(1, contract.address);
          if (events.length > 0) {
            console.log(`  📈 ${contract.name}: ${events.length} events`);
          }
        }
      } catch (error) {
        console.error('  ❌ Monitoring error:', error);
      }
    }, 30000); // Every 30 seconds

    console.log('✅ Autoscout services started successfully!');
    console.log('Press Ctrl+C to stop services...');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping Autoscout services...');
      clearInterval(monitoringInterval);
      console.log('✅ Services stopped');
      process.exit(0);
    });

    // Keep the process running
    setInterval(() => {
      console.log(`[${new Date().toISOString()}] Autoscout active...`);
    }, 60000); // Log every minute

  } catch (error) {
    console.error('❌ Failed to start Autoscout services:', error);
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

export { main as setupAutoscout };
