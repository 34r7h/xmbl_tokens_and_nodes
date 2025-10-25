const express = require('express');
const { checkAvailIntegration } = require('../verifiers/avail-verifier.cjs');
const { checkPythIntegration } = require('../verifiers/pyth-verifier.cjs');
const { checkBlockscoutIntegration } = require('../verifiers/blockscout-verifier.cjs');

const router = express.Router();

// Get all features status
router.get('/', async (req, res) => {
  try {
    const features = [
      {
        id: 'avail-nexus',
        name: 'Avail Nexus Integration',
        category: 'integrations',
        status: 'unknown',
        testnetReady: false,
        blockers: [],
        lastVerified: new Date()
      },
      {
        id: 'pyth-oracle',
        name: 'Pyth Oracle Integration',
        category: 'integrations',
        status: 'unknown',
        testnetReady: false,
        blockers: [],
        lastVerified: new Date()
      },
      {
        id: 'blockscout-mcp',
        name: 'Blockscout MCP Integration',
        category: 'integrations',
        status: 'unknown',
        testnetReady: false,
        blockers: [],
        lastVerified: new Date()
      },
      {
        id: 'smart-contracts',
        name: 'Smart Contracts',
        category: 'contracts',
        status: 'implemented',
        testnetReady: true,
        blockers: [],
        lastVerified: new Date()
      },
      {
        id: 'tokenomics',
        name: 'Tokenomics Service',
        category: 'services',
        status: 'implemented',
        testnetReady: true,
        blockers: [],
        lastVerified: new Date()
      }
    ];

    // Check each integration
    for (const feature of features) {
      try {
        switch (feature.id) {
          case 'avail-nexus':
            const availResult = await checkAvailIntegration();
            feature.status = availResult.status;
            feature.testnetReady = availResult.testnetReady;
            feature.blockers = availResult.blockers;
            break;
          case 'pyth-oracle':
            const pythResult = await checkPythIntegration();
            feature.status = pythResult.status;
            feature.testnetReady = pythResult.testnetReady;
            feature.blockers = pythResult.blockers;
            break;
          case 'blockscout-mcp':
            const blockscoutResult = await checkBlockscoutIntegration();
            feature.status = blockscoutResult.status;
            feature.testnetReady = blockscoutResult.testnetReady;
            feature.blockers = blockscoutResult.blockers;
            break;
        }
      } catch (error) {
        feature.status = 'error';
        feature.blockers = [error.message];
      }
    }

    res.json(features);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific feature status
router.get('/:featureId', async (req, res) => {
  try {
    const { featureId } = req.params;
    let result;

    switch (featureId) {
      case 'avail-nexus':
        result = await checkAvailIntegration();
        break;
      case 'pyth-oracle':
        result = await checkPythIntegration();
        break;
      case 'blockscout-mcp':
        result = await checkBlockscoutIntegration();
        break;
      default:
        return res.status(404).json({ error: 'Feature not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { featuresRouter: router };
