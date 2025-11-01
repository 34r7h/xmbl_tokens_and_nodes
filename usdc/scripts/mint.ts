#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const recipient = process.argv[2] || process.env.DEPLOYER_ADDRESS || "";
  const paymentAmount = process.argv[3] || "1000000";
  const useUSDC = process.argv[4] !== "false";
  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  const network = process.env.NETWORK || "baseSepolia";

  if (!contractAddress || !recipient) {
    console.error("Usage: npm run mint <recipient> <amount> [useUSDC=true]");
    console.error("Or set CONTRACT_ADDRESS and DEPLOYER_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(
    network === "base"
      ? process.env.BASE_RPC_URL || "https://mainnet.base.org"
      : process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
  );

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  const contract = await ethers.getContractAt("XMBLTokenBase", contractAddress, signer);

  console.log(`Minting NFT to ${recipient} with ${paymentAmount} ${useUSDC ? "USDC" : "WBTC"}`);

  // Approve token transfer
  const token = useUSDC
    ? await ethers.getContractAt("IERC20", await contract.usdcToken(), signer)
    : await ethers.getContractAt("IERC20", await contract.wbtcToken(), signer);

  const amount = ethers.parseUnits(paymentAmount, useUSDC ? 6 : 8);
  const approveTx = await token.approve(contractAddress, amount);
  console.log("Approving token transfer...", approveTx.hash);
  await approveTx.wait();

  // Call mint function
  const mintTx = await contract.mintNew(recipient, amount, useUSDC);
  console.log("Mint transaction:", mintTx.hash);
  const receipt = await mintTx.wait();
  console.log("✅ Mint successful! Token ID:", receipt.logs[0]?.args?.id || "Check transaction");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

