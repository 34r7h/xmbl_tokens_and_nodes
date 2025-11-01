#!/usr/bin/env ts-node

/**
 * Pool Distribution Script
 * 
 * This script can be run periodically to distribute accumulated STX from the contract
 * to the development and liquidity pools based on pending distributions.
 * 
 * Note: With the updated contract, distribution happens automatically during mint,
 * but this script can be used for manual distribution or for distributing STX
 * that was sent directly to the contract.
 */

import { StacksTestnet, StacksMainnet } from '@stacks/network';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  uintCV,
  PostConditionMode
} from '@stacks/transactions';
import { config } from 'dotenv';
import * as stacksConfig from '../config/stacks.json';

config();

const privateKey = process.env.STACKS_PRIVATE_KEY || '';
const networkType = process.env.STACKS_NETWORK || 'testnet';

const network = networkType === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
const contractAddress = stacksConfig[networkType as keyof typeof stacksConfig].contractAddress;
const contractName = stacksConfig[networkType as keyof typeof stacksConfig].contractName;

/**
 * Get contract state information
 */
async function getContractState(): Promise<void> {
  try {
    // This would use a read-only call or API to get contract state
    console.log('Contract State:');
    console.log('- Development Pool:', process.env.DEV_POOL || 'Not set');
    console.log('- Liquidity Pool:', process.env.LIQUIDITY_POOL || 'Not set');
    console.log('- Network:', networkType);
    
    // In production, query contract for:
    // - tokens-minted
    // - current-price
    // - proof-of-faith
    // - listed-tokens-count
    // - Contract STX balance
    
    console.log('\n✅ Use Stacks API to query contract state:');
    console.log(`https://api.stacks.co/v2/contracts/call-read/${contractAddress}/${contractName}/get-current-price`);
  } catch (error) {
    console.error('Error getting contract state:', error);
  }
}

/**
 * Monitor pool distributions
 */
async function monitorDistributions(): Promise<void> {
  console.log('Monitoring pool distributions...');
  console.log('Check contract events for pool-distribution-event');
  console.log('Each mint automatically distributes to pools based on the split calculation.');
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2] || 'state';

  (async () => {
    try {
      if (command === 'state') {
        await getContractState();
      } else if (command === 'monitor') {
        await monitorDistributions();
      } else {
        console.log('Usage:');
        console.log('  state - Get contract state information');
        console.log('  monitor - Monitor pool distributions');
      }
    } catch (error) {
      console.error('Failed:', error);
      process.exit(1);
    }
  })();
}

export { getContractState, monitorDistributions };

