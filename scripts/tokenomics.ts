#!/usr/bin/env node

import { ethers } from "hardhat";
import { TokenomicsService } from "../services/TokenomicsService";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔮 XMBL Tokenomics CLI");
  console.log("=====================");
  console.log(`Using account: ${deployer.address}`);
  
  // Get contract address from config
  const contractAddress = process.env.PRICE_ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000";
  
  if (contractAddress === "0x0000000000000000000000000000000000000000") {
    console.log("❌ Please set PRICE_ORACLE_ADDRESS environment variable");
    process.exit(1);
  }
  
  const tokenomicsService = new TokenomicsService(contractAddress, deployer.provider);
  
  const command = process.argv[2];
  
  switch (command) {
    case "status":
      await showStatus(tokenomicsService);
      break;
    case "activate":
      await activateToken(tokenomicsService, deployer);
      break;
    case "deactivate":
      await deactivateToken(tokenomicsService, deployer);
      break;
    case "simulate":
      const count = parseInt(process.argv[3]) || 10;
      await simulateActivations(tokenomicsService, deployer, count);
      break;
    case "watch":
      await watchEvents(tokenomicsService);
      break;
    case "help":
    default:
      showHelp();
      break;
  }
}

async function showStatus(tokenomicsService: TokenomicsService) {
  console.log("\n📊 Tokenomics Status");
  console.log("===================");
  
  try {
    const summary = await tokenomicsService.getTokenomicsSummary();
    const state = await tokenomicsService.getTokenomicsState();
    const distribution = await tokenomicsService.getCoinDistributionStatus();
    
    console.log(`💰 Total BTC Deposited: ${summary.totalBTCDeposited} sats`);
    console.log(`🪙 Tokens Minted: ${summary.totalTokensMinted}`);
    console.log(`💵 Current Price: ${summary.currentPrice} sats`);
    console.log(`🪙 Coins Released: ${summary.coinsReleased}`);
    console.log(`🪙 Coins Remaining: ${summary.coinsRemaining}`);
    console.log(`🎯 Next Release Target: ${summary.nextReleaseTarget} sats`);
    console.log(`🔄 Can Release Coins: ${summary.canReleaseCoins ? "Yes" : "No"}`);
    
    console.log("\n📈 Detailed State:");
    console.log(`   Previous Price: ${state.xymPrevPrice} sats`);
    console.log(`   Next Price: ${state.xymNextPrice} sats`);
    console.log(`   Coin Divisor: ${state.xyDivisor}`);
    console.log(`   Next Release Amount: ${state.xyNextAmount}`);
    
  } catch (error) {
    console.error("❌ Error fetching status:", error);
  }
}

async function activateToken(tokenomicsService: TokenomicsService, signer: any) {
  console.log("\n🚀 Activating Token...");
  
  try {
    const priceBefore = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Price before activation: ${priceBefore} sats`);
    
    const tx = await tokenomicsService.activateToken();
    console.log(`⏳ Transaction hash: ${tx.hash}`);
    await tx.wait();
    
    const priceAfter = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Price after activation: ${priceAfter} sats`);
    console.log(`📈 Price increase: ${priceAfter - priceBefore} sats`);
    
    console.log("✅ Token activated successfully!");
    
  } catch (error) {
    console.error("❌ Error activating token:", error);
  }
}

async function deactivateToken(tokenomicsService: TokenomicsService, signer: any) {
  console.log("\n🔥 Deactivating Token...");
  
  try {
    const priceBefore = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Price before deactivation: ${priceBefore} sats`);
    
    const tx = await tokenomicsService.deactivateToken();
    console.log(`⏳ Transaction hash: ${tx.hash}`);
    await tx.wait();
    
    const priceAfter = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Price after deactivation: ${priceAfter} sats`);
    console.log(`📉 Price decrease: ${priceBefore - priceAfter} sats`);
    
    console.log("✅ Token deactivated successfully!");
    
  } catch (error) {
    console.error("❌ Error deactivating token:", error);
  }
}

async function simulateActivations(tokenomicsService: TokenomicsService, signer: any, count: number) {
  console.log(`\n🎮 Simulating ${count} token activations...`);
  
  try {
    const initialPrice = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Initial price: ${initialPrice} sats`);
    
    for (let i = 1; i <= count; i++) {
      await tokenomicsService.activateToken();
      const currentPrice = await tokenomicsService.getCurrentPrice();
      console.log(`   Token ${i}: ${currentPrice} sats`);
      
      // Check for coin releases
      const distribution = await tokenomicsService.getCoinDistributionStatus();
      if (distribution.canReleaseCoins) {
        console.log(`   🪙 Coins released! Amount: ${distribution.nextReleaseAmount}`);
      }
    }
    
    const finalPrice = await tokenomicsService.getCurrentPrice();
    console.log(`💰 Final price: ${finalPrice} sats`);
    console.log(`📈 Total price increase: ${finalPrice - initialPrice} sats`);
    
    console.log("✅ Simulation completed!");
    
  } catch (error) {
    console.error("❌ Error during simulation:", error);
  }
}

async function watchEvents(tokenomicsService: TokenomicsService) {
  console.log("\n👀 Watching tokenomics events...");
  console.log("Press Ctrl+C to stop");
  
  tokenomicsService.onTokenomicsUpdated((proofOfFaith, xymMinted, xymNextPrice) => {
    console.log(`📊 Tokenomics Updated: PoF=${proofOfFaith}, Minted=${xymMinted}, Price=${xymNextPrice}`);
  });
  
  tokenomicsService.onCoinsReleased((amount, totalReleased, remaining) => {
    console.log(`🪙 Coins Released: ${amount} (Total: ${totalReleased}, Remaining: ${remaining})`);
  });
  
  tokenomicsService.onActivationProcessed((activationId, price, settled) => {
    console.log(`🚀 Activation ${activationId}: Price=${price}, Settled=${settled}`);
  });
  
  // Keep the process alive
  process.on('SIGINT', () => {
    console.log("\n👋 Stopping event watcher...");
    tokenomicsService.removeAllListeners();
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {}, 1000);
}

function showHelp() {
  console.log("\n📖 XMBL Tokenomics CLI Help");
  console.log("============================");
  console.log("Usage: npx hardhat run scripts/tokenomics.ts --network <network> <command> [args]");
  console.log("");
  console.log("Commands:");
  console.log("  status                    - Show current tokenomics status");
  console.log("  activate                  - Activate a token (mint)");
  console.log("  deactivate                - Deactivate a token (burn)");
  console.log("  simulate <count>          - Simulate multiple activations");
  console.log("  watch                     - Watch real-time events");
  console.log("  help                      - Show this help");
  console.log("");
  console.log("Environment Variables:");
  console.log("  PRICE_ORACLE_ADDRESS      - Contract address (required)");
  console.log("");
  console.log("Examples:");
  console.log("  npx hardhat run scripts/tokenomics.ts --network sepolia status");
  console.log("  npx hardhat run scripts/tokenomics.ts --network sepolia activate");
  console.log("  npx hardhat run scripts/tokenomics.ts --network sepolia simulate 100");
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
