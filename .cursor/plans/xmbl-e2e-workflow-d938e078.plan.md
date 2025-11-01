<!-- d938e078-c357-4151-b625-483afce253d0 0ac3c710-9445-49f8-8584-dcd852f012b7 -->
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

**Key Functions:**
```solidity
function bridgeToStacks(uint256 tokenId) external;
function receiveFromStacks(bytes memory message) external; // Called by Wormhole relayer
function isBridged(uint256 tokenId) external view returns (bool);
```

#### Stacks Network (`/btc/contracts/xmbl-bridge.clar`)
- Clarity contract for Stacks side bridge operations
- Lock NFT before bridging (remove from listings, prevent transfers)
- Emit bridge event (Wormhole integration via off-chain service)
- Receive bridge completion messages
- Mint corresponding NFT with mapped token ID
- Track bridge status

**Key Functions:**
```clarity
(define-public (bridge-to-base (token-id uint)))
(define-public (receive-from-base (message (buff 100))))
(define-read-only (is-bridged (token-id uint)))
```

### 2. Token ID Mapping Registry

#### Base Network (`/usdc/contracts/XMBLTokenRegistry.sol`)
- Maps Stacks token IDs to Base token IDs and vice versa
- Stores bidirectional mappings: `stacksTokenId <-> baseTokenId`
- Tracks origin chain for each token
- Prevents duplicate bridging
- Only bridge contract can update mappings

**Storage:**
```solidity
mapping(uint256 => uint256) public stacksToBase; // stacksId => baseId
mapping(uint256 => uint256) public baseToStacks; // baseId => stacksId
mapping(uint256 => bool) public tokenOrigin; // true = Stacks origin, false = Base origin
```

### 3. Cross-Chain Oracle Contracts

#### Base Network Oracle (`/usdc/contracts/XMBLOracleBase.sol`)
- Aggregates state from both Stacks and Base contracts
- Reads from Stacks via Chainlink Oracle (or similar Stacks → EVM oracle)
- Stores aggregated totals: `totalTokensMinted`, `aggregatedProofOfFaith`
- Calculates unified `currentPrice` based on total tokens across both chains
- Updates both contracts when state changes
- Only oracle can call sync functions on contracts

**State Aggregation:**
```solidity
struct AggregatedState {
    uint256 totalTokensStacks;      // From Stacks contract
    uint256 totalTokensBase;        // From Base contract
    uint256 totalTokensMinted;      // Sum of both
    uint256 proofOfFaithStacks;     // From Stacks (in satoshis)
    uint256 proofOfFaithBase;       // From Base (in WBTC satoshis)
    uint256 aggregatedProofOfFaith; // Unified total (normalized)
    uint256 currentPrice;           // Calculated from totalTokensMinted
}
```

**Key Functions:**
```solidity
function updateStacksState(uint256 tokensMinted, uint256 proofOfFaith) external;
function updateBaseState(uint256 tokensMinted, uint256 proofOfFaith) external;
function syncPriceToStacks(uint256 newPrice) external; // Via Wormhole message
function syncPriceToBase(uint256 newPrice) external;
function getAggregatedState() external view returns (AggregatedState memory);
```

#### Stacks Oracle Contract (`/btc/contracts/xmbl-oracle.clar`)
- Receives state updates from Base via Wormhole
- Stores Base contract state: `base-tokens-minted`, `base-proof-of-faith`
- Receives price sync updates from Base oracle
- Updates local contract state when synced

**Key Functions:**
```clarity
(define-public (update-base-state (tokens-minted uint) (proof-of-faith uint)))
(define-public (sync-price (new-price uint)))
(define-read-only (get-aggregated-state))
```

### 4. Contract Modifications

#### Modify `/usdc/contracts/XMBLTokenBase.sol`
- Add `bridgeContract` address (only bridge can call bridge functions)
- Add `oracleContract` address (only oracle can sync price/proof-of-faith)
- Add `bridgedTokens` mapping to track which tokens are bridged
- Add `bridgeToStacks()` function (locks NFT, emits event)
- Add `receiveFromStacks()` function (mints NFT with mapped ID)
- Modify `mintNew()` to call oracle for state sync after mint
- Modify `proofOfFaith` to sync from master oracle
- Modify `currentPrice` to sync from oracle

**New State Variables:**
```solidity
address public bridgeContract;
address public oracleContract;
mapping(uint256 => bool) public bridgedTokens;
mapping(uint256 => uint256) public crossChainTokenId; // baseId => stacksId
```

**Modified Functions:**
```solidity
function mintNew(...) external {
    // ... existing mint logic ...
    oracleContract.updateBaseState(tokensMinted, proofOfFaith);
    oracleContract.syncPriceToStacks(currentPrice); // Via Wormhole
}

function syncPriceFromOracle(uint256 newPrice) external onlyOracle {
    currentPrice = newPrice;
}

function syncProofOfFaithFromOracle(uint256 newProofOfFaith) external onlyOracle {
    proofOfFaith = newProofOfFaith;
}
```

#### Modify `/btc/contracts/xmbl-token.clar`
- Add `bridge-contract` principal (only bridge can call bridge functions)
- Add `oracle-contract` principal (only oracle can sync)
- Add `bridged-tokens` map
- Add `cross-chain-token-id` map (stacks-id => base-id)
- Add bridge functions
- Modify `mint-new` to notify oracle after mint
- Modify price and proof-of-faith to sync from oracle

**New Data Variables:**
```clarity
(define-data-var bridge-contract (optional principal) none)
(define-data-var oracle-contract (optional principal) none)
(define-map bridged-tokens { id: uint } bool)
(define-map cross-chain-token-id { stacks-id: uint } uint) ;; Maps to base token ID
```

### 5. Master Chain Synchronization (Base)

**Proof-of-Faith Master Storage:**
- Base oracle contract stores unified `aggregatedProofOfFaith`
- Both contracts sync from oracle
- When minting on Base: update oracle → oracle syncs to Stacks
- When minting on Stacks: update oracle → oracle updates Base contract
- Normalize units: Stacks uses satoshis, Base uses WBTC satoshis (both 1e8 scale)

**Price Synchronization:**
- Oracle calculates unified price: `calculatePrice(previousPrice, totalTokensMintedAcrossChains)`
- Syncs calculated price to both contracts
- Ensures both chains show same price regardless of where tokens exist

### 6. Wormhole Integration Service

#### Off-Chain Service (`/bridge/services/WormholeBridgeService.ts`)
- Monitors bridge events on both chains
- Submits Wormhole messages when bridging initiated
- Receives Wormhole messages and validates
- Calls receive functions on destination chains
- Handles Wormhole message encoding/decoding

**Key Functions:**
```typescript
async bridgeToStacks(baseTokenId: number): Promise<string>
async bridgeToBase(stacksTokenId: number): Promise<string>
async monitorWormholeMessages(): Promise<void>
async validateAndDeliverMessage(message: WormholeMessage): Promise<void>
```

### 7. Bridge Scripts

#### `/bridge/scripts/bridge-to-stacks.ts`
- User initiates bridge from Base
- Locks NFT on Base
- Submits Wormhole message
- Monitors for completion on Stacks

#### `/bridge/scripts/bridge-to-base.ts`
- User initiates bridge from Stacks
- Locks NFT on Stacks
- Submits Wormhole message (via service)
- Monitors for completion on Base

## Implementation Details

### Token ID Mapping Logic

When bridging:
1. User calls `bridgeToStacks(tokenId)` on Base
2. Base contract locks token, emits event with tokenId
3. Bridge service creates Wormhole message with:
   - Source token ID (Base)
   - Target chain (Stacks)
   - Owner address
   - Token price (for state sync)
4. On Stacks, bridge contract mints new NFT with:
   - New token ID (next available on Stacks)
   - Mapped to original Base token ID
5. Registry stores bidirectional mapping

### Price Calculation Sync

Formula: `cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))`

Where `x = totalTokensMintedAcrossBothChains`

Oracle:
1. Reads `tokensMinted` from Stacks contract (via oracle)
2. Reads `tokensMinted` from Base contract
3. Sums them: `totalTokens = stacksTokens + baseTokens`
4. Calculates unified price using total
5. Syncs price to both contracts

### Proof-of-Faith Aggregation

- Stacks: stores in satoshis (1e8 scale)
- Base: stores in WBTC satoshis (1e8 scale)
- Oracle normalizes both to same scale
- Aggregates: `total = stacksProofOfFaith + baseProofOfFaith`
- Syncs aggregated total back to both contracts
- Pool split uses aggregated total for calculations

## Files to Create/Modify

### New Files:
1. `/usdc/contracts/XMBLTokenBridge.sol` - Base bridge contract
2. `/usdc/contracts/XMBLTokenRegistry.sol` - Token ID mapping registry
3. `/usdc/contracts/XMBLOracleBase.sol` - Base oracle contract
4. `/btc/contracts/xmbl-bridge.clar` - Stacks bridge contract
5. `/btc/contracts/xmbl-oracle.clar` - Stacks oracle contract
6. `/bridge/services/WormholeBridgeService.ts` - Bridge service
7. `/bridge/scripts/bridge-to-stacks.ts` - Bridge script
8. `/bridge/scripts/bridge-to-base.ts` - Bridge script
9. `/bridge/config/wormhole.json` - Wormhole configuration

### Modify Existing:
1. `/usdc/contracts/XMBLTokenBase.sol` - Add bridge/oracle integration
2. `/btc/contracts/xmbl-token.clar` - Add bridge/oracle integration

## Security Considerations

- Bridge contracts verify Wormhole messages before minting
- Oracle contracts verify source before updating state
- Tokens locked during bridge (cannot transfer or list)
- Registry prevents duplicate mappings
- Price sync requires oracle signature/authorization
- Proof-of-faith sync validates source chain data

## Testing Strategy

- Unit tests for bridge functions
- Integration tests for cross-chain messaging
- Oracle aggregation tests
- State synchronization tests
- Token ID mapping verification
- Edge cases: bridge failure, double-bridge attempts

## Deployment Order

1. Deploy registry contract on Base
2. Deploy oracle contracts on both chains
3. Deploy bridge contracts on both chains
4. Update existing token contracts with bridge/oracle addresses
5. Initialize bridge service (off-chain)
6. Test bridge flow end-to-end

### To-dos

- [ ] Initialize project structure with TypeScript, Hardhat, dependencies (Avail SDK, Pyth SDK, Blockscout SDK, ethers.js)
- [ ] Develop and deploy smart contracts: DepositManager, ChainDepositContract, PriceOracle with Pyth integration
- [ ] Implement NexusIntentService with sequential intent processing and Bridge & Execute pattern
- [ ] Build PythOracleService with Hermes price fetching and on-chain updatePriceFeeds logic
- [ ] Setup BlockscoutMonitorService, deploy Autoscout explorer, implement MCP prompts for AI auditing
- [ ] Create CLI scripts for deployment, monitoring, activation, price queries, and verification
- [ ] Generate configuration files for chains, contracts, Pyth feeds, Avail Nexus, and Blockscout
- [ ] Write AVAIL_FEEDBACK.md, INTEGRATION.md, API.md, and update README with architecture and demo flow