# XMBL Cross-Chain Bridge

Bridge system connecting Stacks (BTC) and Base (USDC) networks for seamless NFT token transfers and synchronized state.

## Architecture

### Components

1. **Bridge Contracts** - Handle NFT locking and minting on both chains
   - `XMBLTokenBridge.sol` (Base)
   - `xmbl-bridge.clar` (Stacks)

2. **Oracle Contracts** - Aggregate state and sync prices/proof-of-faith
   - `XMBLOracleBase.sol` (Base - Master chain)
   - `xmbl-oracle.clar` (Stacks)

3. **Token Registry** - Maps token IDs between chains
   - `XMBLTokenRegistry.sol` (Base)

4. **Bridge Service** - Off-chain Wormhole message handler
   - `WormholeBridgeService.ts`

## How It Works

### Bridging Flow

**Base → Stacks:**
1. User calls `bridgeToStacks(tokenId)` on Base
2. Token is locked (cannot transfer/list)
3. Bridge emits event with token data
4. Bridge service creates Wormhole message
5. Message attested by Wormhole validators
6. Stacks bridge receives message and mints NFT
7. Token ID mapping stored in registry

**Stacks → Base:**
1. User calls `bridge-to-base(token-id)` on Stacks
2. Token is locked
3. Bridge service creates Wormhole message
4. Base bridge receives and mints NFT
5. Registry maps token IDs

### Price Synchronization

Oracle aggregates tokens from both chains:
- Reads `tokensMinted` from Stacks contract
- Reads `tokensMinted` from Base contract
- Calculates unified price: `calculatePrice(previousPrice, totalTokensAcrossBothChains)`
- Syncs price to both contracts via Wormhole messages

### Proof-of-Faith Aggregation

Master chain (Base) stores unified total:
- Aggregates `proofOfFaith` from both chains
- Normalizes units (both use satoshi scale: 1e8)
- Syncs aggregated total back to both contracts
- Pool split calculations use aggregated total

## Usage

### Bridge Token from Base to Stacks

```bash
npm run bridge:to-stacks <tokenId>
```

### Bridge Token from Stacks to Base

```bash
npm run bridge:to-base <tokenId>
```

### Monitor Bridge Service

The bridge service monitors events and handles Wormhole messages automatically when running.

## Token ID Mapping

Each bridged token gets a new ID on the destination chain:
- Original token ID is preserved in registry
- Bidirectional mapping: `stacksId <-> baseId`
- Origin chain tracked for reference

## Security

- Tokens locked during bridge (cannot transfer or list)
- Wormhole message verification prevents replay attacks
- Registry prevents duplicate mappings
- Oracle-only price/proof-of-faith sync

## Files Created

- `/usdc/contracts/XMBLTokenBridge.sol`
- `/usdc/contracts/XMBLTokenRegistry.sol`
- `/usdc/contracts/XMBLOracleBase.sol`
- `/btc/contracts/xmbl-bridge.clar`
- `/btc/contracts/xmbl-oracle.clar`
- `/bridge/services/WormholeBridgeService.ts`
- `/bridge/scripts/bridge-to-stacks.ts`
- `/bridge/scripts/bridge-to-base.ts`
- `/bridge/config/wormhole.json`

## Modified Files

- `/usdc/contracts/XMBLTokenBase.sol` - Added bridge/oracle integration
- `/btc/contracts/xmbl-token.clar` - Added bridge/oracle integration

