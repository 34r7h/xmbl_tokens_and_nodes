#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
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

/**
 * @title Activation Script
 * @dev Handles token activation through cross-chain deposits
 * Creates intents via Avail Nexus and processes sequential activations
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('Usage: npm run activate <user_address> <amount> <token_address> <chain_id>');
    console.log('Example: npm run activate 0x1234... 1000000000000000000 0x0000... 1');
    console.log('Token address: 0x0000... for native currency (ETH)');
    process.exit(1);
  }

  const [userAddress, amount, tokenAddress, chainIdStr] = args;
  const chainId = parseInt(chainIdStr);

  console.log(`Activating tokens for user: ${userAddress}`);
  console.log(`Amount: ${amount}`);
  console.log(`Token: ${tokenAddress === '0x0000000000000000000000000000000000000000' ? 'Native (ETH)' : tokenAddress}`);
  console.log(`Chain ID: ${chainId}`);

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

    // Get contract addresses
    const depositManagerAddress = deploymentConfig.contracts.DepositManager.address;
    const chainContractName = `ChainDepositContract_${getChainName(chainId)}`;
    const chainDepositAddress = deploymentConfig.contracts[chainContractName]?.address;

    if (!chainDepositAddress) {
      console.error(`❌ Chain deposit contract not found for chain ID ${chainId}`);
      process.exit(1);
    }

    console.log(`Using DepositManager: ${depositManagerAddress}`);
    console.log(`Using ChainDepositContract: ${chainDepositAddress}`);

    // Connect to contracts
    const [signer] = await ethers.getSigners();
    const DepositManagerFactory = await ethers.getContractFactory('DepositManager');
    const ChainDepositContractFactory = await ethers.getContractFactory('ChainDepositContract');
    
    const depositManager = DepositManagerFactory.attach(depositManagerAddress);
    const chainDepositContract = ChainDepositContractFactory.attach(chainDepositAddress);

    // Check if user has sufficient balance
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      const balance = await signer.provider.getBalance(userAddress);
      if (BigInt(balance) < BigInt(amount)) {
        console.error('❌ Insufficient native currency balance');
        process.exit(1);
      }
    }

    console.log('\n=== STEP 1: Making Deposit ===');
    
    // Make deposit
    let depositTx;
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      // Native currency deposit
      depositTx = await chainDepositContract.deposit(
        ethers.ZeroAddress, // Native currency
        amount,
        { value: amount }
      );
    } else {
      // ERC20 token deposit (requires approval first)
      console.log('⚠️  ERC20 token deposits require prior approval. This is a mock implementation.');
      depositTx = await chainDepositContract.deposit(tokenAddress, amount);
    }

    console.log(`Deposit transaction submitted: ${depositTx.hash}`);
    const depositReceipt = await depositTx.wait();
    console.log(`Deposit confirmed in block: ${depositReceipt?.blockNumber}`);

    // Extract deposit ID from events
    const depositEvent = depositReceipt?.logs.find(log => {
      try {
        const parsed = chainDepositContract.interface.parseLog(log);
        return parsed?.name === 'DepositMade';
      } catch {
        return false;
      }
    });

    if (!depositEvent) {
      console.error('❌ Could not find deposit event');
      process.exit(1);
    }

    const parsedEvent = chainDepositContract.interface.parseLog(depositEvent);
    const depositId = parsedEvent?.args.id;

    console.log(`Deposit ID: ${depositId}`);

    console.log('\n=== STEP 2: Creating Cross-Chain Intent ===');
    
    // Create intent (this would typically be done by Avail Nexus)
    const intentTx = await chainDepositContract.createIntent(depositId);
    console.log(`Intent creation transaction: ${intentTx.hash}`);
    const intentReceipt = await intentTx.wait();
    console.log(`Intent confirmed in block: ${intentReceipt?.blockNumber}`);

    // Extract activation ID from events
    const intentEvent = intentReceipt?.logs.find(log => {
      try {
        const parsed = chainDepositContract.interface.parseLog(log);
        return parsed?.name === 'IntentCreated';
      } catch {
        return false;
      }
    });

    if (!intentEvent) {
      console.error('❌ Could not find intent event');
      process.exit(1);
    }

    const parsedIntentEvent = chainDepositContract.interface.parseLog(intentEvent);
    const activationId = parsedIntentEvent?.args.activationId;

    console.log(`Activation ID: ${activationId}`);

    console.log('\n=== STEP 3: Processing Activation ===');
    
    // Process the activation (this would typically be done by a relayer)
    const activationTx = await depositManager.processNextActivation();
    console.log(`Activation processing transaction: ${activationTx.hash}`);
    const activationReceipt = await activationTx.wait();
    console.log(`Activation confirmed in block: ${activationReceipt?.blockNumber}`);

    // Check activation status
    const activation = await depositManager.getActivation(activationId);
    console.log(`Activation completed: ${activation.completed}`);

    console.log('\n=== STEP 4: Getting Updated Price ===');
    
    // Get updated token price
    const priceOracleAddress = deploymentConfig.contracts.PriceOracle.address;
    const PriceOracleFactory = await ethers.getContractFactory('PriceOracle');
    const priceOracle = PriceOracleFactory.attach(priceOracleAddress);
    
    const currentPrice = await priceOracle.getCurrentPrice();
    const tokensMinted = await priceOracle.tokensMinted();
    
    console.log(`Current XMBL token price: ${ethers.formatUnits(currentPrice, 8)} satoshis`);
    console.log(`Total tokens minted: ${tokensMinted}`);

    console.log('\n✅ Activation completed successfully!');
    console.log('\nSummary:');
    console.log(`- User: ${userAddress}`);
    console.log(`- Amount: ${amount}`);
    console.log(`- Deposit ID: ${depositId}`);
    console.log(`- Activation ID: ${activationId}`);
    console.log(`- Final Price: ${ethers.formatUnits(currentPrice, 8)} satoshis`);
    console.log(`- Tokens Minted: ${tokensMinted}`);

  } catch (error) {
    console.error('❌ Activation failed:', error);
    process.exit(1);
  }
}

function getChainName(chainId: number): string {
  const chainMap: { [key: number]: string } = {
    1: 'Ethereum',
    137: 'Polygon',
    97: 'BSC',
    421614: 'Arbitrum',
    11155420: 'Optimism'
  };
  
  return chainMap[chainId] || 'Unknown';
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

export { main as activate };
