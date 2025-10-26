#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';

config();

interface DeploymentConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
      transactionHash: string;
      blockNumber: number;
    };
  };
  timestamp: number;
}

/**
 * @title Deploy Script
 * @dev Deploys all smart contracts to the specified network
 * Supports multiple testnets: Sepolia, Mumbai, BSC Testnet, Arbitrum Sepolia, Optimism Sepolia
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'hardhat';
  console.log(`Deploying to network: ${network}`);

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  const deploymentConfig: DeploymentConfig = {
    network,
    contracts: {},
    timestamp: Date.now()
  };

  try {
    // 1. Deploy PriceOracle
    console.log('\n1. Deploying PriceOracle...');
    const PriceOracleFactory = await ethers.getContractFactory('PriceOracle');
    
    // Real Pyth Network addresses for production
    const pythAddress = network === 'localhost' 
      ? '0x0000000000000000000000000000000000000000' // Mock for localhost
      : '0x4305fb66699c3b2702d4d05cf1b4fc5ec882e73f'; // Real Pyth on Ethereum Sepolia
    const btcUsdPriceId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
    
    const priceOracle = await PriceOracleFactory.connect(deployer).deploy(pythAddress, btcUsdPriceId);
    await priceOracle.waitForDeployment();
    const priceOracleAddress = await priceOracle.getAddress();
    const priceOracleTx = priceOracle.deploymentTransaction();
    
    console.log(`PriceOracle deployed to: ${priceOracleAddress}`);
    console.log(`Transaction hash: ${priceOracleTx?.hash}`);
    
    const priceOracleBlockNumber = priceOracleTx ? await ethers.provider.getBlockNumber() : 0;
    
    deploymentConfig.contracts.PriceOracle = {
      address: priceOracleAddress,
      transactionHash: priceOracleTx?.hash || '',
      blockNumber: priceOracleBlockNumber
    };

    // 2. Deploy DepositManager
    console.log('\n2. Deploying DepositManager...');
    const DepositManagerFactory = await ethers.getContractFactory('DepositManager');
    
    const depositManager = await DepositManagerFactory.connect(deployer).deploy(priceOracleAddress);
    await depositManager.waitForDeployment();
    const depositManagerAddress = await depositManager.getAddress();
    const depositManagerTx = depositManager.deploymentTransaction();
    
    console.log(`DepositManager deployed to: ${depositManagerAddress}`);
    console.log(`Transaction hash: ${depositManagerTx?.hash}`);
    
    const depositManagerBlockNumber = depositManagerTx ? await ethers.provider.getBlockNumber() : 0;
    
    deploymentConfig.contracts.DepositManager = {
      address: depositManagerAddress,
      transactionHash: depositManagerTx?.hash || '',
      blockNumber: depositManagerBlockNumber
    };

    // 3. Deploy ChainDepositContract for each supported chain
    console.log('\n3. Deploying ChainDepositContracts...');
    const supportedChains = [
      { name: 'Ethereum', chainId: 1, network: 'sepolia' },
      { name: 'Polygon', chainId: 137, network: 'mumbai' },
      { name: 'BSC', chainId: 97, network: 'bscTestnet' },
      { name: 'Arbitrum', chainId: 421614, network: 'arbitrumSepolia' },
      { name: 'Optimism', chainId: 11155420, network: 'optimismSepolia' }
    ];

    const ChainDepositContractFactory = await ethers.getContractFactory('ChainDepositContract');
    
    for (const chain of supportedChains) {
      console.log(`\nDeploying ChainDepositContract for ${chain.name} (Chain ID: ${chain.chainId})...`);
      
      const chainDepositContract = await ChainDepositContractFactory.connect(deployer).deploy(
        depositManagerAddress,
        priceOracleAddress
      );
      await chainDepositContract.waitForDeployment();
      const chainDepositAddress = await chainDepositContract.getAddress();
      const chainDepositTx = chainDepositContract.deploymentTransaction();
      
      console.log(`ChainDepositContract for ${chain.name} deployed to: ${chainDepositAddress}`);
      console.log(`Transaction hash: ${chainDepositTx?.hash}`);
      
      const chainDepositBlockNumber = chainDepositTx ? await ethers.provider.getBlockNumber() : 0;
      
      deploymentConfig.contracts[`ChainDepositContract_${chain.name}`] = {
        address: chainDepositAddress,
        transactionHash: chainDepositTx?.hash || '',
        blockNumber: chainDepositBlockNumber
      };
    }

           // 4. Deploy XMBLToken
           console.log('\n4. Deploying XMBLToken...');
           const XMBLTokenFactory = await ethers.getContractFactory('XMBLToken');
           
           // Use deployer address as mock registry and implementation for now
           const mockRegistry = deployer.address;
           const mockImplementation = deployer.address;
           
           const xmblToken = await XMBLTokenFactory.connect(deployer).deploy(
             'XMBL Token',
             'XMBL',
             mockRegistry,
             mockImplementation
           );
           await xmblToken.waitForDeployment();
           const xmblTokenAddress = await xmblToken.getAddress();
           const xmblTokenTx = xmblToken.deploymentTransaction();

           console.log(`XMBLToken deployed to: ${xmblTokenAddress}`);
           console.log(`Transaction hash: ${xmblTokenTx?.hash}`);

           const xmblTokenBlockNumber = xmblTokenTx ? await ethers.provider.getBlockNumber() : 0;

           deploymentConfig.contracts.XMBLToken = {
             address: xmblTokenAddress,
             transactionHash: xmblTokenTx?.hash || '',
             blockNumber: xmblTokenBlockNumber
           };

           // 5. Save deployment configuration
           const configPath = join(process.cwd(), 'deployments', `${network}.json`);
           writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
           console.log(`\nDeployment configuration saved to: ${configPath}`);

    // 5. Display deployment summary
    console.log('\n=== DEPLOYMENT SUMMARY ===');
    console.log(`Network: ${network}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Total contracts deployed: ${Object.keys(deploymentConfig.contracts).length}`);
    console.log('\nContract addresses:');
    for (const [name, config] of Object.entries(deploymentConfig.contracts)) {
      console.log(`  ${name}: ${config.address}`);
    }

           // 6. Generate environment variables for the deployed contracts
           console.log('\n=== ENVIRONMENT VARIABLES ===');
           console.log(`# Add these to your .env file for ${network}:`);
           console.log(`PRICE_ORACLE_ADDRESS=${priceOracleAddress}`);
           console.log(`DEPOSIT_MANAGER_ADDRESS=${depositManagerAddress}`);
           console.log(`XMBL_TOKEN_ADDRESS=${xmblTokenAddress}`);
           console.log(`BTC_POOL_ADDRESS=${deployer.address}`);
           console.log(`# Chain-specific contract addresses:`);
           for (const chain of supportedChains) {
             const contractName = `ChainDepositContract_${chain.name}`;
             const address = deploymentConfig.contracts[contractName]?.address;
             if (address) {
               console.log(`${chain.name.toUpperCase()}_DEPOSIT_CONTRACT=${address}`);
             }
           }

    console.log('\n✅ Deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your .env file with the contract addresses');
    console.log('2. Run verification: npm run verify');
    console.log('3. Test the deployment: npm run test');
    console.log('4. Start monitoring: npm run monitor');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
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

export { main as deploy };
