# XMBL Token on Stacks (Bitcoin L2)

Bitcoin L2 implementation of XMBL tokenomics on Stacks blockchain using Clarity smart contracts.

## Features

- **Algorithmic Pricing**: `cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))`
- **NFT Minting**: SIP-009 compliant NFTs for each token activation
- **Pool Management**: Logarithmic split between development (10-90%) and liquidity (10-95%) pools
- **Lightning Network Integration**: Direct BTC deposits via Lightning Network
- **Upgradeable Contracts**: Proxy pattern for contract upgrades by owner

## Project Structure

```
btc/
├── contracts/
│   ├── xmbl-token.clar      # Main token contract
│   └── xmbl-proxy.clar      # Upgradeable proxy
├── scripts/
│   ├── deploy.ts            # Deployment script
│   └── lightning-deposit.ts # Lightning Network integration
├── config/
│   ├── stacks.json          # Stacks network configuration
│   └── lightning.json       # Lightning Network configuration
└── tests/                   # Contract tests
```

## Prerequisites

- Node.js 18+
- Clarinet CLI (for local development)
- Stacks wallet with STX for deployment
- Lightning Network payment processor (BTCPay Server, Strike, or custom)

## Installation

```bash
cd btc
npm install
```

## Configuration

### 1. Stacks Configuration

Edit `config/stacks.json`:

```json
{
  "testnet": {
    "rpcUrl": "https://api.testnet.hiro.so",
    "contractAddress": "YOUR_CONTRACT_ADDRESS",
    "privateKey": "YOUR_PRIVATE_KEY"
  }
}
```

### 2. Lightning Network Configuration

Edit `config/lightning.json`:

```json
{
  "apiUrl": "https://your-btcpay-server.com",
  "apiKey": "YOUR_API_KEY",
  "webhookSecret": "YOUR_WEBHOOK_SECRET"
}
```

## Deployment

### Deploy to Testnet

```bash
# Set environment variables
export STACKS_NETWORK=testnet
export PRIVATE_KEY=your_private_key_here
export DEV_POOL=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
export LIQUIDITY_POOL=ST2CY5V39NHDPWSXMW3Q3XSQN5AYWS6YB80WJ4YKW

# Deploy
npm run deploy
```

### Deploy to Mainnet

```bash
export STACKS_NETWORK=mainnet
export PRIVATE_KEY=your_private_key_here
npm run deploy
```

## Deployment Costs

### Initial Deployment

- **Token Contract**: ~50,000 gas units (~0.5 STX)
- **Proxy Contract**: ~30,000 gas units (~0.3 STX)
- **Total**: ~80,000 gas units (~0.8 STX)
- **Estimated USD**: ~$1.20-2.40 (at $1.50-3.00 per STX)

### Interaction Costs

- **Mint NFT**: ~15,000 gas units (~0.15 STX) per mint
- **Pool Split**: Included in mint (~5,000 gas units)
- **Contract Upgrade**: ~20,000 gas units (~0.20 STX)
- **Set Pool Addresses**: ~1,000 gas units (~0.01 STX) each

### Lightning Network Fees

- **Invoice Generation**: Free
- **Payment Processing**: 0.1-1% (processor dependent)
- **Network Fees**: Variable (Lightning Network routing)

## Usage

### Buy Token (Preferred: Uses Listings First)

The `buy` function automatically:
1. Checks for listed tokens (FIFO order)
2. Buys first listed token if available
3. Otherwise mints new token

```bash
# Buy token (checks listings first)
npm run buy buy 1000000

# Or buy specific listed token
npm run buy buy 1000000 5
```

### List Token for Resale

Token owners can list their tokens for sale:

```bash
# List token ID 1 for 1.5 STX
npm run buy list 1 1500000

# Unlist token
npm run buy unlist 1
```

### Mint New Token (Bypass Listings)

To mint new without checking listings:

```bash
# Mint directly (for recipient)
npm run mint ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM 1000000
```

### Pool Distribution

Pool distribution happens automatically during mint:
- Development pool receives calculated percentage
- Liquidity pool receives remaining amount
- Split is based on total BTC (proof of faith) using logarithmic curve

Monitor distributions:
```bash
npm run pool-distribute monitor
```

### Lightning Network Deposit Flow

1. User requests invoice via API
2. System generates BOLT11 invoice
3. User pays via Lightning wallet
4. Payment processor sends webhook
5. Server calls contract `mint` function
6. NFT minted and funds split to pools

### Start Lightning Webhook Server

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export WEBHOOK_PORT=3000

# Start server
ts-node scripts/lightning-deposit.ts
```

## Contract Functions

### Public Functions

- `buy(payment-amount)`: Unified buy function - checks listed tokens first, then mints new
  - Returns: `{ id, price, ... }` (varies based on buy vs mint)
  - Payment must be sent to contract via separate transaction first
  - **Preferred order**: Listed tokens are bought before minting new ones
  
- `buy-listed-token(token-id, payment-amount)`: Buy a specific listed token
  - Returns: `{ id, price, seller }`
  - Payment sent to seller, NFT transferred to buyer
  
- `mint-new(recipient, payment-amount)`: Mint new NFT (bypasses listings)
  - Returns: `{ id, price, dev-amount, liquidity-amount }`
  - Automatically distributes payment to pools based on split calculation
  - Payment must be sent to contract via separate transaction first
  
- `list-for-sale(token-id, asking-price)`: List your token for resale
  - Token owner can list at any price
  - Token enters FIFO queue (first listed, first bought)
  - Returns: `ok true` on success
  
- `unlist(token-id)`: Remove token from sale
  - Only token owner can unlist
  - Removes from FIFO queue
  
- `transfer(id, sender, recipient)`: Transfer NFT (SIP-009)
  - If token is listed, automatically removes from listings
  
- `initialize(contract-owner)`: Initialize contract (owner only, one-time)

### Owner Functions

- `set-development-pool(new-pool)`: Update development pool address
- `set-liquidity-pool(new-pool)`: Update liquidity pool address
- `set-owner(new-owner)`: Transfer ownership
- `set-paused(pause)`: Pause/unpause contract

### Read-Only Functions

- `get-current-price`: Get current token price
- `get-tokens-minted`: Get total tokens minted
- `get-proof-of-faith`: Get total BTC deposited
- `get-owner(id)`: Get NFT owner
- `calculate-price(previous-price, token-number)`: Calculate price for token number
- `calculate-liquidity-percentage(total-btc)`: Calculate liquidity pool percentage
- `calculate-pool-split(total-btc)`: Calculate dev/liquidity split

## Pricing Algorithm

Formula: `cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))`

Where:
- `cost` = previous price
- `x` = token number (tokens minted + 1)
- Parentheses are important for order of operations

Starting price: 1 satoshi
All prices round UP to nearest satoshi

## Pool Split Algorithm

Logarithmic curve: 10% liquidity starting → 95% at 100 BTC

Formula: `min + (max - min) * progress`

Where progress increases logarithmically as total BTC deposited increases.

## Testing

```bash
# Run Clarinet tests
clarinet test

# Or with npm
npm test
```

## Security Notes

- Contract owner has upgrade permissions via proxy
- Contract can be paused by owner
- Pool addresses can be updated by owner
- Lightning Network webhooks must be verified via signature

## Network Information

- **Stacks Testnet**: https://explorer.stacks.co/?chain=testnet
- **Stacks Mainnet**: https://explorer.stacks.co
- **Clarity Language Docs**: https://docs.stacks.co/docs/clarity

## Support

For issues or questions, refer to:
- Stacks Documentation: https://docs.stacks.co
- Clarity Language Reference: https://docs.stacks.co/docs/clarity
- Lightning Network: https://lightning.network

