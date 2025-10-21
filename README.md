# XMBL Token Activation Platform

A comprehensive end-to-end cross-chain token activation platform integrating Avail Nexus, Pyth Network, and Blockscout for transparent, AI-powered DeFi activations.

## 🚀 Overview

XMBL is an innovative token activation platform that implements unique token economics using the golden ratio formula, cross-chain orchestration via Avail Nexus, real-time price feeds from Pyth Network, and AI-powered auditing through Blockscout's Model Context Protocol.

### Key Features

- **🔄 Cross-Chain Orchestration**: Multi-chain support with Avail Nexus integration
- **💰 Golden Ratio Economics**: Unique token pricing using `x / (Phi * y)` formula
- **📊 Real-Time Price Feeds**: Pyth Network integration for BTC price feeds
- **🤖 AI-Powered Auditing**: Blockscout MCP for conversational blockchain analytics
- **🔒 Sequential Processing**: Prevents MEV attacks and ensures fair activation
- **📈 Transparency**: Full monitoring and audit capabilities

## 🏗️ Architecture

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

## 🛠️ Technology Stack

- **Smart Contracts**: Solidity 0.8.x, OpenZeppelin, Pyth SDK
- **Backend**: TypeScript, Node.js, Ethers.js v6
- **Testing**: Hardhat, Chai, Mocha
- **Partner APIs**: Avail Nexus, Pyth Hermes, Blockscout MCP

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Hardhat
- Git

## 🚀 Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd xmbl_tokens
npm install
```

### 2. Configuration

Copy the environment template:
```bash
cp env.example .env
```

Update `.env` with your configuration:
```bash
# Private key for deployment
PRIVATE_KEY=your_private_key_here

# RPC URLs for testnets
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_KEY

# Pyth Network Configuration
PYTH_HERMES_URL=https://hermes.pyth.network
PYTH_BTC_USD_FEED_ID=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43

# Blockscout Configuration
BLOCKSCOUT_API_URL=https://eth-sepolia.blockscout.com/api
BLOCKSCOUT_MCP_SERVER_URL=http://localhost:3000

# Avail Nexus Configuration
AVAIL_NEXUS_NETWORK=testnet
AVAIL_NEXUS_RPC_URL=https://nexus-rpc.avail.tools
```

### 3. Compile Contracts

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

### 5. Deploy Contracts

```bash
npm run deploy
```

## 📖 Usage

### Smart Contracts

#### PriceOracle
Implements XMBL token economics with golden ratio pricing:
```solidity
// Price calculation: x / (Phi * y)
function calculatePrice(uint256 _tokensMinted) public pure returns (uint256)
function activateToken() external
function calculateNetworkFee(uint256 amount) public pure returns (uint256)
```

#### DepositManager
Central contract for cross-chain deposit management:
```solidity
function receiveDeposit(address _user, uint256 _amount, uint256 _btcEquivalent) external returns (uint256)
function processNextActivation() external onlyOwner
function getActivationQueueLength() external view returns (uint256)
```

#### ChainDepositContract
Deployed on each chain for user deposits:
```solidity
function deposit(address token, uint256 amount) external payable
function createIntent(uint256 depositId) external onlyOwner returns (uint256)
function calculateBtcEquivalent(address token, uint256 amount) public returns (uint256)
```

### Backend Services

#### NexusIntentService
Manages cross-chain intents with sequential processing:
```typescript
const nexusService = new NexusIntentService(provider, depositManagerAddress, chainContracts);
await nexusService.initializeNexus();
const intentId = await nexusService.createIntent(chainId, depositId, user, amount, btcEquivalent);
```

#### PythOracleService
Fetches real-time BTC price feeds:
```typescript
const pythOracle = new PythOracleService(provider, priceOracleAddress, hermesUrl, btcUsdPriceId);
const btcPrice = await pythOracle.fetchBtcPrice();
await pythOracle.updatePriceFeeds();
```

#### BlockscoutMonitorService
Provides transparency and monitoring:
```typescript
const blockscoutMonitor = new BlockscoutMonitorService(provider);
blockscoutMonitor.addContract(chainId, contractAddress, abi);
const events = await blockscoutMonitor.indexEvents(chainId, contractAddress);
```

#### BlockscoutMCPService
AI-powered blockchain analytics:
```typescript
const mcpService = new BlockscoutMCPService({ apiKey, mcpServerUrl });
const analysis = await mcpService.analyzeActivationSequence(chainId, contractAddress, timeRange);
```

## 🛠️ CLI Tools

### Deployment
```bash
npm run deploy                    # Deploy all contracts
```

### Token Activation
```bash
npm run activate <user> <amount> <token> <chain_id>
```

### Monitoring
```bash
npm run monitor start             # Start full monitoring
npm run monitor events           # Monitor blockchain events
npm run monitor prices           # Monitor price feeds
npm run monitor status           # Show current status
```

### Price Management
```bash
npm run fetch-prices current     # Get current prices
npm run fetch-prices history     # Get price history
npm run fetch-prices update      # Update on-chain prices
```

### Verification & Auditing
```bash
npm run verify-sequence verify   # Verify activation sequences
npm run verify-sequence audit    # AI-powered audit
npm run verify-sequence analyze  # Analyze patterns
```

### Data Export
```bash
npm run export-records json      # Export as JSON
npm run export-records csv       # Export as CSV
```

### Autoscout Setup
```bash
npm run setup-autoscout setup    # Initial setup
npm run setup-autoscout test     # Test functionality
npm run setup-autoscout start    # Start services
```

### Testing
```bash
npm run test-flow full 5         # Full end-to-end test
npm run test-flow intent 3       # Test intent processing
npm run test-flow price          # Test price feeds
npm run test-flow monitor        # Test monitoring
npm run test-flow ai             # Test AI capabilities
```

## 🧪 Testing

### Unit Tests
```bash
npm test                         # Run all tests
npx hardhat test test/PriceOracle.test.ts
npx hardhat test test/NexusIntentService.test.ts
npx hardhat test test/PythOracleService.test.ts
npx hardhat test test/BlockscoutIntegration.test.ts
```

### Integration Tests
```bash
npm run test-flow full 5         # Complete workflow test
```

### Test Coverage
- ✅ Smart contract functionality
- ✅ Cross-chain intent processing
- ✅ Price feed integration
- ✅ Monitoring and transparency
- ✅ AI auditing capabilities

## 🌐 Supported Networks

- **Ethereum Sepolia** (Chain ID: 1)
- **Polygon Mumbai** (Chain ID: 137)
- **BSC Testnet** (Chain ID: 97)
- **Arbitrum Sepolia** (Chain ID: 421614)
- **Optimism Sepolia** (Chain ID: 11155420)

## 📊 Token Economics

### Golden Ratio Formula
```
Price = x / (Phi * y)
Where:
- x = 1 (constant)
- Phi = 1.618 (Golden Ratio)
- y = Tokens Minted
```

### Key Features
- **Starting Price**: 1 satoshi
- **Price Increases**: On token activation
- **Price Decreases**: On token deactivation
- **Network Fee**: 3% (rounded up to nearest satoshi)
- **Unlimited Supply**: Non-fungible tokens

## 🔒 Security Features

### Smart Contract Security
- **Access Controls**: Owner-only functions
- **Reentrancy Protection**: ReentrancyGuard implementation
- **Price Manipulation Prevention**: Sequential processing
- **Settlement Verification**: All activations verified

### Backend Security
- **API Key Management**: Secure storage
- **Rate Limiting**: Prevent abuse
- **Input Validation**: All inputs validated
- **Error Handling**: Secure error messages

### Monitoring Security
- **Audit Logging**: All operations logged
- **Anomaly Detection**: AI-powered analysis
- **Transparency**: Public monitoring dashboard
- **Alert System**: Real-time security alerts

## 📈 Performance

### Smart Contract Optimization
- **Gas Efficient**: Optimized contract code
- **Batch Operations**: Multiple activations
- **Storage Optimization**: Efficient data structures

### Backend Optimization
- **Caching**: Price feed caching
- **Async Processing**: Non-blocking operations
- **Queue Management**: Efficient intent processing

## 📚 Documentation

- **[Integration Guide](INTEGRATION.md)**: Comprehensive integration documentation
- **[API Documentation](API.md)**: Complete API reference
- **[Avail Feedback](AVAIL_FEEDBACK.md)**: Avail Nexus integration feedback

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive guides available
- **Community**: Discord and Telegram support

## 🔮 Roadmap

- [ ] Mainnet deployment
- [ ] Additional chain support
- [ ] Enhanced AI capabilities
- [ ] Mobile application
- [ ] Governance features

---

**Built with ❤️ for the decentralized future**
