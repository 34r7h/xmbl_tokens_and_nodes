#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

config();

interface DeploymentConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
      transactionHash: string;
    };
  };
  timestamp: string;
}

/**
 * @title Testnet Deployment Script
 * @dev Deploys all contracts to specified testnet
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || 'sepolia';
  const verify = args[1] === 'verify';

  console.log(`🚀 Deploying XMBL Token Contracts to ${network.toUpperCase()}`);
  console.log('=' .repeat(60));

  try {
    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

    // Check if we have enough balance
    if (balance < ethers.parseEther('0.01')) {
      console.error('❌ Insufficient balance for deployment');
      console.log('Please fund your account with testnet ETH');
      process.exit(1);
    }

    const deploymentConfig: DeploymentConfig = {
      network,
      contracts: {},
      timestamp: new Date().toISOString()
    };

    // Deploy PriceOracle
    console.log('\n📊 Deploying PriceOracle...');
    const PriceOracleFactory = await ethers.getContractFactory('PriceOracle');
    const priceOracle = await PriceOracleFactory.deploy(
      '0x0000000000000000000000000000000000000000', // Mock Pyth address for testnet
      '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' // Mock BTC/USD price feed ID
    );
    await priceOracle.waitForDeployment();
    const priceOracleAddress = await priceOracle.getAddress();
    console.log(`✅ PriceOracle deployed at: ${priceOracleAddress}`);

    deploymentConfig.contracts.PriceOracle = {
      address: priceOracleAddress,
      transactionHash: priceOracle.deploymentTransaction()?.hash || ''
    };

    // Deploy DepositManager
    console.log('\n🏦 Deploying DepositManager...');
    const DepositManagerFactory = await ethers.getContractFactory('DepositManager');
    const depositManager = await DepositManagerFactory.deploy(priceOracleAddress);
    await depositManager.waitForDeployment();
    const depositManagerAddress = await depositManager.getAddress();
    console.log(`✅ DepositManager deployed at: ${depositManagerAddress}`);

    deploymentConfig.contracts.DepositManager = {
      address: depositManagerAddress,
      transactionHash: depositManager.deploymentTransaction()?.hash || ''
    };

    // Deploy ChainDepositContract
    console.log('\n🔗 Deploying ChainDepositContract...');
    const ChainDepositContractFactory = await ethers.getContractFactory('ChainDepositContract');
    const chainDepositContract = await ChainDepositContractFactory.deploy(
      depositManagerAddress,
      priceOracleAddress
    );
    await chainDepositContract.waitForDeployment();
    const chainDepositContractAddress = await chainDepositContract.getAddress();
    console.log(`✅ ChainDepositContract deployed at: ${chainDepositContractAddress}`);

    deploymentConfig.contracts.ChainDepositContract = {
      address: chainDepositContractAddress,
      transactionHash: chainDepositContract.deploymentTransaction()?.hash || ''
    };

    // Save deployment configuration
    const deploymentsDir = join(process.cwd(), 'deployments');
    if (!existsSync(deploymentsDir)) {
      mkdirSync(deploymentsDir, { recursive: true });
    }

    const configPath = join(deploymentsDir, `${network}.json`);
    writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
    console.log(`\n📄 Deployment config saved to: ${configPath}`);

    // Display deployment summary
    console.log('\n✅ Deployment Summary:');
    console.log('=' .repeat(40));
    console.log(`Network: ${network.toUpperCase()}`);
    console.log(`PriceOracle: ${priceOracleAddress}`);
    console.log(`DepositManager: ${depositManagerAddress}`);
    console.log(`ChainDepositContract: ${chainDepositContractAddress}`);
    console.log(`Total Gas Used: ${await getTotalGasUsed([priceOracle, depositManager, chainDepositContract])}`);

    // Test basic functionality
    console.log('\n🧪 Testing deployed contracts...');
    await testDeployedContracts(priceOracle, depositManager, chainDepositContract);

    console.log('\n🎉 Testnet deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your .env file with the deployed addresses');
    console.log('2. Run monitoring scripts to test the system');
    console.log('3. Test cross-chain functionality');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

async function getTotalGasUsed(contracts: any[]): Promise<string> {
  let totalGas = 0n;
  for (const contract of contracts) {
    const receipt = await contract.deploymentTransaction()?.wait();
    if (receipt) {
      totalGas += receipt.gasUsed;
    }
  }
  return totalGas.toString();
}

async function testDeployedContracts(priceOracle: any, depositManager: any, chainDepositContract: any) {
  try {
    // Test PriceOracle
    const currentPrice = await priceOracle.getCurrentPrice();
    console.log(`  PriceOracle current price: ${currentPrice} satoshis`);

    // Test DepositManager
    const queueStatus = await depositManager.getQueueStatus();
    console.log(`  DepositManager queue status: ${queueStatus.totalActivations} total activations`);

    // Test ChainDepositContract
    const stats = await chainDepositContract.getStats();
    console.log(`  ChainDepositContract stats: ${stats.totalDepositsCount} total deposits`);

    console.log('✅ All contracts are functioning correctly');
  } catch (error) {
    console.log(`⚠️  Contract testing failed: ${error}`);
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

export { main as deployTestnet };
