# XMBL Token API Documentation

## Overview

This document provides comprehensive API documentation for the XMBL token activation platform, covering smart contract interfaces, service APIs, and CLI tool usage.

## Smart Contract APIs

### PriceOracle Contract

**Address**: Deployed per network (see deployment configs)
**Purpose**: Implements XMBL token economics with Pyth oracle integration

#### Functions

##### `calculatePrice(uint256 _tokensMinted) → uint256`
Calculates token price using golden ratio formula: `x / (Phi * y)`

**Parameters:**
- `_tokensMinted`: Number of tokens minted

**Returns:**
- `uint256`: Token price in satoshis (rounded up)

**Example:**
```solidity
uint256 price = priceOracle.calculatePrice(100);
// Returns: 100000000 (1 satoshi, rounded up)
```

##### `activateToken()`
Increases tokens minted and updates price

**Events:**
- `TokenActivated(uint256 newPrice, uint256 tokensMinted)`

**Example:**
```solidity
await priceOracle.activateToken();
```

##### `deactivateToken()`
Decreases tokens minted and updates price

**Requirements:**
- `tokensMinted > 0`

**Events:**
- `TokenDeactivated(uint256 newPrice, uint256 tokensDeactivated)`

**Example:**
```solidity
await priceOracle.deactivateToken();
```

##### `calculateNetworkFee(uint256 amount) → uint256`
Calculates 3% network fee, rounded up to nearest satoshi

**Parameters:**
- `amount`: Amount to calculate fee for

**Returns:**
- `uint256`: Network fee in satoshis

**Example:**
```solidity
uint256 fee = priceOracle.calculateNetworkFee(ethers.parseEther("1"));
// Returns: 100000000 (1 satoshi, rounded up)
```

##### `getCurrentPrice() → uint256`
Gets current token price

**Returns:**
- `uint256`: Current price in satoshis

##### `getBtcPrice() → uint256`
Gets BTC price from Pyth oracle (mock implementation)

**Returns:**
- `uint256`: BTC price in satoshis

#### Events

```solidity
event PriceUpdated(uint256 newPrice, uint256 tokensMinted);
event TokenActivated(uint256 newPrice, uint256 tokensMinted);
event TokenDeactivated(uint256 newPrice, uint256 tokensDeactivated);
event ActivationSettled(uint256 activationId, bool success);
```

### DepositManager Contract

**Address**: Deployed per network
**Purpose**: Central contract for managing cross-chain deposits and sequential activations

#### Functions

##### `receiveDeposit(address _user, uint256 _amount, uint256 _btcEquivalent) → uint256`
Receives deposit and adds to activation queue

**Parameters:**
- `_user`: User address
- `_amount`: Deposit amount
- `_btcEquivalent`: BTC equivalent value

**Returns:**
- `uint256`: Activation ID

**Events:**
- `DepositReceived(uint256 depositId, address user, uint256 amount, uint256 btcEquivalent)`
- `ActivationQueued(uint256 depositId, uint256 activationId, uint256 lockedPrice)`

##### `processNextActivation()`
Processes next activation in queue (owner only)

**Events:**
- `ActivationProcessed(uint256 activationId, address user, uint256 finalPrice)`
- `ActivationSettlementFailed(uint256 activationId)`

##### `getDeposit(uint256 _depositId) → Deposit`
Gets deposit details

**Parameters:**
- `_depositId`: Deposit ID

**Returns:**
```solidity
struct Deposit {
    uint256 id;
    address user;
    uint256 amount;
    uint256 btcEquivalent;
    uint256 activationPrice;
    bool processed;
    bool settled;
}
```

##### `getActivation(uint256 _activationId) → Activation`
Gets activation details

**Parameters:**
- `_activationId`: Activation ID

**Returns:**
```solidity
struct Activation {
    uint256 id;
    uint256 depositId;
    address user;
    uint256 amount;
    uint256 btcEquivalent;
    uint256 lockedPrice;
    bool completed;
}
```

##### `getActivationQueueLength() → uint256`
Gets current queue length

**Returns:**
- `uint256`: Number of pending activations

#### Events

```solidity
event DepositReceived(uint256 depositId, address user, uint256 amount, uint256 btcEquivalent);
event ActivationQueued(uint256 depositId, uint256 activationId, uint256 lockedPrice);
event ActivationProcessed(uint256 activationId, address user, uint256 finalPrice);
event ActivationSettlementFailed(uint256 activationId);
```

### ChainDepositContract Contract

**Address**: Deployed per chain
**Purpose**: Accepts user deposits and creates cross-chain intents

#### Functions

##### `deposit(address token, uint256 amount)`
Accepts user deposits (ERC20 or native currency)

**Parameters:**
- `token`: Token address (0x0 for native currency)
- `amount`: Deposit amount

**Events:**
- `DepositMade(uint256 depositId, address user, address token, uint256 amount, uint256 btcEquivalent)`

**Example:**
```solidity
// Native currency deposit
await chainDepositContract.deposit(ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") });

// ERC20 token deposit
await chainDepositContract.deposit(tokenAddress, ethers.parseEther("100"));
```

##### `createIntent(uint256 depositId) → uint256`
Creates cross-chain intent (owner only)

**Parameters:**
- `depositId`: Deposit ID

**Returns:**
- `uint256`: Activation ID

**Events:**
- `IntentCreated(uint256 depositId, uint256 activationId, string intentData)`

##### `calculateBtcEquivalent(address token, uint256 amount) → uint256`
Calculates BTC equivalent for token amount

**Parameters:**
- `token`: Token address
- `amount`: Token amount

**Returns:**
- `uint256`: BTC equivalent value

**Events:**
- `BtcEquivalentCalculated(address token, uint256 amount, uint256 btcEquivalent)`

##### `getDeposit(uint256 _depositId) → Deposit`
Gets deposit details

**Parameters:**
- `_depositId`: Deposit ID

**Returns:**
```solidity
struct Deposit {
    uint256 id;
    address user;
    address token;
    uint256 amount;
    uint256 btcEquivalent;
    bool processed;
}
```

#### Events

```solidity
event DepositMade(uint256 depositId, address user, address token, uint256 amount, uint256 btcEquivalent);
event IntentCreated(uint256 depositId, uint256 activationId, string intentData);
event BtcEquivalentCalculated(address token, uint256 amount, uint256 btcEquivalent);
```

## Service APIs

### NexusIntentService

**Purpose**: Manages cross-chain intents using Avail Nexus SDK

#### Constructor

```typescript
constructor(
  provider: ethers.Provider,
  depositManagerAddress: string,
  chainContracts: Map<number, string>
)
```

#### Methods

##### `initializeNexus(): Promise<void>`
Initializes Avail Nexus SDK

**Example:**
```typescript
await nexusService.initializeNexus();
```

##### `createIntent(chainId: number, depositId: number, user: string, amount: string, btcEquivalent: string): Promise<string>`
Creates cross-chain intent

**Parameters:**
- `chainId`: Source chain ID
- `depositId`: Deposit ID
- `user`: User address
- `amount`: Deposit amount
- `btcEquivalent`: BTC equivalent value

**Returns:**
- `Promise<string>`: Intent ID

**Example:**
```typescript
const intentId = await nexusService.createIntent(1, 1, "0x1234...", "1000000000000000000", "5000000000");
```

##### `getIntentStatus(intentId: string): any`
Gets intent status

**Parameters:**
- `intentId`: Intent ID

**Returns:**
- Intent status object

##### `getQueueStatus(): { total: number; pending: number; processing: number; completed: number; failed: number }`
Gets queue status

**Returns:**
- Queue statistics

##### `getAllIntents(): any[]`
Gets all intents

**Returns:**
- Array of all intents

##### `clearCompletedIntents(): void`
Clears completed intents from queue

##### `emergencyStop(): void`
Stops intent processing

### PythOracleService

**Purpose**: Fetches real-time BTC price feeds from Pyth Network

#### Constructor

```typescript
constructor(
  provider: ethers.Provider,
  priceOracleAddress: string,
  hermesUrl: string,
  btcUsdPriceFeedId: string,
  cacheTimeout: number = 60000
)
```

#### Methods

##### `fetchBtcPrice(): Promise<number | null>`
Fetches BTC price from Pyth Hermes API

**Returns:**
- `Promise<number | null>`: BTC price in USD

**Example:**
```typescript
const btcPrice = await pythOracle.fetchBtcPrice();
console.log(`BTC Price: $${btcPrice}`);
```

##### `updatePriceFeeds(): Promise<string>`
Updates on-chain price feeds

**Returns:**
- `Promise<string>`: Transaction hash

**Example:**
```typescript
const txHash = await pythOracle.updatePriceFeeds();
console.log(`Update transaction: ${txHash}`);
```

##### `startPeriodicUpdates(intervalMs: number): void`
Starts periodic price updates

**Parameters:**
- `intervalMs`: Update interval in milliseconds

**Example:**
```typescript
pythOracle.startPeriodicUpdates(30000); // Update every 30 seconds
```

##### `stopPeriodicUpdates(): void`
Stops periodic updates

##### `clearCache(): void`
Clears price cache

##### `getCacheStats(): { size: number; oldestEntry: number | null; newestEntry: number | null }`
Gets cache statistics

##### `getPriceFeedStatus(): Promise<any>`
Gets price feed status

### BlockscoutMonitorService

**Purpose**: Monitors blockchain events and provides transparency

#### Constructor

```typescript
constructor(provider: ethers.Provider)
```

#### Methods

##### `addContract(chainId: number, contractAddress: string, contractABI: any[]): void`
Adds contract to monitoring

**Parameters:**
- `chainId`: Chain ID
- `contractAddress`: Contract address
- `contractABI`: Contract ABI

**Example:**
```typescript
blockscoutMonitor.addContract(1, "0x1234...", contractABI);
```

##### `removeContract(chainId: number, contractAddress: string): void`
Removes contract from monitoring

##### `indexEvents(chainId: number, contractAddress: string, fromBlock?: number, toBlock?: number): Promise<number>`
Indexes events for contract

**Parameters:**
- `chainId`: Chain ID
- `contractAddress`: Contract address
- `fromBlock`: Start block (optional)
- `toBlock`: End block (optional, default: 'latest')

**Returns:**
- `Promise<number>`: Number of events indexed

##### `exportEvents(chainId: number, contractAddress: string): any[]`
Exports indexed events

**Returns:**
- Array of events

##### `clearEvents(chainId: number, contractAddress: string): void`
Clears events for contract

##### `pushToAutoscout(data: any): Promise<void>`
Pushes data to Autoscout instance

##### `getTransactionDetails(txHash: string, chainId: number): Promise<any>`
Gets transaction details

### BlockscoutMCPService

**Purpose**: Integrates with Blockscout Model Context Protocol for AI analysis

#### Constructor

```typescript
constructor(config: { apiKey: string; mcpServerUrl: string })
```

#### Methods

##### `getAvailableTools(): Promise<MCPTool[]>`
Gets available MCP tools

**Returns:**
- Array of available tools

##### `getToolDetails(toolName: string): Promise<MCPTool | null>`
Gets tool details

**Parameters:**
- `toolName`: Tool name

##### `analyzeActivationSequence(chainId: number, contractAddress: string, timeRange?: string): Promise<any>`
Analyzes activation sequence

**Parameters:**
- `chainId`: Chain ID
- `contractAddress`: Contract address
- `timeRange`: Time range (default: '24h')

##### `getChainsList(): Promise<any[]>`
Gets supported chains

##### `getAddressInfo(chainId: number, address: string): Promise<any>`
Gets address information

##### `getTokenHoldings(chainId: number, address: string): Promise<any[]>`
Gets token holdings

### MCPApplication

**Purpose**: Full application using Blockscout MCP server for conversational blockchain analytics

#### Constructor

```typescript
constructor(mcpService: BlockscoutMCPService)
```

#### Methods

##### `processQuery(query: string): Promise<any>`
Processes user query using MCP tools

**Parameters:**
- `query`: User query

**Returns:**
- Response object with analysis and recommendations

**Example:**
```typescript
const result = await mcpApp.processQuery("Analyze activation sequence for contract 0x1234...");
console.log(result.response);
console.log(result.analysis);
console.log(result.recommendations);
```

##### `getConversationHistory(): ConversationEntry[]`
Gets conversation history

##### `clearConversationHistory(): void`
Clears conversation history

##### `exportConversationHistory(format: 'json' | 'text' = 'json'): string`
Exports conversation history

## CLI Tool APIs

### Deploy Script

**Usage:**
```bash
npm run deploy
```

**Output:**
- Contract addresses
- Transaction hashes
- Environment variables
- Deployment configuration

### Activate Script

**Usage:**
```bash
npm run activate <user_address> <amount> <token_address> <chain_id>
```

**Parameters:**
- `user_address`: User wallet address
- `amount`: Deposit amount (in wei)
- `token_address`: Token address (0x0 for native currency)
- `chain_id`: Chain ID

**Example:**
```bash
npm run activate 0x1234567890123456789012345678901234567890 1000000000000000000 0x0000000000000000000000000000000000000000 1
```

### Monitor Script

**Usage:**
```bash
npm run monitor [start|events|prices|status|export]
```

**Commands:**
- `start`: Start full monitoring
- `events`: Monitor blockchain events
- `prices`: Monitor price feeds
- `status`: Show current status
- `export`: Export monitoring data

### Fetch Prices Script

**Usage:**
```bash
npm run fetch-prices [current|history|update|status]
```

**Commands:**
- `current`: Fetch current prices
- `history`: Fetch price history
- `update`: Update on-chain prices
- `status`: Show price feed status

**Formats:**
- `json`: JSON format
- `csv`: CSV format
- `table`: Table format

### Verify Sequence Script

**Usage:**
```bash
npm run verify-sequence [verify|audit|analyze|report] [contract_address] [time_range]
```

**Commands:**
- `verify`: Verify activation sequence integrity
- `audit`: Perform AI-powered audit
- `analyze`: Analyze sequence patterns
- `report`: Generate detailed report

### Export Records Script

**Usage:**
```bash
npm run export-records [json|csv] [output_dir]
```

**Parameters:**
- Format: `json` or `csv`
- Output directory (optional)

### Setup Autoscout Script

**Usage:**
```bash
npm run setup-autoscout [setup|configure|test|start]
```

**Commands:**
- `setup`: Initial Autoscout setup
- `configure`: Configure Autoscout settings
- `test`: Test Autoscout functionality
- `start`: Start Autoscout services

### Test Flow Script

**Usage:**
```bash
npm run test-flow [full|intent|price|monitor|ai] [num_users]
```

**Commands:**
- `full`: Complete end-to-end test
- `intent`: Test cross-chain intent processing
- `price`: Test price feed integration
- `monitor`: Test monitoring and transparency
- `ai`: Test AI auditing capabilities

## Error Handling

### Common Error Codes

**Contract Errors:**
- `"No tokens to deactivate"`: Attempting to deactivate when no tokens minted
- `"Settlement failed"`: Settlement verification failed
- `"Activation queue is empty"`: No activations to process
- `"Deposit amount must be greater than 0"`: Invalid deposit amount

**Service Errors:**
- `ECONNREFUSED`: Connection refused (MCP server not running)
- `Network error`: Network connectivity issues
- `Invalid parameters`: Invalid function parameters
- `Timeout`: Request timeout

### Error Handling Best Practices

1. **Always check return values**
2. **Handle async errors with try/catch**
3. **Implement retry logic for network calls**
4. **Log errors for debugging**
5. **Provide user-friendly error messages**

## Rate Limits

### API Rate Limits

**Pyth Hermes API:**
- 100 requests per minute
- Caching recommended

**Blockscout API:**
- 1000 requests per hour
- Rate limiting implemented

**MCP Server:**
- 100 requests per minute
- Connection pooling recommended

### Best Practices

1. **Implement caching for price feeds**
2. **Use batch operations where possible**
3. **Implement exponential backoff**
4. **Monitor rate limit usage**
5. **Cache frequently accessed data**

## Security Considerations

### API Security

1. **Validate all inputs**
2. **Use HTTPS for all API calls**
3. **Implement authentication where required**
4. **Rate limit API endpoints**
5. **Log all API access**

### Smart Contract Security

1. **Use OpenZeppelin security patterns**
2. **Implement access controls**
3. **Prevent reentrancy attacks**
4. **Validate all parameters**
5. **Use secure random number generation**

### Data Security

1. **Encrypt sensitive data**
2. **Use secure key management**
3. **Implement audit logging**
4. **Regular security audits**
5. **Monitor for anomalies**
