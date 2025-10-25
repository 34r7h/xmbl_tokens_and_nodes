const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Blockscout MCP Server'
  });
});

// MCP endpoints
app.get('/api/chains', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Ethereum',
      rpcUrl: 'https://eth.llamarpc.com',
      explorerUrl: 'https://etherscan.io',
      status: 'active'
    },
    {
      id: 137,
      name: 'Polygon',
      rpcUrl: 'https://polygon.llamarpc.com',
      explorerUrl: 'https://polygonscan.com',
      status: 'active'
    }
  ]);
});

app.get('/api/address/:address', (req, res) => {
  const { address } = req.params;
  res.json({
    address,
    balance: '0.0',
    transactions: 0,
    status: 'active'
  });
});

app.get('/api/token/:address', (req, res) => {
  const { address } = req.params;
  res.json({
    address,
    name: 'XMBL Token',
    symbol: 'XMBL',
    decimals: 18,
    totalSupply: '1000000000000000000000000'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Blockscout MCP Server running on port ${PORT}`);
});

module.exports = app;
