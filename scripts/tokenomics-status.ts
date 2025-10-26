#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TokenomicsService } from '../services/TokenomicsService';

config();

async function main() {
  try {
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
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ PRIVATE_KEY not found in environment variables');
      process.exit(1);
    }
    const signer = new ethers.Wallet(privateKey, provider);
    
    if (!signer || !signer.address) {
      console.error('❌ No signer found. Check your private key and network configuration.');
      process.exit(1);
    }
    console.log(`Tokenomics status with account: ${signer.address}`);

    const priceOracleAddress = process.env.PRICE_ORACLE_ADDRESS || (deploymentConfig.contracts.PriceOracle ? deploymentConfig.contracts.PriceOracle.address : '0x19d9ebAe7d0883f15f64D0519D35526FFDff0891');
    console.log(`Using PriceOracle: ${priceOracleAddress}`);
    
    const tokenomicsService = new TokenomicsService(
      signer.provider,
      signer,
      priceOracleAddress
    );

    const tokensMinted = await tokenomicsService.getTokensMinted();
    const currentPrice = await tokenomicsService.getCurrentPrice();
    const calculatedPrice = await tokenomicsService.calculatePrice(tokensMinted);

    console.log(`Tokens Minted: ${tokensMinted}`);
    console.log(`Current Price: ${ethers.formatUnits(currentPrice, 8)} satoshis`);
    console.log(`Calculated Price: ${ethers.formatUnits(calculatedPrice, 8)} satoshis`);

  } catch (error) {
    console.error('❌ Tokenomics status failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}