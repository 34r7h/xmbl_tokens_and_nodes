# Cross-Chain Bridge Architecture Plan

## Architecture Overview

Bridge system connecting Stacks (`/btc`) and Base (`/usdc`) contracts with:

- Wormhole for cross-chain messaging
- On-chain oracle contracts aggregating state from both chains
- Master chain (Base) storing unified proof-of-faith
- Token ID mapping registry for cross-chain token tracking
- Synchronized pricing across both networks

## Core Components

### 1. Bridge Contracts

#### Base Network (`/usdc/contracts/XMBLTokenBridge.sol`)

- Wormhole integration for sending/receiving cross-chain messages
- Lock NFT before bridging (mark as bridged, prevent transfers)
- Emit bridge initiation event with Wormhole message
- Receive bridge completion messages from Stacks
- Mint corresponding NFT on Base with mapped token ID
- Track bridge status per token ID

#### Stacks Network (`/btc/contracts/xmbl-bridge.clar`)

- Clarity contract for Stacks side bridge operations
- Lock NFT before bridging (remove from listings, prevent transfers)
- Emit bridge event (Wormhole integration via off-chain service)
- Receive bridge completion messages
- Mint corresponding NFT with mapped token ID
- Track bridge status

### 2. Token ID Mapping Registry

#### Base Network (`/usdc/contracts/XMBLTokenRegistry.sol`)

- Maps Stacks token IDs to Base token IDs and vice versa
- Stores bidirectional mappings: `stacksTokenId <-> baseTokenId`
- Tracks origin chain for each token
- Prevents duplicate bridging
- Only bridge contract can update mappings

### 3. Cross-Chain Oracle Contracts

#### Base Network Oracle (`/usdc/contracts/XMBLOracleBase.sol`)

- Aggregates state from both Stacks and Base contracts
- Reads from Stacks via Chainlink Oracle (or similar Stacks → EVM oracle)
- Stores aggregated totals: `totalTokensMinted`, `aggregatedProofOfFaith`
- Calculates unified `currentPrice` based on total tokens across both chains
- Updates both contracts when state changes
- Only oracle can call sync functions on contracts

#### Stacks Oracle Contract (`/btc/contracts/xmbl-oracle.clar`)

- Receives state updates from Base via Wormhole
- Stores Base contract state: `base-tokens-minted`, `base-proof-of-faith`
- Receives price sync updates from Base oracle
- Updates local contract state when synced

### 4. Contract Modifications

#### Modify `/usdc/contracts/XMBLTokenBase.sol`

- Add bridge/oracle contract addresses
- Add bridge functions (bridgeToStacks, receiveFromStacks)
- Add sync functions (syncPriceFromOracle, syncProofOfFaithFromOracle)
- Modify mintNew to call oracle for state sync
- Track bridged tokens

#### Modify `/btc/contracts/xmbl-token.clar`

- Add bridge/oracle contract principals
- Add bridge functions
- Add sync functions
- Modify mint-new to notify oracle
- Track bridged tokens

### 5. Wormhole Integration Service

#### Off-Chain Service (`/bridge/services/WormholeBridgeService.ts`)

- Monitors bridge events on both chains
- Submits Wormhole messages when bridging initiated
- Receives Wormhole messages and validates
- Calls receive functions on destination chains
- Handles Wormhole message encoding/decoding

## Files to Create/Modify

### New Files:

1. `/usdc/contracts/XMBLTokenBridge.sol`
2. `/usdc/contracts/XMBLTokenRegistry.sol`
3. `/usdc/contracts/XMBLOracleBase.sol`
4. `/btc/contracts/xmbl-bridge.clar`
5. `/btc/contracts/xmbl-oracle.clar`
6. `/bridge/services/WormholeBridgeService.ts`
7. `/bridge/scripts/bridge-to-stacks.ts`
8. `/bridge/scripts/bridge-to-base.ts`
9. `/bridge/config/wormhole.json`

### Modify Existing:

1. `/usdc/contracts/XMBLTokenBase.sol`
2. `/btc/contracts/xmbl-token.clar`

### To-dos

- [ ] Create Base bridge contract (XMBLTokenBridge.sol) with Wormhole integration
- [ ] Create Stacks bridge contract (xmbl-bridge.clar) with Wormhole message handling
- [ ] Create token ID mapping registry contract (XMBLTokenRegistry.sol) on Base
- [ ] Create Base oracle contract (XMBLOracleBase.sol) for state aggregation
- [ ] Create Stacks oracle contract (xmbl-oracle.clar) for state sync
- [ ] Modify XMBLTokenBase.sol to integrate bridge and oracle
- [ ] Modify xmbl-token.clar to integrate bridge and oracle
- [ ] Create WormholeBridgeService.ts for off-chain bridge message handling
- [ ] Create bridge scripts (bridge-to-stacks.ts, bridge-to-base.ts)
- [ ] Implement price calculation sync logic in oracle
- [ ] Implement proof-of-faith aggregation in Base oracle
- [ ] Add tests for bridge functionality, token ID mapping, and state synchronization