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

    const [signer] = await ethers.getSigners();
    console.log(`Tokenomics status with account: ${signer.address}`);

    const tokenomicsService = new TokenomicsService(
      signer.provider,
      signer,
      process.env.PRICE_ORACLE_ADDRESS || deploymentConfig.contracts.PriceOracle.address
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