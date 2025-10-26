#!/usr/bin/env ts-node

import hre from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

async function main() {
  const userAddress = "0xCB0c6BdA178a28e34C1132c53dDeBA24A4DDD5df";
  const tokensToActivate = 5; // Activate 5 tokens at once
  const chainId = 11155111;
  
  console.log('🚀 XMBL Bulk Token Activation Script');
  console.log('====================================');
  console.log(`User: ${userAddress}`);
  console.log(`Tokens to activate: ${tokensToActivate}`);
  console.log(`Chain ID: ${chainId}`);
  console.log('');

  try {
    // Load deployment config
    const deploymentFile = join(__dirname, '..', 'deployments', 'sepolia.json');
    const deploymentConfig = JSON.parse(readFileSync(deploymentFile, 'utf8'));
    
    const priceOracleAddress = deploymentConfig.contracts.PriceOracle.address;
    const xmblTokenAddress = deploymentConfig.contracts.XMBLToken.address;

    console.log(`Using PriceOracle: ${priceOracleAddress}`);
    console.log(`Using XMBLToken: ${xmblTokenAddress}`);

    // Connect to contracts
    const provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
    const signer = new hre.ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
    const PriceOracleFactory = await hre.ethers.getContractFactory('PriceOracle');
    const XMBLTokenFactory = await hre.ethers.getContractFactory('XMBLToken');
    
    const priceOracle = PriceOracleFactory.attach(priceOracleAddress).connect(signer);
    const xmblToken = XMBLTokenFactory.attach(xmblTokenAddress).connect(signer);

    console.log('\n=== STEP 1: Calculate Bulk Cost ===');
    
    // Calculate bulk cost
    const bulkCost = await priceOracle.calculateBulkCost(tokensToActivate);
    console.log(`Bulk cost for ${tokensToActivate} tokens: ${bulkCost.toString()} satoshis`);
    
    console.log('\n=== STEP 2: Activate Bulk Tokens ===');
    
    // Activate bulk tokens
    const activateTx = await priceOracle.activateBulkTokens(tokensToActivate);
    
    console.log(`Bulk activation transaction sent: ${activateTx.hash}`);
    const activateReceipt = await activateTx.wait();
    console.log(`Bulk activation confirmed in block: ${activateReceipt.blockNumber}`);
    
    console.log('\n=== STEP 3: Grant MINTER_ROLE ===');
    
    // Grant MINTER_ROLE to the signer
    const MINTER_ROLE = await xmblToken.MINTER_ROLE();
    const grantRoleTx = await xmblToken.grantRole(MINTER_ROLE, signer.address);
    console.log(`Grant role transaction sent: ${grantRoleTx.hash}`);
    const grantRoleReceipt = await grantRoleTx.wait();
    console.log(`Grant role confirmed in block: ${grantRoleReceipt.blockNumber}`);
    
    console.log('\n=== STEP 4: Mint XMBL NFTs ===');
    
    // Get current price for deposit value
    const currentPrice = await priceOracle.currentPrice();
    console.log(`Current price after bulk activation: ${currentPrice.toString()} satoshis`);
    
    // Mint NFTs in batch
    const mintTx = await xmblToken.batchMintWithTBA(
      [userAddress], // recipients array
      [bulkCost], // deposit values array
      [priceOracleAddress] // token addresses array
    );
    
    console.log(`NFT batch minting transaction sent: ${mintTx.hash}`);
    const mintReceipt = await mintTx.wait();
    console.log(`NFT batch minting confirmed in block: ${mintReceipt.blockNumber}`);
    
    console.log('\n✅ Bulk activation and NFT minting completed successfully!');
    console.log(`Bulk Activation Transaction Hash: ${activateTx.hash}`);
    console.log(`Grant Role Transaction Hash: ${grantRoleTx.hash}`);
    console.log(`NFT Batch Minting Transaction Hash: ${mintTx.hash}`);
    console.log(`Total Gas Used: ${(Number(activateReceipt.gasUsed) + Number(grantRoleReceipt.gasUsed) + Number(mintReceipt.gasUsed)).toString()}`);

  } catch (error) {
    console.error('❌ Bulk activation failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
