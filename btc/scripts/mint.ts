#!/usr/bin/env ts-node

/**
 * Helper script to mint XMBL NFT
 * Handles payment transfer and mint call
 */

import {
  makeContractCall,
  makeSTXTokenTransfer,
  AnchorMode,
  PostConditionMode,
  broadcastTransaction,
  StacksNetwork,
  StacksTestnet,
  StacksMainnet
} from '@stacks/transactions';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

async function mintNFT(
  contractAddress: string,
  recipient: string,
  paymentAmount: bigint,
  network: StacksNetwork,
  privateKey: string
): Promise<string> {
  // Step 1: Transfer STX to contract (payment)
  const paymentTx = await makeSTXTokenTransfer({
    recipient: contractAddress,
    amount: paymentAmount,
    senderKey: privateKey,
    network: network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 1000
  });

  const paymentBroadcast = await broadcastTransaction(paymentTx, network);
  console.log(`Payment sent: ${paymentBroadcast.txid}`);
  
  // Wait for confirmation (in production, poll for confirmation)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Call mint function (payment sent separately)
  // Note: In Clarity, we pass payment amount for verification
  // Actual STX transfer happens in step 1
  const mintTx = await makeContractCall({
    contractAddress: contractAddress.split('.')[0],
    contractName: contractAddress.split('.')[1],
    functionName: 'mint',
    functionArgs: [
      recipient,
      paymentAmount.toString()
    ],
    senderKey: privateKey,
    network: network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 15000, // Higher fee for mint operation
    // Send payment as part of transaction
    sponsored: false
  });

  const mintBroadcast = await broadcastTransaction(mintTx, network);
  console.log(`Mint transaction: ${mintBroadcast.txid}`);
  
  return mintBroadcast.txid;
}

// CLI usage
if (require.main === module) {
  const network = (process.env.STACKS_NETWORK || 'testnet') as 'testnet' | 'mainnet';
  const stacksNetwork = network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const recipient = process.argv[2];
  const paymentAmount = BigInt(process.argv[3] || '1000000'); // Default 1 STX in microstacks

  if (!privateKey || !contractAddress || !recipient) {
    console.error('Usage: ts-node mint.ts <recipient-address> [payment-amount-microstacks]');
    console.error('Environment variables: PRIVATE_KEY, CONTRACT_ADDRESS, STACKS_NETWORK');
    process.exit(1);
  }

  mintNFT(contractAddress, recipient, paymentAmount, stacksNetwork, privateKey)
    .then(txid => {
      console.log(`✅ Mint successful! TX: ${txid}`);
    })
    .catch(error => {
      console.error('❌ Mint failed:', error);
      process.exit(1);
    });
}

export { mintNFT };

