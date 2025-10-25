#!/usr/bin/env ts-node

import hre from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

interface ActivationConfig {
  user: string;
  amount: string;
  token: string;
  chainId: number;
  depositContractAddress: string;
}

async function main() {
  const userAddress = "0xCB0c6BdA178a28e34C1132c53dDeBA24A4DDD5df";
  const amount = "1000000000000000000";
  const tokenAddress = "0x040E975E8de64a0eF09288624fd551f4c9336b74";
  const chainId = 11155111;
  
  console.log('🚀 XMBL Token Activation Script');
  console.log('================================');
  console.log(`User: ${userAddress}`);
  console.log(`Amount: ${amount}`);
  console.log(`Token: ${tokenAddress}`);
  console.log(`Chain ID: ${chainId}`);
  console.log('');

  try {
    // Load deployment config
    const deploymentFile = join(__dirname, '..', 'deployments', 'sepolia.json');
    const deploymentConfig = JSON.parse(readFileSync(deploymentFile, 'utf8'));
    
    const depositManagerAddress = deploymentConfig.contracts.DepositManager.address;
    const chainDepositAddress = deploymentConfig.contracts.ChainDepositContract_Ethereum.address;
    const priceOracleAddress = deploymentConfig.contracts.PriceOracle.address;

    console.log(`Using DepositManager: ${depositManagerAddress}`);
    console.log(`Using ChainDepositContract: ${chainDepositAddress}`);
    console.log(`Using PriceOracle: ${priceOracleAddress}`);

    // Connect to contracts
    const [signer] = await hre.ethers.getSigners();
    const DepositManagerFactory = await hre.ethers.getContractFactory('DepositManager');
    const ChainDepositContractFactory = await hre.ethers.getContractFactory('ChainDepositContract');
    const PriceOracleFactory = await hre.ethers.getContractFactory('PriceOracle');
    
    const depositManager = DepositManagerFactory.attach(depositManagerAddress).connect(signer);
    const chainDepositContract = ChainDepositContractFactory.attach(chainDepositAddress).connect(signer);
    const priceOracle = PriceOracleFactory.attach(priceOracleAddress).connect(signer);

    console.log('\n=== STEP 1: Activate Token ===');
    
    // Activate token directly - skip state checks
    const activateTx = await priceOracle.activateToken();
    
    console.log(`Activation transaction sent: ${activateTx.hash}`);
    const activateReceipt = await activateTx.wait();
    console.log(`Activation confirmed in block: ${activateReceipt.blockNumber}`);
    
    console.log('\n✅ Activation completed successfully!');
    console.log(`Transaction Hash: ${activateTx.hash}`);
    console.log(`Gas Used: ${activateReceipt.gasUsed.toString()}`);

  } catch (error) {
    console.error('❌ Activation failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});