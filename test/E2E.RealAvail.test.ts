import { ethers } from 'hardhat';
import { expect } from 'chai';
import { NexusIntentService } from '../services/NexusIntentService';

describe('E2E Avail Integration', function () {
  let nexusService: NexusIntentService;
  let signer: any;
  let provider: any;

  before(async function () {
    [signer] = await ethers.getSigners();
    provider = signer.provider;
    
    // Set environment variables for testing
    process.env.AVAIL_RPC_URL = 'https://nexus-rpc.avail.tools';
  });

  beforeEach(async function () {
    // Initialize with real Avail configuration
    nexusService = new NexusIntentService(
      provider,
      signer,
      '0x0000000000000000000000000000000000000000', // Mock deposit manager
      new Map([[1, '0x0000000000000000000000000000000000000000']]), // Mock chain contract
      { network: 'testnet' }
    );
  });

  it('Should initialize with Avail Nexus SDK', async function () {
    await expect(nexusService.initializeNexus()).to.not.be.rejected;
  });

  it('Should create Avail intent', async function () {
    await nexusService.initializeNexus();
    
    const intentId = await nexusService.createIntent(
      1, // chainId
      1, // depositId
      '0x1234567890123456789012345678901234567890', // user
      '1000000000000000000', // amount (1 ETH)
      '5000000000' // btcEquivalent
    );
    
    expect(intentId).to.be.a('string');
    expect(intentId).to.include('intent_');
  });

  it('Should handle Avail network errors gracefully', async function () {
    // Test with invalid RPC URL
    const invalidService = new NexusIntentService(
      provider,
      '0x0000000000000000000000000000000000000000',
      new Map([[1, '0x0000000000000000000000000000000000000000']])
    );
    
    // This should fail with real Avail SDK
    await expect(invalidService.initializeNexus()).to.be.rejected;
  });

  it('Should track intent status in queue', async function () {
    await nexusService.initializeNexus();
    
    const intentId = await nexusService.createIntent(1, 1, '0x1234567890123456789012345678901234567890', '1000000000000000000', '5000000000');
    
    const status = nexusService.getIntentStatus(intentId);
    expect(status).to.not.be.undefined;
    expect(status.status).to.be.oneOf(['pending', 'processing', 'completed', 'failed']);
  });

  it('Should provide queue status', async function () {
    await nexusService.initializeNexus();
    
    const queueStatus = nexusService.getQueueStatus();
    expect(queueStatus).to.have.property('total');
    expect(queueStatus).to.have.property('pending');
    expect(queueStatus).to.have.property('processing');
    expect(queueStatus).to.have.property('completed');
    expect(queueStatus).to.have.property('failed');
  });
});
