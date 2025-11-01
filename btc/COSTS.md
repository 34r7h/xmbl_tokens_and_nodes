# XMBL Token on Stacks - Cost Breakdown

## Deployment Costs

### Initial Contract Deployment

- **Main Token Contract (`xmbl-token.clar`)**: 
  - Gas: ~50,000 units
  - Cost: ~0.5 STX
  - USD: ~$0.75-1.50 (at $1.50-3.00 per STX)

- **Proxy Contract (`xmbl-proxy.clar`)**:
  - Gas: ~30,000 units
  - Cost: ~0.3 STX
  - USD: ~$0.45-0.90

- **Total Deployment**:
  - Gas: ~80,000 units
  - Cost: ~0.8 STX
  - USD: ~$1.20-2.40

### Initialization Costs

- **Initialize Token Contract**: ~1,000 gas (~0.01 STX)
- **Initialize Proxy Contract**: ~1,000 gas (~0.01 STX)
- **Set Pool Addresses** (2 calls): ~2,000 gas (~0.02 STX)

**Total Setup**: ~4,000 gas (~0.04 STX)

## Interaction Costs

### Minting NFT

**Two-step process**:
1. **Send Payment to Contract**: 
   - Gas: ~1,000 units
   - Cost: ~0.01 STX
   - Network fee included

2. **Call Mint Function**:
   - Gas: ~15,000 units
   - Cost: ~0.15 STX
   - Includes: price calculation, state updates, NFT minting, pool split calculation, STX transfers

**Total per Mint**: ~16,000 gas (~0.16 STX)
**USD**: ~$0.24-0.48 per NFT

### Other Operations

- **Transfer NFT**: ~5,000 gas (~0.05 STX)
- **Set Pool Address**: ~1,000 gas (~0.01 STX)
- **Set Owner**: ~1,000 gas (~0.01 STX)
- **Pause/Unpause**: ~1,000 gas (~0.01 STX)
- **Contract Upgrade** (via proxy): ~20,000 gas (~0.20 STX)

### Read-Only Calls

- All read-only functions are **FREE** (no gas cost)
  - `get-current-price`
  - `get-tokens-minted`
  - `get-proof-of-faith`
  - `get-owner`
  - `calculate-price`
  - `calculate-liquidity-percentage`
  - `calculate-pool-split`

## Lightning Network Costs

### Invoice Generation
- **Cost**: FREE (no fees)

### Payment Processing
- **BTCPay Server**: 0% (self-hosted) or variable
- **Strike API**: ~0.1-1% processing fee
- **Custom Lightning Node**: Network routing fees only

### Lightning Network Fees
- **Routing Fees**: Variable, typically 1-10 satoshis
- **Channel Management**: FREE (one-time setup)

**Typical Lightning Payment**: 0.1-1% + network fees (~$0.001-0.01 per transaction)

## Total Cost Examples

### Scenario 1: Deploy and Mint 10 NFTs

- Deployment: ~0.8 STX (~$1.20-2.40)
- 10 Mints: ~1.6 STX (~$2.40-4.80)
- **Total**: ~2.4 STX (~$3.60-7.20)

### Scenario 2: Deploy and Mint 100 NFTs

- Deployment: ~0.8 STX
- 100 Mints: ~16 STX (~$24-48)
- **Total**: ~16.8 STX (~$25.20-50.40)

### Scenario 3: With Lightning Network Deposits

- Deployment: ~0.8 STX
- 10 Lightning Payments: 10 * (payment + 0.1-1% fee) ≈ 10.1-10.2 BTC equivalent
- 10 Mints: ~1.6 STX
- **Total**: ~2.4 STX + Lightning fees (~$3.60-7.20 + Lightning fees)

## Gas Price Reference

- **Current Stacks Gas Price**: ~0.00001 STX per gas unit
- **Gas prices vary** based on network congestion
- Testnet: Lower fees (often subsidized)
- Mainnet: Market rates apply

## Cost Optimization Tips

1. **Batch Operations**: Deploy both contracts in one session to save on setup
2. **Read-Only First**: Use read-only calls to check prices before minting
3. **Lightning Network**: Use for deposits to avoid Bitcoin mainnet fees
4. **Testnet Testing**: Always test on testnet first (lower/zero costs)

## Monitoring Costs

Track deployment and interaction costs:
- Stacks Explorer: View transaction fees
- Contract calls: Gas used per operation
- Lightning payments: Processor dashboard

## Cost Comparison

### Stacks vs Ethereum

| Operation | Stacks | Ethereum |
|-----------|--------|----------|
| Contract Deploy | ~0.8 STX (~$1.20) | ~0.1-0.5 ETH (~$200-1000) |
| Mint NFT | ~0.16 STX (~$0.24) | ~0.01-0.05 ETH (~$20-100) |
| Transfer NFT | ~0.05 STX (~$0.08) | ~0.002-0.01 ETH (~$4-20) |

**Stacks is significantly cheaper** for contract operations compared to Ethereum.

## Notes

- All costs in USD are estimates based on STX price of $1.50-3.00
- Actual costs depend on current STX/USD exchange rate
- Gas prices can fluctuate with network usage
- Lightning Network fees vary by provider and network conditions

