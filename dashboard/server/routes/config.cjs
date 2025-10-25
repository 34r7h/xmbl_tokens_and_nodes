const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();
const CONFIG_FILE = path.join(process.cwd(), 'config', 'dashboard-state.json');

// Get current configuration
router.get('/', async (req, res) => {
  try {
    let config = {};
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf8');
      config = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return default config
      config = {
        avail: {
          rpcUrl: process.env.AVAIL_RPC_URL || '',
          chainId: process.env.AVAIL_CHAIN_ID || '2024',
          apiKey: process.env.AVAIL_API_KEY || ''
        },
        pyth: {
          hermesUrl: process.env.PYTH_HERMES_URL || '',
          btcUsdFeedId: process.env.PYTH_BTC_USD_FEED_ID || ''
        },
        blockscout: {
          mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3001',
          apiKey: process.env.BLOCKSCOUT_API_KEY || ''
        }
      };
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update configuration
router.put('/', async (req, res) => {
  try {
    const config = req.body;
    
    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });
    
    // Save configuration
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get environment variables status
router.get('/env', async (req, res) => {
  try {
    const envStatus = {
      AVAIL_RPC_URL: !!process.env.AVAIL_RPC_URL,
      AVAIL_CHAIN_ID: !!process.env.AVAIL_CHAIN_ID,
      AVAIL_API_KEY: !!process.env.AVAIL_API_KEY,
      PYTH_HERMES_URL: !!process.env.PYTH_HERMES_URL,
      PYTH_BTC_USD_FEED_ID: !!process.env.PYTH_BTC_USD_FEED_ID,
      BLOCKSCOUT_MCP_SERVER_URL: !!process.env.BLOCKSCOUT_MCP_SERVER_URL,
      BLOCKSCOUT_API_KEY: !!process.env.BLOCKSCOUT_API_KEY
    };

    res.json(envStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { configRouter: router };
