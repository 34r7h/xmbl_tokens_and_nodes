#!/usr/bin/env ts-node

import { StacksTestnet, StacksMainnet } from '@stacks/network';
import {
  makeContractCall,
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
  uintCV,
  standardPrincipalCV,
  PostConditionMode
} from '@stacks/transactions';
import { config } from 'dotenv';
import * as stacksConfig from '../config/stacks.json';

config();

const privateKey = process.env.STACKS_PRIVATE_KEY || '';
const senderAddress = process.env.STACKS_SENDER_ADDRESS || '';
const networkType = process.env.STACKS_NETWORK || 'testnet';

const network = networkType === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
const contractAddress = stacksConfig[networkType as keyof typeof stacksConfig].contractAddress;
const contractName = stacksConfig[networkType as keyof typeof stacksConfig].contractName;
const fullContractAddress = `${contractAddress}.${contractName}`;

/**
 * Buy a token: checks listings first, then mints if none available
 * Payment is sent to contract, then buy function is called
 */
async function buyToken(paymentAmount: bigint, listedTokenId?: number): Promise<string> {
  try {
    console.log(`Buying token with payment: ${paymentAmount} microstacks`);
    if (listedTokenId !== undefined) {
      console.log(`Target listed token ID: ${listedTokenId}`);
    }

    // Step 1: Send STX payment to contract
    const paymentTx = await makeSTXTokenTransfer({
      recipient: fullContractAddress,
      amount: paymentAmount,
      senderKey: privateKey,
      network: network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 1000
    });

    const paymentBroadcast = await broadcastTransaction(paymentTx, network);
    console.log(`Payment transaction: ${paymentBroadcast.txid}`);

    // Wait for confirmation (in production, poll for confirmation)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Call buy function (or buy-listed-token if specific token)
    const functionName = listedTokenId !== undefined ? 'buy-listed-token' : 'buy';
    const functionArgs = listedTokenId !== undefined
      ? [uintCV(listedTokenId), uintCV(paymentAmount.toString())]
      : [uintCV(paymentAmount.toString())];

    const buyTx = await makeContractCall({
      contractAddress: contractAddress.split('.')[0],
      contractName: contractAddress.split('.')[1],
      functionName: functionName,
      functionArgs: functionArgs,
      senderKey: privateKey,
      network: network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 15000
    });

    const buyBroadcast = await broadcastTransaction(buyTx, network);
    console.log(`Buy transaction: ${buyBroadcast.txid}`);

    return buyBroadcast.txid;
  } catch (error) {
    console.error('Error buying token:', error);
    throw error;
  }
}

/**
 * List a token for sale
 */
async function listTokenForSale(tokenId: number, askingPrice: bigint): Promise<string> {
  try {
    console.log(`Listing token ${tokenId} for ${askingPrice} microstacks`);

    const listTx = await makeContractCall({
      contractAddress: contractAddress.split('.')[0],
      contractName: contractAddress.split('.')[1],
      functionName: 'list-for-sale',
      functionArgs: [
        uintCV(tokenId),
        uintCV(askingPrice.toString())
      ],
      senderKey: privateKey,
      network: network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 5000
    });

    const broadcast = await broadcastTransaction(listTx, network);
    console.log(`List transaction: ${broadcast.txid}`);
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

    const unlistTx = await makeContractCall({
      contractAddress: contractAddress.split('.')[0],
      contractName: contractAddress.split('.')[1],
      functionName: 'unlist',
      functionArgs: [uintCV(tokenId)],
      senderKey: privateKey,
      network: network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 5000
    });

    const broadcast = await broadcastTransaction(unlistTx, network);
    console.log(`Unlist transaction: ${broadcast.txid}`);
    return broadcast.txid;
  } catch (error) {
    console.error('Error unlisting token:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  (async () => {
    try {
      if (command === 'buy') {
        const paymentAmount = BigInt(args[0] || '1000000');
        const tokenId = args[1] ? parseInt(args[1]) : undefined;
        const txId = await buyToken(paymentAmount, tokenId);
        console.log(`✅ Buy successful! TX: ${txId}`);
      } else if (command === 'list') {
        const tokenId = parseInt(args[0]);
        const price = BigInt(args[1] || '1000000');
        const txId = await listTokenForSale(tokenId, price);
        console.log(`✅ Token listed! TX: ${txId}`);
      } else if (command === 'unlist') {
        const tokenId = parseInt(args[0]);
        const txId = await unlistToken(tokenId);
        console.log(`✅ Token unlisted! TX: ${txId}`);
      } else {
        console.log('Usage:');
        console.log('  buy <payment-amount> [token-id] - Buy token (checks listings first)');
        console.log('  list <token-id> <price> - List token for sale');
        console.log('  unlist <token-id> - Remove token from sale');
      }
    } catch (error) {
      console.error('Failed:', error);
      process.exit(1);
    }
  })();
}

export { buyToken, listTokenForSale, unlistToken };

