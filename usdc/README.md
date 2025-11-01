# XMBL Token on Base Network

Base network implementation of XMBL tokenomics using Solidity smart contracts with USDC/WBTC pricing.

## Features

- **Algorithmic Pricing**: `cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))` (based on WBTC)
- **NFT Minting**: ERC-721 compliant NFTs for each token activation
- **Pool Management**: Logarithmic split between development (10-90%) and liquidity (10-95%) pools
- **Token Resale**: Secondary market with FIFO queue (preferred order for existing tokens)
- **Dual Payment**: Supports USDC and WBTC payments
- **WBTC Pricing**: All prices calculated in WBTC satoshis, converted to payment token

## Project Structure

```
usdc/
├── contracts/
│   └── XMBLTokenBase.sol      # Main token contract
├── scripts/
│   ├── deploy.ts               # Deployment script
│   ├── buy.ts                  # Buy token (checks listings first)
│   ├── mint.ts                 # Mint new token directly
│   └── list.ts                 # List/unlist tokens
├── config/
│   └── base.json               # Base network configuration
└── test/                       # Contract tests
```

## Prerequisites

- Node.js 18+
- Hardhat
- Base network RPC access
- USDC and WBTC tokens for testing

## Setup

```bash
cd usdc
npm install
```

Create `.env` file:
```env
PRIVATE_KEY=your_private_key
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=your_deployed_contract_address
DEV_POOL=your_dev_pool_address
LIQUIDITY_POOL=your_liquidity_pool_address
```

## Deployment

### Deploy to Base Sepolia (Testnet)

```bash
npm run deploy:base-sepolia
```

### Deploy to Base Mainnet

```bash
npm run deploy:base
```

**Deployment Costs:**
- Contract deployment: ~1,000,000 gas
- At 0.001 ETH per gas (Base fees): ~0.001 ETH (~$2-4)
- Contract verification: Free

## Usage

### Buy Token (Preferred: Uses Listings First)

The `buy` function automatically:
1. Checks for listed tokens (FIFO order)
2. Buys first listed token if available
3. Otherwise mints new token

```bash
# Buy with USDC (default)
npm run buy buy 100

# Buy with WBTC
npm run buy buy 0.001 false
```

### Mint New Token (Bypass Listings)

```bash
# Mint with USDC
npm run mint 0xYourAddress 100

# Mint with WBTC
npm run mint 0xYourAddress 0.001 false
```

### List Token for Resale

```bash
# List token ID 1 for 150 USDC
npm run list list 1 150

# List token ID 2 for 0.002 WBTC
npm run list list 2 0.002 false

# Unlist token
npm run list unlist 1
```

## Contract Functions

### Public Functions

- `buy(paymentAmount, useUSDC)`: Unified buy function - checks listed tokens first, then mints new
  - Payment in USDC (6 decimals) or WBTC (8 decimals)
  - Returns token ID
  
- `buyListedToken(tokenId, paymentAmount, useUSDC)`: Buy a specific listed token
  - Payment sent to seller
  - NFT transferred to buyer
  
- `mintNew(recipient, paymentAmount, useUSDC)`: Mint new NFT (bypasses listings)
  - Automatically distributes payment to pools based on split calculation
  
- `listForSale(tokenId, askingPrice)`: List your token for resale
  - Token enters FIFO queue (first listed, first bought)
  - Asking price in payment token (USDC or WBTC)
  
- `unlist(tokenId)`: Remove token from sale

### Owner Functions

- `setDevelopmentPool(address)`: Update development pool address
- `setLiquidityPool(address)`: Update liquidity pool address
- `pause()`: Pause contract
- `unpause()`: Unpause contract

## Pricing

All prices are calculated in **WBTC satoshis** and converted to the payment token:

- **Starting Price**: 1 WBTC satoshi
- **Price Formula**: `cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))`
- **Conversion**: 
  - WBTC: 1 satoshi = 1e10 wei
  - USDC: Simplified conversion (1 WBTC satoshi ≈ 500 micro-USDC)

**Note**: In production, USDC conversion should use Chainlink WBTC/USDC price oracle.

## Pool Distribution

Pool distribution happens automatically during mint:
- Development pool receives calculated percentage
- Liquidity pool receives remaining amount
- Split is based on total BTC (proof of faith) using logarithmic curve:
  - 10% liquidity at 0 BTC
  - 95% liquidity at 100 BTC
  - Logarithmic curve between

## Interaction Costs

- **Mint NFT**: ~150,000 gas (~$0.15-0.30)
- **Buy listed token**: ~120,000 gas (~$0.12-0.24)
- **List token**: ~80,000 gas (~$0.08-0.16)
- **Unlist token**: ~50,000 gas (~$0.05-0.10)

All costs are in ETH on Base network (gas fees).

## Token Addresses

### Base Mainnet
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WBTC: `0x1ce4a2C355F0DcC24E32A9Af19F1836D6F6f98f`

### Base Sepolia Testnet
- USDC Test Token: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- WBTC Test Token: `0x29f2D40B060520436445af02b00b2A10e047eE81`

## Testing

```bash
npm test
```

## License

MIT

