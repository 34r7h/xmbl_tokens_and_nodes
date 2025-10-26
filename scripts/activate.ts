#!/usr/bin/env ts-node

import hre from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

interface ActivationConfig {
  user: string;
  amount: string;
  token: string;
  chainId: number;
  depositContractAddress: string;
}

async function main() {
  const userAddress = "0xCB0c6BdA178a28e34C1132c53dDeBA24A4DDD5df";
  const amount = "1000000000000000000";
  const tokenAddress = "0x040E975E8de64a0eF09288624fd551f4c9336b74";
  const chainId = 11155111;
  
  console.log('🚀 XMBL Token Activation Script');
  console.log('================================');
  console.log(`User: ${userAddress}`);
  console.log(`Amount: ${amount}`);
  console.log(`Token: ${tokenAddress}`);
  console.log(`Chain ID: ${chainId}`);
  console.log('');

  try {
    // Load deployment config
    const deploymentFile = join(__dirname, '..', 'deployments', 'sepolia.json');
    const deploymentConfig = JSON.parse(readFileSync(deploymentFile, 'utf8'));
    
    const depositManagerAddress = deploymentConfig.contracts.DepositManager.address;
    const chainDepositAddress = deploymentConfig.contracts.ChainDepositContract_Ethereum.address;
    const priceOracleAddress = deploymentConfig.contracts.PriceOracle.address;
    const xmblTokenAddress = deploymentConfig.contracts.XMBLToken.address;

    console.log(`Using DepositManager: ${depositManagerAddress}`);
    console.log(`Using ChainDepositContract: ${chainDepositAddress}`);
    console.log(`Using PriceOracle: ${priceOracleAddress}`);
    console.log(`Using XMBLToken: ${xmblTokenAddress}`);

    // Connect to contracts
    const provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
    const signer = new hre.ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
    const DepositManagerFactory = await hre.ethers.getContractFactory('DepositManager');
    const ChainDepositContractFactory = await hre.ethers.getContractFactory('ChainDepositContract');
    const PriceOracleFactory = await hre.ethers.getContractFactory('PriceOracle');
    const XMBLTokenFactory = await hre.ethers.getContractFactory('XMBLToken');
    
    const depositManager = DepositManagerFactory.attach(depositManagerAddress).connect(signer);
    const chainDepositContract = ChainDepositContractFactory.attach(chainDepositAddress).connect(signer);
    const priceOracle = PriceOracleFactory.attach(priceOracleAddress).connect(signer);
    const xmblToken = XMBLTokenFactory.attach(xmblTokenAddress).connect(signer);

    console.log('\n=== STEP 1: Activate Token ===');
    
    // Activate token directly - skip state checks
    const activateTx = await priceOracle.activateToken();
    
    console.log(`Activation transaction sent: ${activateTx.hash}`);
    const activateReceipt = await activateTx.wait();
    console.log(`Activation confirmed in block: ${activateReceipt.blockNumber}`);
    
    console.log('\n=== STEP 2: Grant MINTER_ROLE ===');
    
    // Grant MINTER_ROLE to the signer
    const MINTER_ROLE = await xmblToken.MINTER_ROLE();
    const grantRoleTx = await xmblToken.grantRole(MINTER_ROLE, signer.address);
    console.log(`Grant role transaction sent: ${grantRoleTx.hash}`);
    const grantRoleReceipt = await grantRoleTx.wait();
    console.log(`Grant role confirmed in block: ${grantRoleReceipt.blockNumber}`);
    
    console.log('\n=== STEP 3: Mint XMBL NFT ===');
    
    // Get current price for deposit value
    const currentPrice = await priceOracle.currentPrice();
    console.log(`Current price: ${currentPrice.toString()} satoshis`);
    
    // Create token metadata structure
    const tokenMetadata = {
      PubKey: signer.address, // immutable public key
      Source: {
        from: priceOracleAddress, // pointer to source of creation
        how: "oracle_activation", // type of pointer
        to: "token_id" // will be set by contract
      },
      tokens: 1, // number of tokens mintable
      assets: {
        tokens: [{ id: "user", abilities: ["execute", "transfer", "activate"] }], // user token type
        coins: [{ id: "BTC", number: currentPrice.toString() }] // BTC amount held
      },
      contracts: {
        type: "user", // user account token
        control: "apps", // app control
        payments: true // can make payments
      },
      txs: [activateTx.hash] // append-only array of transactions
    };
    
    // Mint NFT with metadata
    const mintTx = await xmblToken.mintWithTBA(
      userAddress, // to address
      currentPrice, // deposit value
      priceOracleAddress // token address
    );
    
    console.log(`NFT minting transaction sent: ${mintTx.hash}`);
    const mintReceipt = await mintTx.wait();
    console.log(`NFT minting confirmed in block: ${mintReceipt.blockNumber}`);
    
    console.log('\n✅ Activation and NFT minting completed successfully!');
    console.log(`Oracle Transaction Hash: ${activateTx.hash}`);
    console.log(`Grant Role Transaction Hash: ${grantRoleTx.hash}`);
    console.log(`NFT Minting Transaction Hash: ${mintTx.hash}`);
    console.log(`Total Gas Used: ${(Number(activateReceipt.gasUsed) + Number(grantRoleReceipt.gasUsed) + Number(mintReceipt.gasUsed)).toString()}`);

  } catch (error) {
    console.error('❌ Activation failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});