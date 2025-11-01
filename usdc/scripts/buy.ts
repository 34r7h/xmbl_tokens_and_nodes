#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (command === "buy") {
    const paymentAmount = args[0] || "1000000"; // Amount in payment token (USDC or WBTC)
    const useUSDC = args[1] !== "false"; // Default to USDC
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

    console.log(`Buying token with ${paymentAmount} ${useUSDC ? "USDC" : "WBTC"}`);

    // First, approve token transfer
    const token = useUSDC 
      ? await ethers.getContractAt("IERC20", await contract.usdcToken(), signer)
      : await ethers.getContractAt("IERC20", await contract.wbtcToken(), signer);

    const amount = ethers.parseUnits(paymentAmount, useUSDC ? 6 : 8);
    const approveTx = await token.approve(contractAddress, amount);
    console.log("Approving token transfer...", approveTx.hash);
    await approveTx.wait();

    // Call buy function
    const buyTx = await contract.buy(amount, useUSDC);
    console.log("Buy transaction:", buyTx.hash);
    const receipt = await buyTx.wait();
    console.log("✅ Buy successful! Token ID:", receipt.logs[0]?.args?.id || "Check transaction");
  } else {
    console.log("Usage: npm run buy buy <amount> [useUSDC=true]");
    console.log("Example: npm run buy buy 100 true");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

