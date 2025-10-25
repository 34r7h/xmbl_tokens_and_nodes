# XMBL API Documentation

## Overview

The XMBL E2E Cross-Chain Token Activation Platform provides a comprehensive API for cross-chain token activation, real-time price feeds, and blockchain monitoring. This document covers all available APIs and their usage.

## Base URLs

- **Local Development**: `http://localhost:3000`
- **Testnet**: `https://api-testnet.xmbl.tokens`
- **Production**: `https://api.xmbl.tokens`

## Authentication

All API requests require authentication using API keys:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.xmbl.tokens/v1/...
```

## Core Services API

### 1. Nexus Intent Service

Manages cross-chain intents using Avail Nexus SDK.

#### Create Intent

```http
POST /v1/intents
Content-Type: application/json

{
  "chainId": 1,
  "depositId": 123,
  "user": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "amount": "1000000000000000000",
  "btcEquivalent": "0.001"
}
```

**Response:**
```json
{
  "intentId": "intent_1_123_1640995200000",
  "availIntentId": "avail_intent_abc123",
  "status": "pending",
  "timestamp": 1640995200000,
  "estimatedSettlement": 1640995800000
}
```

#### Get Intent Status

```http
GET /v1/intents/{intentId}
```

**Response:**
```json
{
  "intentId": "intent_1_123_1640995200000",
  "status": "completed",
  "progress": {
    "currentStep": "settlement",
    "totalSteps": 3,
    "completedSteps": 2
  },
  "transactions": [
    {
      "step": "bridge",
      "hash": "0x...",
      "explorerUrl": "https://etherscan.io/tx/0x..."
    }
  ]
}
```

#### List Intents

```http
GET /v1/intents?status=pending&limit=10&offset=0
```

**Response:**
```json
{
  "intents": [...],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### 2. Pyth Oracle Service

Provides real-time price feeds and on-chain updates.

#### Get BTC Price

```http
GET /v1/prices/btc
```

**Response:**
```json
{
  "price": 50000.25,
  "timestamp": 1640995200000,
  "confidence": 0.95,
  "exponent": -8,
  "feedId": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
}
```

#### Update Price Feeds

```http
POST /v1/prices/update
Content-Type: application/json

{
  "feedIds": ["0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"]
}
```

**Response:**
```json
{
  "transactionHash": "0x...",
  "gasUsed": "150000",
  "status": "success"
}
```

#### Get Price History

```http
GET /v1/prices/btc/history?from=1640995200000&to=1640995800000&interval=1h
```

**Response:**
```json
{
  "prices": [
    {
      "timestamp": 1640995200000,
      "price": 50000.25,
      "confidence": 0.95
    }
  ],
  "interval": "1h",
  "count": 1
}
```

### 3. Blockscout Monitor Service

Monitors blockchain events and provides transparency.

#### Add Contract to Monitoring

```http
POST /v1/monitoring/contracts
Content-Type: application/json

{
  "chainId": 1,
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "name": "PriceOracle",
  "events": ["PriceUpdated", "ActivationProcessed"]
}
```

**Response:**
```json
{
  "contractId": "contract_1_0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "status": "monitoring",
  "eventsIndexed": 0
}
```

#### Get Contract Events

```http
GET /v1/monitoring/contracts/{contractId}/events?from=1640995200000&to=1640995800000
```

**Response:**
```json
{
  "events": [
    {
      "transactionHash": "0x...",
      "blockNumber": 12345678,
      "eventName": "PriceUpdated",
      "data": {
        "newPrice": "1000000000",
        "tokensMinted": "5"
      },
      "timestamp": 1640995200000
    }
  ],
  "total": 1,
  "hasMore": false
}
```

#### Export Events

```http
GET /v1/monitoring/contracts/{contractId}/export?format=csv&from=1640995200000
```

**Response:**
```csv
transactionHash,blockNumber,eventName,data,timestamp
0x...,12345678,PriceUpdated,"{""newPrice"":""1000000000"",""tokensMinted"":""5""}",1640995200000
```

### 4. MCP Application Service

AI-powered blockchain analytics and auditing.

#### Process Query

```http
POST /v1/ai/query
Content-Type: application/json

{
  "query": "Analyze the activation sequence for anomalies",
  "context": {
    "chainId": 1,
    "timeRange": "24h",
    "contractAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
  }
}
```

**Response:**
```json
{
  "response": "Based on the analysis of the activation sequence, I found 3 potential anomalies...",
  "analysis": {
    "anomalies": [
      {
        "type": "unusual_price_spike",
        "severity": "medium",
        "description": "Price increased by 150% in 1 hour",
        "timestamp": 1640995200000
      }
    ],
    "recommendations": [
      "Monitor price volatility more closely",
      "Implement additional price validation"
    ]
  },
  "confidence": 0.87
}
```

#### Get Conversation History

```http
GET /v1/ai/conversations?limit=10&offset=0
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "query": "Analyze the activation sequence for anomalies",
      "response": "Based on the analysis...",
      "timestamp": 1640995200000,
      "confidence": 0.87
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### 5. Tokenomics Service

Manages XMBL token economics and pricing.

#### Get Tokenomics State

```http
GET /v1/tokenomics/state
```

**Response:**
```json
{
  "proofOfFaith": "1000000000",
  "xymMinted": 5,
  "xymNextPrice": "1000000000",
  "xymPrevPrice": "500000000",
  "xyDivisor": 111111111,
  "xyReleased": 0,
  "xyRemaining": 999999999,
  "xyReleaseTarget": "369000",
  "xyNextAmount": 9
}
```

#### Activate Token

```http
POST /v1/tokenomics/activate
Content-Type: application/json

{
  "user": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "amount": "1000000000"
}
```

**Response:**
```json
{
  "transactionHash": "0x...",
  "newPrice": "1000000000",
  "tokensMinted": 6,
  "proofOfFaith": "2000000000"
}
```

#### Get Coin Distribution Status

```http
GET /v1/tokenomics/coin-distribution
```

**Response:**
```json
{
  "canReleaseCoins": true,
  "nextReleaseAmount": 9,
  "releaseTarget": "369000",
  "totalReleased": 0,
  "remaining": 999999999
}
```

## WebSocket API

### Real-time Updates

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('wss://api.xmbl.tokens/v1/ws');

// Subscribe to intent updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'intents',
  filters: { status: 'processing' }
}));

// Subscribe to price updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices',
  filters: { feed: 'btc' }
}));

// Listen for updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

### WebSocket Events

#### Intent Updates
```json
{
  "type": "intent_update",
  "intentId": "intent_1_123_1640995200000",
  "status": "completed",
  "progress": {
    "currentStep": "settlement",
    "totalSteps": 3,
    "completedSteps": 3
  }
}
```

#### Price Updates
```json
{
  "type": "price_update",
  "feed": "btc",
  "price": 50000.25,
  "timestamp": 1640995200000,
  "confidence": 0.95
}
```

#### Event Updates
```json
{
  "type": "event_update",
  "contractId": "contract_1_0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "event": {
    "transactionHash": "0x...",
    "eventName": "PriceUpdated",
    "data": {...}
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "chainId",
      "reason": "Must be a positive integer"
    },
    "timestamp": 1640995200000,
    "requestId": "req_123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

- **Free Tier**: 100 requests/minute
- **Pro Tier**: 1000 requests/minute
- **Enterprise**: Custom limits

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995800
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @xmbl/sdk
```

```typescript
import { XMBLClient } from '@xmbl/sdk';

const client = new XMBLClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.xmbl.tokens'
});

// Create intent
const intent = await client.intents.create({
  chainId: 1,
  depositId: 123,
  user: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  amount: '1000000000000000000',
  btcEquivalent: '0.001'
});

// Get BTC price
const price = await client.prices.getBtcPrice();

// Monitor events
client.monitoring.on('event', (event) => {
  console.log('New event:', event);
});
```

### Python

```bash
pip install xmbl-sdk
```

```python
from xmbl import XMBLClient

client = XMBLClient(api_key='your-api-key')

# Create intent
intent = client.intents.create(
    chain_id=1,
    deposit_id=123,
    user='0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    amount='1000000000000000000',
    btc_equivalent='0.001'
)

# Get BTC price
price = client.prices.get_btc_price()

# Monitor events
@client.monitoring.on_event
def handle_event(event):
    print(f'New event: {event}')
```

## Examples

### Complete Activation Flow

```typescript
import { XMBLClient } from '@xmbl/sdk';

const client = new XMBLClient({
  apiKey: process.env.XMBL_API_KEY,
  baseUrl: 'https://api.xmbl.tokens'
});

async function activateToken() {
  try {
    // 1. Get current BTC price
    const btcPrice = await client.prices.getBtcPrice();
    console.log('BTC Price:', btcPrice.price);
    
    // 2. Calculate BTC equivalent
    const ethAmount = '1000000000000000000'; // 1 ETH
    const btcEquivalent = (parseFloat(ethAmount) / 1e18) / btcPrice.price;
    
    // 3. Create cross-chain intent
    const intent = await client.intents.create({
      chainId: 1,
      depositId: Date.now(),
      user: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      amount: ethAmount,
      btcEquivalent: btcEquivalent.toString()
    });
    
    console.log('Intent created:', intent.intentId);
    
    // 4. Monitor progress
    const checkStatus = async () => {
      const status = await client.intents.getStatus(intent.intentId);
      console.log('Status:', status.status);
      
      if (status.status === 'completed') {
        console.log('Token activated successfully!');
        return;
      }
      
      if (status.status === 'failed') {
        console.error('Activation failed');
        return;
      }
      
      // Check again in 5 seconds
      setTimeout(checkStatus, 5000);
    };
    
    checkStatus();
    
  } catch (error) {
    console.error('Activation failed:', error);
  }
}

activateToken();
```

### Real-time Monitoring

```typescript
import { XMBLClient } from '@xmbl/sdk';

const client = new XMBLClient({
  apiKey: process.env.XMBL_API_KEY,
  baseUrl: 'https://api.xmbl.tokens'
});

// Monitor all intents
client.intents.on('update', (intent) => {
  console.log(`Intent ${intent.intentId} status: ${intent.status}`);
});

// Monitor price changes
client.prices.on('update', (price) => {
  console.log(`BTC price: $${price.price}`);
});

// Monitor contract events
client.monitoring.on('event', (event) => {
  console.log(`New event: ${event.eventName}`, event.data);
});

// Start monitoring
client.start();
```

## Support

- **Documentation**: [Integration Guide](./INTEGRATION.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/xmbl-tokens/issues)
- **Discord**: [XMBL Community](https://discord.gg/xmbl)
- **Email**: api-support@xmbl.tokens