<!-- d938e078-c357-4151-b625-483afce253d0 0ac3c710-9445-49f8-8584-dcd852f012b7 -->
# XMBL E2E Cross-Chain Token Activation Platform

## Architecture

Multi-chain token activation system with:

- **Avail Nexus SDK**: Cross-chain deposit intents with sequential processing
- **Pyth Network**: Real-time BTC price feeds and algorithmic pricing updates
- **Blockscout**: Transparency layer with explorer and MCP for AI monitoring

## Core Components

### 1. Smart Contracts (`/contracts`)

**DepositManager.sol** (Central consolidation contract)

- Receives deposits from multiple chains via Avail intents
- Queries Pyth for BTC price feeds
- Implements sequential activation queue with price locking
- Emits events for cross-chain transparency
- Manages BTC pool address routing

**ChainDepositContract.sol** (Deployed per chain)

- Accepts user deposits (ETH, USDC, USDT, etc.)
- Creates cross-chain intents via Avail Nexus
- Queries Pyth for current BTC equivalent
- Reports to central DepositManager
- Implements "Bridge & Execute" pattern

**PriceOracle.sol**

- Integrates Pyth pull oracle (updatePriceFeeds) for BTC/USD conversion
- Implements XMBL token economics pricing function
- Price calculation: `x / (Phi * y)` where x=Token Price, y=Tokens Minted, Phi=Golden Ratio (1.618...)
- Starting value: 1 satoshi (0.00000001 BTC)
- Price increases on activation, decreases on deactivation
- **All prices round UP to nearest satoshi**
- Provides sequential price locking per activation (locks price on intent creation)
- Implements settlement verification with automatic revert if settlement fails
- Low-latency settlement verification
- 3% network fee calculation on all transactions

### 2. Backend Services (`/services`)

**NexusIntentService.ts**

- Initializes Avail Nexus SDK using `@avail-project/nexus-core` (headless SDK)
- Sets up intent hooks (setOnIntentHook) for approval/denial
- Sets up allowance hooks (setOnAllowanceHook) for token permissions
- Manages cross-chain intent queue with sequential processing
- Subscribes to nexusEvents (EXPECTED_STEPS, STEP_COMPLETE, etc.)
- Handles Bridge & Execute pattern for prize qualification
- Implements retry logic and error handling

**PythOracleService.ts**

- Integrates `@pythnetwork/pyth-evm-js` SDK
- Fetches real-time prices from Hermes API
- Implements updatePriceFeeds contract method
- Manages price feed subscriptions (BTC/USD feed ID)
- Implements caching layer for rate limiting
- Handles Pyth EVM error codes

**BlockscoutMonitorService.ts**

- Indexes events from Avail intents
- Tracks deposit/activation transactions
- Pushes data to Autoscout instance
- Interfaces with Blockscout REST/RPC APIs

**BlockscoutMCPService.ts**

- Integrates with Blockscout MCP server (ghcr.io/blockscout/mcp-server)
- Provides tools: get_chains_list, get_address_info, get_token_holdings
- Implements custom MCP prompt for activation auditing (prompt prize)
- Exposes MCP tools for AI analysis

**MCPApplication.ts**

- Full application using Blockscout MCP server (app prize)
- Provides conversational blockchain analytics
- Analyzes activation sequences for anomalies
- AI-powered activation auditor interface

**BTCConversionService.ts**

- Integrates THORChain testnet bridge
- Handles asset-to-BTC swaps on testnet
- Routes funds to BTC pool address
- Tracks conversion confirmations

### 3. CLI Scripts (`/scripts`)

**deploy.ts** - Deploy contracts to multiple chains
**activate.ts** - Process manual token activation
**monitor.ts** - Real-time monitoring of cross-chain flows
**fetch-prices.ts** - Query current Pyth prices
**verify-sequence.ts** - Audit activation sequencing
**export-records.ts** - Export transparent records
**setup-autoscout.ts** - Deploy Blockscout explorer
**test-flow.ts** - End-to-end testnet flow

### 4. Configuration (`/config`)

**chains.json** - Supported chains with RPC endpoints
**contracts.json** - Deployed contract addresses
**pyth.json** - Price feed IDs and Hermes endpoints
**avail.json** - Nexus SDK configuration
**blockscout.json** - Explorer and MCP settings

### 5. Documentation

**AVAIL_FEEDBACK.md** - Developer feedback for $500 bonus
**INTEGRATION.md** - Technical integration guide
**API.md** - Service API documentation
**DEMO.md** - Demo video script and flow

## Implementation Details

### Sequential Activation Flow

1. User deposits on any chain → ChainDepositContract
2. Contract queries Pyth for BTC price
3. Creates Avail intent for cross-chain routing
4. Intent queues in sequential order (on-chain confirmation required)
5. Central DepositManager processes when prior activation settles
6. Algorithmic price increment applied
7. BTC conversion executed
8. All events indexed by Blockscout

### Prize Alignment

- **Avail DeFi/Payments** ($5k): Sequential intents + Bridge & Execute
- **Avail Unchained Apps** ($4.5k): Unified activation router concept
- **Avail Feedback** ($500): AVAIL_FEEDBACK.md with detailed testing
- **Pyth Innovative Use** ($3k): Algorithmic pricing + PR to pyth-examples
- **Blockscout Autoscout** ($3.5k): Custom explorer deployment
- **Blockscout SDK** ($3k): Real-time transaction embedding
- **Blockscout MCP** ($3.5k): AI activation auditing prompts

**Total Target**: $23,000

## Tech Stack

- **Solidity 0.8.x**: Smart contracts
- **Hardhat**: Development framework
- **TypeScript/Node.js**: Backend services
- **Avail Nexus SDK**: Cross-chain intents
- **Pyth Network SDK**: Oracle integration
- **Blockscout SDK + MCP**: Monitoring layer
- **Ethers.js v6**: Blockchain interaction

## Testnet Chains

Ethereum Sepolia, Polygon Mumbai, BSC Testnet, Arbitrum Sepolia, Optimism Sepolia

## Git Workflow - MANDATORY

**COMMIT AFTER EVERY SMALL CHANGE**

Every single change must be:
1. **Tested** - Unit tests + integration tests
2. **Security verified** - No vulnerabilities introduced
3. **Committed to GitHub** - Small atomic commits only
4. **Verified cohesive** - Works with entire system

**NO GIANT CODE DUMPS - Commit after each component is added and tested**

Commit message format:
```
[Component] Brief description

- What was changed
- Tests added
- Security checks: passed
- Integration: verified
```

Every commit requires:
- All existing tests pass
- New tests for new code
- Security audit (reentrancy, access control, overflows)
- Build succeeds
- System remains cohesive

### To-dos

- [ ] Initialize project structure with TypeScript, Hardhat, dependencies (Avail SDK, Pyth SDK, Blockscout SDK, ethers.js)
- [ ] Develop and deploy smart contracts: DepositManager, ChainDepositContract, PriceOracle with Pyth integration
- [ ] Implement NexusIntentService with sequential intent processing and Bridge & Execute pattern
- [ ] Build PythOracleService with Hermes price fetching and on-chain updatePriceFeeds logic
- [ ] Setup BlockscoutMonitorService, deploy Autoscout explorer, implement MCP prompts for AI auditing
- [ ] Create CLI scripts for deployment, monitoring, activation, price queries, and verification
- [ ] Generate configuration files for chains, contracts, Pyth feeds, Avail Nexus, and Blockscout
- [ ] Write AVAIL_FEEDBACK.md, INTEGRATION.md, API.md, and update README with architecture and demo flow