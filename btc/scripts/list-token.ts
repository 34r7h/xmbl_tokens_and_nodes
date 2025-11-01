#!/usr/bin/env ts-node

import { StacksTestnet, StacksMainnet } from '@stacks/network';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  standardPrincipalCV,
  uintCV,
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
 * List a token for resale
 */
async function listToken(tokenId: number, askingPrice: number): Promise<string> {
  try {
    console.log(`Listing token ${tokenId} for ${askingPrice} microstacks`);

    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'list-for-sale',
      functionArgs: [
        uintCV(tokenId),
        uintCV(askingPrice)
      ],
      senderKey: privateKey,
      network,
      anchorMode: AnchorMode.Any,
      fee: 1000,
    });

    const broadcast = await broadcastTransaction(tx, network);
    console.log(`Token listed! TX: ${broadcast.txid}`);
    return broadcast.txid;
  } catch (error) {
    console.error('Error listing token:', error);
    throw error;
  }
}

/**
 * Unlist a token
 */
async function unlistToken(tokenId: number): Promise<string> {
  try {
    console.log(`Unlisting token ${tokenId}`);

    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'unlist',
      functionArgs: [uintCV(tokenId)],
      senderKey: privateKey,
      network,
      anchorMode: AnchorMode.Any,
      fee: 1000,
    });

    const broadcast = await broadcastTransaction(tx, network);
    console.log(`Token unlisted! TX: ${broadcast.txid}`);
    return broadcast.txid;
  } catch (error) {
    console.error('Error unlisting token:', error);
    throw error;
  }
}

/**
 * Buy a listed token (preferred over minting new)
 */
async function buyListedToken(tokenId: number, paymentAmount: number): Promise<string> {
  try {
    console.log(`Buying listed token ${tokenId} for ${paymentAmount} microstacks`);

    // Payment must be sent with the contract call
    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName: 'buy-listed-token',
      functionArgs: [uintCV(tokenId)],
      senderKey: privateKey,
      network,
      anchorMode: AnchorMode.Any,
      fee: 1000,
    });

    const broadcast = await broadcastTransaction(tx, network);
    console.log(`Token purchased! TX: ${broadcast.txid}`);
    return broadcast.txid;
  } catch (error) {
    console.error('Error buying token:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'list') {
    const tokenId = parseInt(args[1]);
    const price = parseInt(args[2]);
    listToken(tokenId, price).catch(console.error);
  } else if (command === 'unlist') {
    const tokenId = parseInt(args[1]);
    unlistToken(tokenId).catch(console.error);
  } else if (command === 'buy') {
    const tokenId = parseInt(args[1]);
    const price = parseInt(args[2]);
    buyListedToken(tokenId, price).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  list <tokenId> <price>  - List token for resale');
    console.log('  unlist <tokenId>        - Unlist token');
    console.log('  buy <tokenId> <price>   - Buy listed token');
  }
}

export { listToken, unlistToken, buyListedToken };

