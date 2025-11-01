#!/usr/bin/env ts-node

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = process.argv[2] || "baseSepolia";
  console.log(`Deploying to ${network}...`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Token addresses (Base network)
  // USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (mainnet)
  // WBTC on Base: 0x1ce4a2C355F0DcC24E32A9Af19F1836D6F6f98f (mainnet)
  // For testnet, use mock tokens or deploy test tokens
  
  const usdcAddress = network === "base" 
    ? process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : process.env.USDC_ADDRESS_TESTNET || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia test token
    
  const wbtcAddress = network === "base"
    ? process.env.WBTC_ADDRESS || "0x1ce4a2C355F0DcC24E32A9Af19F1836D6F6f98f"
    : process.env.WBTC_ADDRESS_TESTNET || "0x29f2D40B060520436445af02b00b2A10e047eE81"; // Base Sepolia test token

  const developmentPool = process.env.DEV_POOL || deployer.address;
  const liquidityPool = process.env.LIQUIDITY_POOL || deployer.address;

  console.log("\nDeployment Configuration:");
  console.log("USDC Token:", usdcAddress);
  console.log("WBTC Token:", wbtcAddress);
  console.log("Development Pool:", developmentPool);
  console.log("Liquidity Pool:", liquidityPool);

  // Deploy contract
  const XMBLTokenBase = await ethers.getContractFactory("XMBLTokenBase");
  const xmblToken = await XMBLTokenBase.deploy(
    usdcAddress,
    wbtcAddress,
    developmentPool,
    liquidityPool
  );

  await xmblToken.waitForDeployment();
  const contractAddress = await xmblToken.getAddress();

  console.log("\n✅ XMBLTokenBase deployed to:", contractAddress);
  console.log("Network:", network);
  console.log("\nTo verify on BaseScan:");
  console.log(`npx hardhat verify --network ${network} ${contractAddress} ${usdcAddress} ${wbtcAddress} ${developmentPool} ${liquidityPool}`);

  // Save deployment info
  const deploymentInfo = {
    network,
    contractAddress,
    deployer: deployer.address,
    usdcToken: usdcAddress,
    wbtcToken: wbtcAddress,
    developmentPool,
    liquidityPool,
    deploymentTime: new Date().toISOString(),
    transactionHash: xmblToken.deploymentTransaction()?.hash
  };

  console.log("\nDeployment Info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

