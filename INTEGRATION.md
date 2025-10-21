# XMBL Token Integration Guide

## Overview

This document provides comprehensive integration guidance for the XMBL token activation platform, covering smart contracts, services, CLI tools, and partner technology integrations.

## Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Smart         │    │   Backend       │    │   Partner       │
│   Contracts     │    │   Services      │    │   Integrations  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • PriceOracle   │    │ • NexusIntent   │    │ • Avail Nexus   │
│ • DepositMgr    │    │ • PythOracle    │    │ • Pyth Network  │
│ • ChainDeposit  │    │ • Blockscout    │    │ • Blockscout    │
└─────────────────┘    │ • MCP           │    └─────────────────┘
                       └─────────────────┘
```

### Technology Stack

- **Smart Contracts**: Solidity 0.8.x, OpenZeppelin, Pyth SDK
- **Backend**: TypeScript, Node.js, Ethers.js v6
- **Testing**: Hardhat, Chai, Mocha
- **Partner APIs**: Avail Nexus, Pyth Hermes, Blockscout MCP

## Smart Contracts

### 1. PriceOracle.sol

**Purpose**: Implements XMBL token economics with Pyth oracle integration

**Key Features:**
- Golden ratio price calculation: `x / (Phi * y)`
- Pyth Network integration for BTC price feeds
- Network fee calculation (3%)
- Settlement verification

**Deployment:**
```bash
npm run deploy
```

**Key Functions:**
```solidity
function calculatePrice(uint256 _tokensMinted) public pure returns (uint256)
function activateToken() external
function deactivateToken() external
function calculateNetworkFee(uint256 amount) public pure returns (uint256)
```

### 2. DepositManager.sol

**Purpose**: Central contract for managing cross-chain deposits and sequential activations

**Key Features:**
- Cross-chain deposit management
- Sequential activation queue
- Settlement processing
- BTC pool integration

**Key Functions:**
```solidity
function receiveDeposit(address _user, uint256 _amount, uint256 _btcEquivalent) external returns (uint256)
function processNextActivation() external onlyOwner
function getActivationQueueLength() external view returns (uint256)
```

### 3. ChainDepositContract.sol

**Purpose**: Deployed on individual chains to accept user deposits and create cross-chain intents

**Key Features:**
- Multi-chain support
- ERC20 and native currency deposits
- BTC equivalent calculation
- Intent creation

**Key Functions:**
```solidity
function deposit(address token, uint256 amount) external payable
function createIntent(uint256 depositId) external onlyOwner returns (uint256)
function calculateBtcEquivalent(address token, uint256 amount) public returns (uint256)
```

## Backend Services

### 1. NexusIntentService

**Purpose**: Manages cross-chain intents using Avail Nexus SDK

**Features:**
- Sequential intent processing
- Bridge & Execute pattern
- Settlement verification
- Queue management

**Usage:**
```typescript
const nexusService = new NexusIntentService(provider, depositManagerAddress, chainContracts);
await nexusService.initializeNexus();
const intentId = await nexusService.createIntent(chainId, depositId, user, amount, btcEquivalent);
```

### 2. PythOracleService

**Purpose**: Fetches real-time BTC price feeds from Pyth Network

**Features:**
- Hermes API integration
- Price caching
- On-chain updates
- Periodic monitoring

**Usage:**
```typescript
const pythOracle = new PythOracleService(provider, priceOracleAddress, hermesUrl, btcUsdPriceId);
const btcPrice = await pythOracle.fetchBtcPrice();
await pythOracle.updatePriceFeeds();
```

### 3. BlockscoutMonitorService

**Purpose**: Monitors blockchain events and provides transparency

**Features:**
- Event indexing
- Contract monitoring
- Data export
- Autoscout integration

**Usage:**
```typescript
const blockscoutMonitor = new BlockscoutMonitorService(provider);
blockscoutMonitor.addContract(chainId, contractAddress, abi);
const events = await blockscoutMonitor.indexEvents(chainId, contractAddress);
```

### 4. BlockscoutMCPService

**Purpose**: Integrates with Blockscout Model Context Protocol for AI analysis

**Features:**
- MCP server integration
- AI-powered auditing
- Conversational analytics
- Security analysis

**Usage:**
```typescript
const mcpService = new BlockscoutMCPService({ apiKey, mcpServerUrl });
const tools = await mcpService.getAvailableTools();
const analysis = await mcpService.analyzeActivationSequence(chainId, contractAddress, timeRange);
```

## CLI Tools

### Deployment Scripts

**Deploy Contracts:**
```bash
npm run deploy
```

**Activate Tokens:**
```bash
npm run activate <user_address> <amount> <token_address> <chain_id>
```

**Monitor System:**
```bash
npm run monitor [start|events|prices|status|export]
```

**Fetch Prices:**
```bash
npm run fetch-prices [current|history|update|status]
```

**Verify Sequences:**
```bash
npm run verify-sequence [verify|audit|analyze|report] [contract_address] [time_range]
```

**Export Records:**
```bash
npm run export-records [json|csv] [output_dir]
```

**Setup Autoscout:**
```bash
npm run setup-autoscout [setup|configure|test|start]
```

**Test Flow:**
```bash
npm run test-flow [full|intent|price|monitor|ai] [num_users]
```

## Configuration

### Environment Variables

Create `.env` file:
```bash
# Private key for deployment
PRIVATE_KEY=your_private_key_here

# RPC URLs for testnets
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_KEY
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io

# Pyth Network Configuration
PYTH_HERMES_URL=https://hermes.pyth.network
PYTH_BTC_USD_FEED_ID=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43

# Blockscout Configuration
BLOCKSCOUT_API_URL=https://eth-sepolia.blockscout.com/api
BLOCKSCOUT_MCP_SERVER_URL=http://localhost:3000

# Avail Nexus Configuration
AVAIL_NEXUS_NETWORK=testnet
AVAIL_NEXUS_RPC_URL=https://nexus-rpc.avail.tools

# BTC Pool Address
BTC_POOL_ADDRESS=your_btc_pool_address_here
```

### Configuration Files

**Chains Configuration** (`config/chains.json`):
```json
{
  "networks": {
    "ethereum": {
      "name": "Ethereum",
      "chainId": 1,
      "network": "sepolia",
      "rpcUrl": "https://sepolia.infura.io/v3/YOUR_KEY"
    }
  }
}
```

**Contracts Configuration** (`config/contracts.json`):
```json
{
  "contracts": {
    "PriceOracle": {
      "name": "PriceOracle",
      "description": "Implements XMBL token economics"
    }
  }
}
```

## Testing

### Unit Tests

**Run All Tests:**
```bash
npm test
```

**Run Specific Tests:**
```bash
npx hardhat test test/PriceOracle.test.ts
npx hardhat test test/NexusIntentService.test.ts
npx hardhat test test/PythOracleService.test.ts
npx hardhat test test/BlockscoutIntegration.test.ts
```

### Integration Tests

**Test Full Flow:**
```bash
npm run test-flow full 5
```

**Test Specific Components:**
```bash
npm run test-flow intent 3
npm run test-flow price
npm run test-flow monitor
npm run test-flow ai
```

## Deployment

### 1. Local Development

**Install Dependencies:**
```bash
npm install
```

**Compile Contracts:**
```bash
npm run build
```

**Run Tests:**
```bash
npm test
```

### 2. Testnet Deployment

**Deploy to Sepolia:**
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

**Deploy to Mumbai:**
```bash
npx hardhat run scripts/deploy.ts --network mumbai
```

**Deploy to BSC Testnet:**
```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### 3. Production Deployment

**Configure Environment:**
- Set production RPC URLs
- Configure API keys
- Set up monitoring
- Enable security features

**Deploy Contracts:**
```bash
npm run deploy
```

**Verify Contracts:**
```bash
npm run verify
```

## Monitoring and Maintenance

### Monitoring Setup

**Start Monitoring:**
```bash
npm run monitor start
```

**Check Status:**
```bash
npm run monitor status
```

**Export Data:**
```bash
npm run export-records json exports/
```

### Autoscout Setup

**Initial Setup:**
```bash
npm run setup-autoscout setup
```

**Configure Settings:**
```bash
npm run setup-autoscout configure
```

**Test Functionality:**
```bash
npm run setup-autoscout test
```

**Start Services:**
```bash
npm run setup-autoscout start
```

## Troubleshooting

### Common Issues

**1. Contract Deployment Fails**
- Check RPC URL configuration
- Verify private key format
- Ensure sufficient gas

**2. Price Feeds Not Working**
- Verify Pyth Hermes URL
- Check BTC/USD feed ID
- Test network connectivity

**3. Monitoring Issues**
- Check Blockscout API URL
- Verify MCP server connection
- Review error logs

### Debug Commands

**Check Deployment Status:**
```bash
npm run monitor status
```

**Test Price Feeds:**
```bash
npm run fetch-prices status
```

**Verify Sequences:**
```bash
npm run verify-sequence verify
```

## Security Considerations

### Smart Contract Security

- **Access Controls**: Only owner can process activations
- **Reentrancy Protection**: ReentrancyGuard on deposit functions
- **Price Manipulation**: Sequential processing prevents MEV attacks
- **Settlement Verification**: All activations verified before processing

### Backend Security

- **API Key Management**: Secure storage of API keys
- **Rate Limiting**: Prevent abuse of services
- **Input Validation**: Validate all user inputs
- **Error Handling**: Secure error messages

### Monitoring Security

- **Audit Logging**: Log all critical operations
- **Anomaly Detection**: AI-powered security analysis
- **Transparency**: Public monitoring dashboard
- **Alert System**: Real-time security alerts

## Performance Optimization

### Smart Contract Optimization

- **Gas Efficiency**: Optimized contract code
- **Batch Operations**: Process multiple activations
- **Storage Optimization**: Efficient data structures

### Backend Optimization

- **Caching**: Price feed caching
- **Async Processing**: Non-blocking operations
- **Queue Management**: Efficient intent processing
- **Database Optimization**: Indexed queries

## Support and Resources

### Documentation

- **API Documentation**: `API.md`
- **Integration Guide**: `INTEGRATION.md`
- **Avail Feedback**: `AVAIL_FEEDBACK.md`

### Community

- **GitHub Issues**: Report bugs and feature requests
- **Discord**: Community support and discussions
- **Telegram**: Real-time support

### Professional Support

- **Enterprise Support**: Available for production deployments
- **Custom Integration**: Tailored solutions
- **Security Audits**: Professional security reviews
