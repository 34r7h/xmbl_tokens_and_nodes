#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const tokenId = process.argv[2];
  
  if (!tokenId) {
    console.error("Usage: ts-node bridge-to-stacks.ts <tokenId>");
    process.exit(1);
  }
  
  const network = process.env.NETWORK || "baseSepolia";
  const contractAddress = process.env.BRIDGE_CONTRACT_ADDRESS || "";
  
  if (!contractAddress) {
    console.error("Please set BRIDGE_CONTRACT_ADDRESS in .env");
    process.exit(1);
  }
  
  const provider = new ethers.JsonRpcProvider(
    network === "base"
      ? process.env.BASE_RPC_URL || "https://mainnet.base.org"
      : process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
  );
  
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  const bridgeABI = [
    "function bridgeToStacks(uint256 tokenId) external",
    "event BridgeInitiated(uint256 indexed tokenId, address indexed owner, uint16 targetChain, bytes32 indexed messageId)"
  ];
  
  const bridge = new ethers.Contract(contractAddress, bridgeABI, signer);
  
  console.log(`Bridging token ${tokenId} to Stacks...`);
  
  const tx = await bridge.bridgeToStacks(tokenId);
  console.log(`Transaction: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Bridge initiated! Waiting for Wormhole confirmation...`);
  console.log(`Block: ${receipt.blockNumber}`);
  
  // Monitor for completion
  console.log("\nMonitoring for bridge completion...");
  console.log("In production, this would monitor Wormhole messages and Stacks chain");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

