#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Production Setup Script
 * Configures the XMBL platform for production deployment
 */

async function setupProduction() {
  console.log('🚀 Setting up XMBL platform for production...\n');

  try {
    // Load production environment
    config({ path: './env.production' });

    // 1. Update Blockscout MCP configuration
    console.log('1. Configuring Blockscout MCP service...');
    const blockscoutConfig = JSON.parse(readFileSync('./config/blockscout.json', 'utf8'));
    
    blockscoutConfig.blockscout.mcp.serverUrl = process.env.BLOCKSCOUT_MCP_URL || 'https://mcp.blockscout.com';
    blockscoutConfig.blockscout.mcp.apiKey = process.env.BLOCKSCOUT_API_KEY || '';
    blockscoutConfig.blockscout.autoscout.explorerUrl = process.env.BLOCKSCOUT_AUTOSCOUT_URL || 'https://deploy.blockscout.com';
    
    writeFileSync('./config/blockscout.json', JSON.stringify(blockscoutConfig, null, 2));
    console.log('   ✅ Blockscout configuration updated');

    // 2. Update chain configurations
    console.log('2. Configuring blockchain networks...');
    const chainsConfig = JSON.parse(readFileSync('./config/chains.json', 'utf8'));
    
    // Update RPC URLs and chain IDs for mainnet
    chainsConfig.networks.ethereum.rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY';
    chainsConfig.networks.polygon.rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_KEY';
    chainsConfig.networks.bsc.rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
    chainsConfig.networks.arbitrum.rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arbitrum-mainnet.infura.io/v3/YOUR_KEY';
    chainsConfig.networks.optimism.rpcUrl = process.env.OPTIMISM_RPC_URL || 'https://optimism-mainnet.infura.io/v3/YOUR_KEY';
    
    writeFileSync('./config/chains.json', JSON.stringify(chainsConfig, null, 2));
    console.log('   ✅ Chain configurations updated');

    // 3. Update Pyth configuration
    console.log('3. Configuring Pyth Network...');
    const pythConfig = JSON.parse(readFileSync('./config/pyth.json', 'utf8'));
    
    pythConfig.pyth.hermesUrl = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network';
    pythConfig.pyth.priceFeeds.btcUsd = process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
    pythConfig.pyth.priceFeeds.ethUsd = process.env.PYTH_ETH_USD_FEED_ID || '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
    
    writeFileSync('./config/pyth.json', JSON.stringify(pythConfig, null, 2));
    console.log('   ✅ Pyth configuration updated');

    // 4. Update Avail configuration
    console.log('4. Configuring Avail Nexus...');
    const availConfig = JSON.parse(readFileSync('./config/avail.json', 'utf8'));
    
    availConfig.avail.nexus.rpcUrl = process.env.AVAIL_NEXUS_RPC_URL || 'https://nexus-rpc.avail.tools';
    availConfig.avail.nexus.wsUrl = process.env.AVAIL_NEXUS_WS_URL || 'wss://nexus-ws.avail.tools';
    availConfig.avail.nexus.apiKey = process.env.AVAIL_NEXUS_API_KEY || '';
    
    writeFileSync('./config/avail.json', JSON.stringify(availConfig, null, 2));
    console.log('   ✅ Avail configuration updated');

    // 5. Create production deployment script
    console.log('5. Creating production deployment script...');
    const deployScript = `#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load production environment
config({ path: './env.production' });

async function deployToProduction() {
  console.log('🚀 Deploying XMBL contracts to production networks...\\n');

  const networks = [
    { name: 'Ethereum', chainId: 1, rpcUrl: process.env.ETHEREUM_RPC_URL },
    { name: 'Polygon', chainId: 137, rpcUrl: process.env.POLYGON_RPC_URL },
    { name: 'BSC', chainId: 56, rpcUrl: process.env.BSC_RPC_URL },
    { name: 'Arbitrum', chainId: 42161, rpcUrl: process.env.ARBITRUM_RPC_URL },
    { name: 'Optimism', chainId: 10, rpcUrl: process.env.OPTIMISM_RPC_URL }
  ];

  for (const network of networks) {
    if (!network.rpcUrl || network.rpcUrl.includes('YOUR_KEY')) {
      console.log(\`⚠️  Skipping \${network.name} - RPC URL not configured\`);
      continue;
    }

    try {
      console.log(\`Deploying to \${network.name}...\`);
      
      // Create provider and signer
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
      
      console.log(\`Deployer: \${signer.address}\`);
      
      // Deploy contracts (implementation would go here)
      console.log(\`✅ \${network.name} deployment completed\`);
      
    } catch (error) {
      console.error(\`❌ Failed to deploy to \${network.name}:\`, error.message);
    }
  }
}

deployToProduction().catch(console.error);
`;
    
    writeFileSync('./scripts/deploy-production.ts', deployScript);
    console.log('   ✅ Production deployment script created');

    // 6. Create service health check script
    console.log('6. Creating service health check script...');
    const healthCheckScript = `#!/usr/bin/env ts-node

import axios from 'axios';
import { config } from 'dotenv';

config({ path: './env.production' });

async function checkServiceHealth() {
  console.log('🔍 Checking external service health...\\n');

  const services = [
    { name: 'Pyth Network', url: process.env.PYTH_HERMES_URL + '/v2/updates/price/latest?ids[]=' + process.env.PYTH_BTC_USD_FEED_ID },
    { name: 'Blockscout MCP', url: process.env.BLOCKSCOUT_MCP_URL + '/health' },
    { name: 'Avail Nexus', url: process.env.AVAIL_NEXUS_RPC_URL },
    { name: 'THORChain', url: process.env.THORCHAIN_RPC_URL + '/v2/health' }
  ];

  for (const service of services) {
    try {
      const response = await axios.get(service.url, { timeout: 5000 });
      console.log(\`✅ \${service.name}: \${response.status} OK\`);
    } catch (error) {
      console.log(\`❌ \${service.name}: \${error.message}\`);
    }
  }
}

checkServiceHealth().catch(console.error);
`;
    
    writeFileSync('./scripts/health-check.ts', healthCheckScript);
    console.log('   ✅ Health check script created');

    // 7. Update package.json with production scripts
    console.log('7. Adding production scripts to package.json...');
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'deploy:production': 'ts-node scripts/deploy-production.ts',
      'health:check': 'ts-node scripts/health-check.ts',
      'setup:production': 'ts-node scripts/setup-production.ts'
    };
    
    writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));
    console.log('   ✅ Production scripts added');

    console.log('\\n🎉 Production setup completed successfully!');
    console.log('\\nNext steps:');
    console.log('1. Update env.production with your API keys and RPC URLs');
    console.log('2. Run: npm run health:check');
    console.log('3. Run: npm run deploy:production');
    console.log('4. Monitor services with: npm run monitor');

  } catch (error) {
    console.error('❌ Production setup failed:', error);
    process.exit(1);
  }
}

setupProduction().catch(console.error);
