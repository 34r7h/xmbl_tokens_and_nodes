#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PythOracleService } from '../services/PythOracleService';

config();

interface PriceData {
  timestamp: number;
  btcPrice: number | null;
  xmblPrice: string;
  tokensMinted: number;
  network: string;
}

/**
 * @title Fetch Prices Script
 * @dev Fetches current BTC prices from Pyth Network and XMBL token prices
 * Displays price information and can export to various formats
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'current';
  const format = args[1] || 'json';

  console.log(`Fetching prices - Command: ${command}, Format: ${format}`);

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

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
    console.log(`Fetching prices with account: ${signer.address}`);

    // Initialize Pyth Oracle Service
    const pythOracle = new PythOracleService(
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      process.env.PRICE_ORACLE_ADDRESS || deploymentConfig.contracts.PriceOracle.address,
      signer.provider,
      signer
    );

    // Connect to PriceOracle contract
    const PriceOracleFactory = await ethers.getContractFactory('PriceOracle');
    const priceOracle = PriceOracleFactory.attach(process.env.PRICE_ORACLE_ADDRESS || deploymentConfig.contracts.PriceOracle.address);

    switch (command) {
      case 'current':
        await fetchCurrentPrices(pythOracle, priceOracle, format);
        break;
      case 'history':
        await fetchPriceHistory(pythOracle, priceOracle, format);
        break;
      case 'update':
        await updateOnChainPrices(pythOracle, priceOracle);
        break;
      case 'status':
        await showPriceStatus(pythOracle, priceOracle);
        break;
      default:
        console.log('Available commands:');
        console.log('  current - Fetch current prices (default)');
        console.log('  history - Fetch price history');
        console.log('  update  - Update on-chain prices');
        console.log('  status  - Show price feed status');
        console.log('\nFormat options: json, csv, table');
        break;
    }

  } catch (error) {
    console.error('❌ Price fetching failed:', error);
    process.exit(1);
  }
}

async function fetchCurrentPrices(
  pythOracle: PythOracleService,
  priceOracle: any,
  format: string
) {
  console.log('\n=== FETCHING CURRENT PRICES ===');
  
  try {
    // Fetch BTC price from Pyth
    const btcPrice = await pythOracle.fetchBtcPrice();
    console.log(`BTC Price from Pyth: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Failed to fetch'}`);

    // Get XMBL token price from contract
    const xmblPrice = await priceOracle.getCurrentPrice();
    const tokensMinted = await priceOracle.tokensMinted();

    console.log(`XMBL Token Price: ${ethers.formatUnits(xmblPrice, 8)} satoshis`);
    console.log(`Tokens Minted: ${tokensMinted}`);

    // Calculate price using golden ratio formula
    const calculatedPrice = await priceOracle.calculatePrice(tokensMinted);
    console.log(`Calculated Price: ${ethers.formatUnits(calculatedPrice, 8)} satoshis`);

    // Prepare price data
    const priceData: PriceData = {
      timestamp: Date.now(),
      btcPrice,
      xmblPrice: ethers.formatUnits(xmblPrice, 8),
      tokensMinted: Number(tokensMinted),
      network: process.env.HARDHAT_NETWORK || 'hardhat'
    };

    // Export in requested format
    await exportPriceData(priceData, format);

  } catch (error) {
    console.error('❌ Failed to fetch current prices:', error);
  }
}

async function fetchPriceHistory(
  pythOracle: PythOracleService,
  priceOracle: any,
  format: string
) {
  console.log('\n=== FETCHING PRICE HISTORY ===');
  
  try {
    // Get cache statistics
    const cacheStats = pythOracle.getCacheStats();
    console.log(`Cache entries: ${cacheStats.size}`);
    
    if (cacheStats.oldestEntry) {
      console.log(`Oldest entry: ${new Date(cacheStats.oldestEntry).toISOString()}`);
    }
    if (cacheStats.newestEntry) {
      console.log(`Newest entry: ${new Date(cacheStats.newestEntry).toISOString()}`);
    }

    // Get current prices
    const btcPrice = await pythOracle.fetchBtcPrice();
    const xmblPrice = await priceOracle.getCurrentPrice();
    const tokensMinted = await priceOracle.tokensMinted();

    const historyData = {
      timestamp: Date.now(),
      btcPrice,
      xmblPrice: ethers.formatUnits(xmblPrice, 8),
      tokensMinted: Number(tokensMinted),
      cacheStats,
      network: process.env.HARDHAT_NETWORK || 'hardhat'
    };

    await exportPriceData(historyData, format);

  } catch (error) {
    console.error('❌ Failed to fetch price history:', error);
  }
}

async function updateOnChainPrices(
  pythOracle: PythOracleService,
  priceOracle: any
) {
  console.log('\n=== UPDATING ON-CHAIN PRICES ===');
  
  try {
    // Update price feeds
    console.log('Updating price feeds...');
    const txHash = await pythOracle.updatePriceFeeds();
    console.log(`Price update transaction: ${txHash}`);

    // Get updated prices
    const btcPrice = await pythOracle.fetchBtcPrice();
    const xmblPrice = await priceOracle.getCurrentPrice();
    
    console.log(`Updated BTC price: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Unknown'}`);
    console.log(`Updated XMBL price: ${ethers.formatUnits(xmblPrice, 8)} satoshis`);

    console.log('✅ Price update completed');

  } catch (error) {
    console.error('❌ Failed to update on-chain prices:', error);
  }
}

async function showPriceStatus(
  pythOracle: PythOracleService,
  priceOracle: any
) {
  console.log('\n=== PRICE FEED STATUS ===');
  
  try {
    // Pyth Network status
    console.log('\n📊 Pyth Network Status:');
    const status = await pythOracle.getPriceFeedStatus();
    if (status) {
      console.log(`  Feed ID: ${status.id}`);
      console.log(`  Price: ${status.price?.price || 'Unknown'}`);
      console.log(`  Exponent: ${status.price?.expo || 'Unknown'}`);
      console.log(`  Confidence: ${status.price?.conf || 'Unknown'}`);
    } else {
      console.log('  ❌ Could not fetch price feed status');
    }

    // Cache status
    console.log('\n💾 Cache Status:');
    const cacheStats = pythOracle.getCacheStats();
    console.log(`  Size: ${cacheStats.size} entries`);
    if (cacheStats.entries.length > 0) {
      const oldest = cacheStats.entries.reduce((oldest, entry) => 
        entry.age > oldest.age ? entry : oldest, cacheStats.entries[0]);
      const newest = cacheStats.entries.reduce((newest, entry) => 
        entry.age < newest.age ? entry : newest, cacheStats.entries[0]);
      console.log(`  Oldest: ${new Date(Date.now() - oldest.age).toISOString()}`);
      console.log(`  Newest: ${new Date(Date.now() - newest.age).toISOString()}`);
    } else {
      console.log(`  Oldest: None`);
      console.log(`  Newest: None`);
    }

    // Current prices
    console.log('\n💰 Current Prices:');
    const btcPrice = await pythOracle.fetchBtcPrice();
    const xmblPrice = await priceOracle.getCurrentPrice();
    const tokensMinted = await priceOracle.tokensMinted();
    
    console.log(`  BTC: ${btcPrice ? `$${btcPrice.toFixed(2)}` : 'Unknown'}`);
    console.log(`  XMBL: ${ethers.formatUnits(xmblPrice, 8)} satoshis`);
    console.log(`  Tokens Minted: ${tokensMinted}`);

    // Network fee calculation
    const testAmount = ethers.parseEther('1'); // 1 ETH
    const networkFee = await priceOracle.calculateNetworkFee(testAmount);
    console.log(`  Network Fee (1 ETH): ${ethers.formatUnits(networkFee, 8)} satoshis`);

  } catch (error) {
    console.error('❌ Failed to show price status:', error);
  }
}

async function exportPriceData(data: any, format: string) {
  const timestamp = new Date().toISOString();
  
  switch (format.toLowerCase()) {
    case 'json':
      console.log('\n📄 JSON Format:');
      console.log(JSON.stringify(data, null, 2));
      break;
      
    case 'csv':
      console.log('\n📄 CSV Format:');
      if (Array.isArray(data)) {
        console.log('timestamp,btcPrice,xmblPrice,tokensMinted,network');
        data.forEach(item => {
          console.log(`${item.timestamp},${item.btcPrice || 'null'},${item.xmblPrice},${item.tokensMinted},${item.network}`);
        });
      } else {
        console.log('timestamp,btcPrice,xmblPrice,tokensMinted,network');
        console.log(`${data.timestamp},${data.btcPrice || 'null'},${data.xmblPrice},${data.tokensMinted},${data.network}`);
      }
      break;
      
    case 'table':
      console.log('\n📊 Table Format:');
      console.log('┌─────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
      console.log('│ Timestamp           │ BTC Price   │ XMBL Price  │ Tokens     │ Network     │');
      console.log('├─────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
      
      if (Array.isArray(data)) {
        data.forEach(item => {
          const timestamp = new Date(item.timestamp).toISOString().slice(0, 19);
          const btcPrice = item.btcPrice ? `$${item.btcPrice.toFixed(2)}` : 'N/A';
          const xmblPrice = `${item.xmblPrice} sats`;
          const tokens = item.tokensMinted.toString();
          const network = item.network;
          
          console.log(`│ ${timestamp.padEnd(19)} │ ${btcPrice.padEnd(11)} │ ${xmblPrice.padEnd(11)} │ ${tokens.padEnd(11)} │ ${network.padEnd(11)} │`);
        });
      } else {
        const timestamp = new Date(data.timestamp).toISOString().slice(0, 19);
        const btcPrice = data.btcPrice ? `$${data.btcPrice.toFixed(2)}` : 'N/A';
        const xmblPrice = `${data.xmblPrice} sats`;
        const tokens = data.tokensMinted.toString();
        const network = data.network;
        
        console.log(`│ ${timestamp.padEnd(19)} │ ${btcPrice.padEnd(11)} │ ${xmblPrice.padEnd(11)} │ ${tokens.padEnd(11)} │ ${network.padEnd(11)} │`);
      }
      
      console.log('└─────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
      break;
      
    default:
      console.log('\n📄 Raw Data:');
      console.log(data);
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

export { main as fetchPrices };
