# XMBL Integration Guide

## Overview

The XMBL E2E Cross-Chain Token Activation Platform provides a comprehensive solution for cross-chain token activation using Avail Nexus SDK, Pyth Network oracles, and Blockscout monitoring. This guide covers the technical integration details for developers.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Deposit  │    │  Avail Nexus    │    │  Pyth Oracle    │
│   (Any Chain)    │───▶│     SDK         │───▶│   (BTC Price)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ChainDeposit    │    │ DepositManager  │    │ PriceOracle     │
│ Contract        │    │ (Central)       │    │ (Tokenomics)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Blockscout      │    │ MCP Server      │    │ AI Analytics    │
│ Monitoring      │    │ (Transparency)   │    │ (Auditing)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/xmbl-tokens.git
cd xmbl-tokens

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
```

### 2. Environment Configuration

```bash
# .env file
# Avail Nexus SDK
AVAIL_RPC_URL=https://nexus-rpc.avail.tools
AVAIL_WS_URL=wss://nexus-ws.avail.tools

# Pyth Network
PYTH_HERMES_URL=https://hermes.pyth.network
PYTH_BTC_USD_FEED_ID=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43

# Blockscout
BLOCKSCOUT_MCP_SERVER_URL=http://localhost:3000
BLOCKSCOUT_API_KEY=your-api-key

# Network Configuration
HARDHAT_NETWORK=hardhat
PRIVATE_KEY=your-private-key
```

### 3. Deployment

```bash
# Deploy contracts
npm run deploy

# Set up monitoring
npm run setup-autoscout

# Start services
npm run start
```

## Core Components

### Smart Contracts

#### DepositManager.sol
Central consolidation contract that receives deposits from multiple chains.

```solidity
contract DepositManager {
    function createDeposit(
        uint256 chainId,
        address user,
        uint256 amount,
        uint256 btcEquivalent
    ) external returns (uint256 depositId);
    
    function settleActivation(
        uint256 depositId,
        bool settlementSuccess
    ) external;
}
```

#### ChainDepositContract.sol
Per-chain contract that accepts user deposits and creates cross-chain intents.

```solidity
contract ChainDepositContract {
    function deposit(
        address token,
        uint256 amount
    ) external returns (uint256 intentId);
}
```

#### PriceOracle.sol
Implements XMBL tokenomics with Pyth oracle integration.

```solidity
contract PriceOracle {
    function activateToken() external;
    function calculatePrice(uint256 tokensMinted) external pure returns (uint256);
    function getBtcPrice() external view returns (uint256);
}
```

### Backend Services

#### NexusIntentService
Manages cross-chain intents using Avail Nexus SDK.

```typescript
import { NexusIntentService } from './services/NexusIntentService';

const nexusService = new NexusIntentService(
  provider,
  signer,
  depositManagerAddress,
  chainContracts,
  { network: 'testnet' }
);

await nexusService.initializeNexus();
const intentId = await nexusService.createIntent(
  chainId,
  depositId,
  user,
  amount,
  btcEquivalent
);
```

#### PythOracleService
Integrates Pyth Network for real-time price feeds.

```typescript
import { PythOracleService } from './services/PythOracleService';

const pythService = new PythOracleService(
  hermesUrl,
  btcUsdFeedId,
  priceOracleAddress,
  provider,
  signer
);

const btcPrice = await pythService.fetchBtcPrice();
await pythService.updatePriceFeeds();
```

#### BlockscoutMonitorService
Monitors blockchain events and provides transparency.

```typescript
import { BlockscoutMonitorService } from './services/BlockscoutMonitorService';

const monitorService = new BlockscoutMonitorService(
  apiUrl,
  rpcUrl,
  autoscoutUrl
);

monitorService.addContract(chainId, contractAddress, contractName);
const events = await monitorService.indexEvents(chainId, contractAddress);
```

## API Reference

### CLI Commands

```bash
# Deployment
npm run deploy                    # Deploy all contracts
npm run deploy:production         # Deploy to production networks

# Monitoring
npm run monitor                   # Real-time monitoring
npm run setup-autoscout          # Set up Blockscout explorer
npm run fetch-prices             # Query current prices

# Testing
npm run test                      # Run all tests
npm run test:integration         # Run integration tests
npm run test:e2e                 # Run end-to-end tests

# Utilities
npm run activate                  # Manual token activation
npm run export-records           # Export transaction records
npm run verify-testnet           # Verify testnet deployments
```

### Service APIs

#### NexusIntentService

```typescript
class NexusIntentService {
  // Initialize the service
  async initializeNexus(): Promise<void>
  
  // Create cross-chain intent
  async createIntent(
    chainId: number,
    depositId: number,
    user: string,
    amount: string,
    btcEquivalent: string
  ): Promise<string>
  
  // Get intent status
  getIntentStatus(intentId: string): any
  
  // Get all intents
  getAllIntents(): any[]
}
```

#### PythOracleService

```typescript
class PythOracleService {
  // Fetch BTC price from Hermes
  async fetchBtcPrice(): Promise<number>
  
  // Update price feeds on-chain
  async updatePriceFeeds(): Promise<string>
  
  // Get current BTC price
  async getCurrentBtcPrice(): Promise<number>
  
  // Start periodic updates
  startPeriodicUpdates(intervalMs: number): void
}
```

#### BlockscoutMonitorService

```typescript
class BlockscoutMonitorService {
  // Add contract to monitoring
  addContract(chainId: number, address: string, name: string): void
  
  // Index events for contract
  async indexEvents(chainId: number, address: string): Promise<number>
  
  // Export events
  exportEvents(chainId: number, address: string): any[]
  
  // Clear events
  clearEvents(chainId: number, address: string): void
}
```

## Configuration

### Chain Configuration

```json
// config/chains.json
{
  "networks": {
    "ethereum": {
      "name": "Ethereum",
      "chainId": 1,
      "rpcUrl": "https://sepolia.infura.io/v3/YOUR_KEY",
      "explorer": "https://sepolia.etherscan.io",
      "supported": true,
      "testnet": true
    }
  }
}
```

### Contract Configuration

```json
// config/contracts.json
{
  "PriceOracle": {
    "address": "0x...",
    "abi": "PriceOracle.json"
  },
  "DepositManager": {
    "address": "0x...",
    "abi": "DepositManager.json"
  }
}
```

### Pyth Configuration

```json
// config/pyth.json
{
  "hermesUrl": "https://hermes.pyth.network",
  "btcUsdFeedId": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "updateInterval": 30000
}
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:integration
npm run test:mock
npm run test:e2e
```

### Integration Testing

```typescript
// Example integration test
describe('Cross-Chain Activation Flow', () => {
  it('should process deposit and activate token', async () => {
    // 1. Create deposit on source chain
    const depositTx = await chainContract.deposit(token, amount);
    await depositTx.wait();
    
    // 2. Create cross-chain intent
    const intentId = await nexusService.createIntent(
      chainId,
      depositId,
      user,
      amount,
      btcEquivalent
    );
    
    // 3. Verify intent processing
    const intent = nexusService.getIntentStatus(intentId);
    expect(intent.status).to.equal('processing');
    
    // 4. Wait for settlement
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 5. Verify completion
    const finalIntent = nexusService.getIntentStatus(intentId);
    expect(finalIntent.status).to.equal('completed');
  });
});
```

## Deployment

### Local Development

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts
npm run deploy

# Start monitoring
npm run setup-autoscout start
```

### Testnet Deployment

```bash
# Deploy to testnet
HARDHAT_NETWORK=sepolia npm run deploy

# Verify deployment
npm run verify-testnet
```

### Production Deployment

```bash
# Deploy to production
npm run deploy:production

# Health check
npm run health:check
```

## Monitoring and Analytics

### Real-time Monitoring

```bash
# Start monitoring dashboard
npm run dashboard

# Monitor specific contracts
npm run monitor -- --contracts PriceOracle,DepositManager
```

### AI Analytics

```typescript
// Use MCP application for AI analysis
const mcpApp = new MCPApplication(mcpService);

const result = await mcpApp.processQuery(
  'Analyze the activation sequence for anomalies'
);

console.log(result.response);
console.log(result.recommendations);
```

## Security Considerations

1. **Access Control**: All contracts implement proper access control
2. **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
3. **Price Oracle Security**: Multiple price feed validation
4. **Cross-chain Security**: Intent verification and settlement checks
5. **Monitoring**: Real-time anomaly detection

## Troubleshooting

### Common Issues

1. **Nexus SDK Initialization Failed**
   ```bash
   # Check environment variables
   echo $AVAIL_RPC_URL
   echo $AVAIL_WS_URL
   
   # Verify network connectivity
   curl -X POST $AVAIL_RPC_URL -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
   ```

2. **Pyth Price Feed Issues**
   ```bash
   # Check Hermes API
   curl $PYTH_HERMES_URL/v2/updates/price/latest?ids[]=$PYTH_BTC_USD_FEED_ID
   
   # Verify feed ID
   npm run fetch-prices
   ```

3. **Blockscout Connection Issues**
   ```bash
   # Test MCP server
   curl $BLOCKSCOUT_MCP_SERVER_URL/health
   
   # Check API key
   npm run get-api-keys
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=xmbl:* npm run monitor

# Verbose output
npm run test -- --verbose
```

## Support

- **Documentation**: [API.md](./API.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/xmbl-tokens/issues)
- **Discord**: [XMBL Community](https://discord.gg/xmbl)
- **Email**: support@xmbl.tokens

## License

MIT License - see [LICENSE](./LICENSE) for details.