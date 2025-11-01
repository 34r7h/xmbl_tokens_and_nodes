# XMBL Token Base Deployment and Interaction Costs

This document outlines the estimated costs for deploying and interacting with the XMBL token contract on Base network.

## Base Network Information

- **Chain ID**: 8453 (mainnet), 84532 (Sepolia testnet)
- **Native Token**: ETH
- **Gas Price**: ~0.001 gwei (typically very low)
- **Block Time**: ~2 seconds

## Initial Deployment

The initial deployment involves deploying the `XMBLTokenBase.sol` contract.

- **Contract Size**: ~50KB (optimized)
- **Estimated Gas Units**: ~3,000,000 - 5,000,000 gas
- **Gas Price**: ~0.001 ETH per gas unit (Base network)
- **Estimated ETH Cost**: ~0.003 - 0.005 ETH
- **Estimated USD**: ~$6 - $15 (at ETH ~$2000-3000)

**Note**: Base network has very low gas fees compared to Ethereum mainnet.

## Interaction Costs

These are estimated costs for common interactions with the deployed contract.

### Mint NFT

- **Gas Units**: ~150,000 - 200,000 gas
- **ETH Cost**: ~0.00015 - 0.0002 ETH
- **USD Cost**: ~$0.30 - $0.60

Includes:
- ERC20 token transfer (payment)
- ERC721 mint
- Price calculation
- Pool split calculation
- Pool distribution (2 token transfers)

### Buy Listed Token

- **Gas Units**: ~120,000 - 150,000 gas
- **ETH Cost**: ~0.00012 - 0.00015 ETH
- **USD Cost**: ~$0.24 - $0.45

Includes:
- ERC20 token transfer (payment)
- NFT transfer
- Listing removal
- Payment to seller

### List Token for Sale

- **Gas Units**: ~80,000 - 100,000 gas
- **ETH Cost**: ~0.00008 - 0.0001 ETH
- **USD Cost**: ~$0.16 - $0.30

### Unlist Token

- **Gas Units**: ~50,000 - 70,000 gas
- **ETH Cost**: ~0.00005 - 0.00007 ETH
- **USD Cost**: ~$0.10 - $0.21

### Owner Functions

- **Set Development Pool**: ~40,000 gas (~$0.08-0.12)
- **Set Liquidity Pool**: ~40,000 gas (~$0.08-0.12)
- **Pause/Unpause**: ~30,000 gas (~$0.06-0.09)

## Token Transfer Costs

- **USDC Transfer**: ~65,000 gas (~$0.13-0.20)
- **WBTC Transfer**: ~65,000 gas (~$0.13-0.20)

## Cost Comparison

Compared to other networks:
- **Base vs Ethereum Mainnet**: ~100x cheaper
- **Base vs Arbitrum**: ~10x cheaper
- **Base vs Optimism**: ~5x cheaper

## Payment Token Costs

Users pay in **USDC** or **WBTC**, not ETH:
- **USDC**: 6 decimals (e.g., 1 USDC = 1,000,000 units)
- **WBTC**: 8 decimals (e.g., 1 WBTC = 100,000,000 units)

Gas fees are still paid in ETH, but the actual payment for tokens is in USDC or WBTC.

## Optimization Tips

1. **Batch Operations**: If minting multiple tokens, consider batch functions
2. **Gas Optimization**: Contract uses Solidity 0.8.19 with optimizer enabled (200 runs)
3. **Storage Optimization**: Uses efficient mapping structures
4. **Event Optimization**: Events use indexed parameters where possible

## Summary

Base network offers significantly lower costs compared to Ethereum mainnet:
- **Deployment**: ~$6-15 (one-time)
- **Mint NFT**: ~$0.30-0.60 per token
- **Buy Listed**: ~$0.24-0.45 per transaction
- **List Token**: ~$0.16-0.30 per listing

All costs in USD are approximate and vary based on:
- ETH price
- Network congestion
- Gas price at time of transaction

