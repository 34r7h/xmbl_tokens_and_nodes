#!/usr/bin/env ts-node

/**
 * Deployment script for XMBL Token on Stacks
 * Deploys main contract and proxy contract
 * Sets up owner permissions and initial configuration
 */

import { 
  AnchorMode, 
  broadcastTransaction, 
  makeContractDeploy, 
  PostConditionMode,
  getAddressFromPrivateKey,
  StacksNetwork,
  StacksTestnet,
  StacksMainnet
} from '@stacks/transactions';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeployConfig {
  network: 'testnet' | 'mainnet';
  contractPath: string;
  contractName: string;
}

interface DeploymentCosts {
  contractDeployment: string;
  proxyDeployment: string;
  totalDeployment: string;
  gasPrice: string;
  estimatedUSD: string;
}

class XMBLDeployer {
  private network: StacksNetwork;
  private privateKey: string;
  private deployerAddress: string;
  private contractsPath: string;

  constructor(network: 'testnet' | 'mainnet', privateKey: string) {
    this.network = network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
    this.privateKey = privateKey;
    this.deployerAddress = getAddressFromPrivateKey(privateKey, this.network.version);
    this.contractsPath = join(__dirname, '../contracts');
  }

  /**
   * Deploy main XMBL Token contract
   */
  async deployTokenContract(): Promise<{ txid: string; contractAddress: string }> {
    const contractCode = readFileSync(join(this.contractsPath, 'xmbl-token.clar'), 'utf-8');

    const deployTxOptions = {
      contractName: 'xmbl-token',
      codeBody: contractCode,
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 50000, // Estimated deployment fee
    };

    const transaction = await makeContractDeploy(deployTxOptions);
    const broadcastResponse = await broadcastTransaction(transaction, this.network);

    const contractAddress = `${this.deployerAddress}.xmbl-token`;

    console.log(`✅ Token contract deployed`);
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Tx ID: ${broadcastResponse.txid}`);
    console.log(`   Gas used: ~50,000 units`);

    return { txid: broadcastResponse.txid, contractAddress };
  }

  /**
   * Deploy proxy contract
   */
  async deployProxyContract(): Promise<{ txid: string; contractAddress: string }> {
    const contractCode = readFileSync(join(this.contractsPath, 'xmbl-proxy.clar'), 'utf-8');

    const deployTxOptions = {
      contractName: 'xmbl-proxy',
      codeBody: contractCode,
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 30000, // Estimated deployment fee
    };

    const transaction = await makeContractDeploy(deployTxOptions);
    const broadcastResponse = await broadcastTransaction(transaction, this.network);

    const contractAddress = `${this.deployerAddress}.xmbl-proxy`;

    console.log(`✅ Proxy contract deployed`);
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   Tx ID: ${broadcastResponse.txid}`);
    console.log(`   Gas used: ~30,000 units`);

    return { txid: broadcastResponse.txid, contractAddress };
  }

  /**
   * Initialize token contract (set owner)
   */
  async initializeTokenContract(contractAddress: string): Promise<string> {
    const { makeContractCall } = await import('@stacks/transactions');

    const txOptions = {
      contractAddress: contractAddress.split('.')[0],
      contractName: 'xmbl-token',
      functionName: 'initialize',
      functionArgs: [this.deployerAddress],
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 1000,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, this.network);

    console.log(`✅ Token contract initialized`);
    console.log(`   Owner: ${this.deployerAddress}`);
    console.log(`   Tx ID: ${broadcastResponse.txid}`);

    return broadcastResponse.txid;
  }

  /**
   * Initialize proxy contract
   */
  async initializeProxyContract(proxyAddress: string, implementationAddress: string): Promise<string> {
    const { makeContractCall } = await import('@stacks/transactions');

    const txOptions = {
      contractAddress: proxyAddress.split('.')[0],
      contractName: 'xmbl-proxy',
      functionName: 'initialize',
      functionArgs: [this.deployerAddress, implementationAddress],
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 1000,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, this.network);

    console.log(`✅ Proxy contract initialized`);
    console.log(`   Implementation: ${implementationAddress}`);
    console.log(`   Tx ID: ${broadcastResponse.txid}`);

    return broadcastResponse.txid;
  }

  /**
   * Set pool addresses
   */
  async setPoolAddresses(contractAddress: string, devPool: string, liquidityPool: string): Promise<void> {
    const { makeContractCall } = await import('@stacks/transactions');

    // Set development pool
    const devTx = await makeContractCall({
      contractAddress: contractAddress.split('.')[0],
      contractName: 'xmbl-token',
      functionName: 'set-development-pool',
      functionArgs: [devPool],
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 1000,
    });
    await broadcastTransaction(devTx, this.network);

    // Set liquidity pool
    const liqTx = await makeContractCall({
      contractAddress: contractAddress.split('.')[0],
      contractName: 'xmbl-token',
      functionName: 'set-liquidity-pool',
      functionArgs: [liquidityPool],
      senderKey: this.privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 1000,
    });
    await broadcastTransaction(liqTx, this.network);

    console.log(`✅ Pool addresses set`);
    console.log(`   Development Pool: ${devPool}`);
    console.log(`   Liquidity Pool: ${liquidityPool}`);
  }

  /**
   * Get deployment cost estimates
   */
  getDeploymentCosts(): DeploymentCosts {
    const gasPrice = 0.00001; // STX per gas unit (approximate)
    const contractGas = 50000;
    const proxyGas = 30000;
    const totalGas = contractGas + proxyGas;

    // Estimate STX price (varies, using ~$1-2 USD per STX as example)
    const stxPriceUSD = 1.5;
    const totalSTX = totalGas * gasPrice;
    const estimatedUSD = totalSTX * stxPriceUSD;

    return {
      contractDeployment: `${contractGas} gas units (~${(contractGas * gasPrice).toFixed(2)} STX)`,
      proxyDeployment: `${proxyGas} gas units (~${(proxyGas * gasPrice).toFixed(2)} STX)`,
      totalDeployment: `${totalGas} gas units (~${totalSTX.toFixed(2)} STX)`,
      gasPrice: `${gasPrice} STX per gas unit`,
      estimatedUSD: `~$${estimatedUSD.toFixed(2)} USD`
    };
  }
}

// Main deployment function
async function main() {
  const network = (process.env.STACKS_NETWORK || 'testnet') as 'testnet' | 'mainnet';
  const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_KEY;

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY or DEPLOYER_KEY environment variable required');
    process.exit(1);
  }

  const deployer = new XMBLDeployer(network, privateKey);

  console.log('🚀 Deploying XMBL Token on Stacks');
  console.log(`   Network: ${network}`);
  console.log(`   Deployer: ${deployer['deployerAddress']}\n`);

  // Show cost estimates
  const costs = deployer.getDeploymentCosts();
  console.log('💰 Deployment Cost Estimates:');
  console.log(`   Contract: ${costs.contractDeployment}`);
  console.log(`   Proxy: ${costs.proxyDeployment}`);
  console.log(`   Total: ${costs.totalDeployment}`);
  console.log(`   Estimated: ${costs.estimatedUSD}\n`);

  try {
    // Deploy main contract
    const tokenDeploy = await deployer.deployTokenContract();
    console.log('');

    // Deploy proxy contract
    const proxyDeploy = await deployer.deployProxyContract();
    console.log('');

    // Initialize token contract
    await deployer.initializeTokenContract(tokenDeploy.contractAddress);
    console.log('');

    // Initialize proxy contract
    await deployer.initializeProxyContract(proxyDeploy.contractAddress, tokenDeploy.contractAddress);
    console.log('');

    // Set pool addresses (if provided)
    const devPool = process.env.DEV_POOL;
    const liquidityPool = process.env.LIQUIDITY_POOL;
    if (devPool && liquidityPool) {
      await deployer.setPoolAddresses(tokenDeploy.contractAddress, devPool, liquidityPool);
      console.log('');
    }

    console.log('✅ Deployment Complete!');
    console.log(`   Token Contract: ${tokenDeploy.contractAddress}`);
    console.log(`   Proxy Contract: ${proxyDeploy.contractAddress}`);
    console.log(`\n📝 Update config/stacks.json with these addresses`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { XMBLDeployer, DeploymentCosts };

