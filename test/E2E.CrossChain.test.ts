import { ethers } from 'hardhat';
import { expect } from 'chai';
import { NexusIntentService } from '../services/NexusIntentService';
import { PythOracleService } from '../services/PythOracleService';
import { BlockscoutMCPService } from '../services/BlockscoutMCPService';

describe('E2E Cross-Chain Integration', function () {
  let nexusService: NexusIntentService;
  let pythService: PythOracleService;
  let mcpService: BlockscoutMCPService;
  let signer: any;
  let provider: any;

  before(async function () {
    [signer] = await ethers.getSigners();
    provider = signer.provider;
    
    // Set environment variables for testing
    process.env.AVAIL_RPC_URL = 'https://nexus-rpc.avail.tools';
    process.env.PYTH_HERMES_URL = 'https://hermes.pyth.network';
  });

  beforeEach(async function () {
    // Initialize all services with actual configurations
    nexusService = new NexusIntentService(
      provider,
      signer,
      '0x0000000000000000000000000000000000000000',
      new Map([[1, '0x0000000000000000000000000000000000000000']]),
      { network: 'testnet' }
    );

    pythService = new PythOracleService(
      process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
      process.env.PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      '0x0000000000000000000000000000000000000000',
      provider,
      signer
    );

    mcpService = new BlockscoutMCPService({
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3001',
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key'
    });
  });

  it('Should perform complete cross-chain deposit flow', async function () {
    // Step 1: Initialize services
    await nexusService.initializeNexus();
    
    // Step 2: Get real BTC price
    const btcPrice = await pythService.fetchBtcPrice();
    expect(btcPrice).to.be.greaterThan(0);
    
    // Step 3: Create cross-chain intent
    const intentId = await nexusService.createIntent(
      1, // source chain
      1, // deposit ID
      '0x1234567890123456789012345678901234567890', // user
      '1000000000000000000', // 1 ETH
      (btcPrice * 0.00002).toString() // BTC equivalent
    );
    
    expect(intentId).to.be.a('string');
    
    // Step 4: Check intent status
    const status = nexusService.getIntentStatus(intentId);
    expect(status).to.not.be.undefined;
    
    // Step 5: Verify queue processing
    const queueStatus = nexusService.getQueueStatus();
    expect(queueStatus.total).to.be.greaterThan(0);
  });

  it('Should handle MCP analysis', async function () {
    try {
      const analysis = await mcpService.analyzeActivationSequence(
        1, // chainId
        '0x1234567890123456789012345678901234567890', // contract address
        '24h' // time range
      );
      
      expect(analysis).to.have.property('anomalies');
      expect(analysis).to.have.property('summary');
      expect(analysis).to.have.property('recommendations');
    } catch (error) {
      // Expected if MCP server is not running
      expect(error.message).to.include('MCP');
    }
  });

  it('Should handle service failures gracefully', async function () {
    // Test with invalid configurations
    const invalidNexus = new NexusIntentService(
      provider,
      '0x0000000000000000000000000000000000000000',
      new Map([[1, '0x0000000000000000000000000000000000000000']])
    );
    
    const invalidPyth = new PythOracleService(
      'https://invalid-url.com',
      'invalid-feed',
      '0x0000000000000000000000000000000000000000',
      provider,
      signer
    );
    
    // These should fail gracefully
    await expect(invalidNexus.initializeNexus()).to.be.rejected;
    await expect(invalidPyth.fetchBtcPrice()).to.be.rejected;
  });

  it('Should provide comprehensive status', async function () {
    // Test all service status methods
    const nexusStatus = nexusService.getQueueStatus();
    const pythStatus = pythService.getServiceStatus();
    const mcpStatus = mcpService.getServiceStatus();
    
    expect(nexusStatus).to.have.property('total');
    expect(pythStatus).to.have.property('isConnected');
    expect(mcpStatus).to.have.property('isConnected');
  });
});
