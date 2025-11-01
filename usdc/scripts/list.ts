#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  const network = process.env.NETWORK || "baseSepolia";

  if (!contractAddress) {
    console.error("Please set CONTRACT_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(
    network === "base"
      ? process.env.BASE_RPC_URL || "https://mainnet.base.org"
      : process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
  );

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  const contract = await ethers.getContractAt("XMBLTokenBase", contractAddress, signer);

  if (command === "list") {
    const tokenId = args[0];
    const askingPrice = args[1] || "1000000";
    const useUSDC = args[2] !== "false";

    if (!tokenId) {
      console.error("Usage: npm run list list <tokenId> <askingPrice> [useUSDC=true]");
      process.exit(1);
    }

    const amount = ethers.parseUnits(askingPrice, useUSDC ? 6 : 8);
    const tx = await contract.listForSale(tokenId, amount);
    console.log("List transaction:", tx.hash);
    await tx.wait();
    console.log(`✅ Token ${tokenId} listed for ${askingPrice} ${useUSDC ? "USDC" : "WBTC"}`);
  } else if (command === "unlist") {
    const tokenId = args[0];
    if (!tokenId) {
      console.error("Usage: npm run list unlist <tokenId>");
      process.exit(1);
    }

    const tx = await contract.unlist(tokenId);
    console.log("Unlist transaction:", tx.hash);
    await tx.wait();
    console.log(`✅ Token ${tokenId} unlisted`);
  } else {
    console.log("Usage:");
    console.log("  npm run list list <tokenId> <askingPrice> [useUSDC=true]");
    console.log("  npm run list unlist <tokenId>");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

