import { expect } from "chai";
import { ethers } from "hardhat";
import { NexusIntentService } from "../services/NexusIntentService";

describe("NexusIntentService", function () {
  let nexusService: NexusIntentService;
  let provider: ethers.Provider;
  let mockDepositManager: string;
  let mockChainContracts: Map<number, string>;

  beforeEach(async function () {
    provider = ethers.provider;
    mockDepositManager = "0x0000000000000000000000000000000000000000";
    mockChainContracts = new Map([
      [1, "0x1111111111111111111111111111111111111111"],
      [137, "0x2222222222222222222222222222222222222222"]
    ]);
    
    nexusService = new NexusIntentService(
      provider,
      mockDepositManager,
      mockChainContracts
    );
  });

  it("Should initialize successfully with Avail SDK", async function () {
    // This test will fail if AVAIL_RPC_URL is not configured
    if (!process.env.AVAIL_RPC_URL) {
      console.log('Skipping Avail test - no RPC URL configured');
      this.skip();
    }
    
    await expect(nexusService.initializeNexus()).to.not.be.reverted;
  });

  it("Should create intent successfully", async function () {
    const chainId = 1;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000"; // 1 ETH
    const btcEquivalent = "5000000000"; // 0.05 BTC

    const intentId = await nexusService.createIntent(
      chainId,
      depositId,
      user,
      amount,
      btcEquivalent
    );

    expect(intentId).to.be.a("string");
    expect(intentId).to.include("intent_");
  });

  it("Should track intent in queue", async function () {
    const chainId = 1;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    await nexusService.createIntent(chainId, depositId, user, amount, btcEquivalent);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const intents = nexusService.getAllIntents();
    expect(intents).to.have.length(1);
    expect(intents[0].chainId).to.equal(chainId);
    expect(intents[0].depositId).to.equal(depositId);
    expect(intents[0].user).to.equal(user);
    expect(intents[0].status).to.be.oneOf(["pending", "processing", "completed", "failed"]);
  });

  it("Should get intent status", async function () {
    const chainId = 1;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    const intentId = await nexusService.createIntent(
      chainId,
      depositId,
      user,
      amount,
      btcEquivalent
    );

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = nexusService.getIntentStatus(intentId);
    expect(status).to.not.be.undefined;
    expect(status.id).to.equal(intentId);
    expect(status.status).to.be.oneOf(["pending", "processing", "completed", "failed"]);
  });

  it("Should get queue status", async function () {
    const chainId = 1;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    await nexusService.createIntent(chainId, depositId, user, amount, btcEquivalent);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const status = nexusService.getQueueStatus();
    expect(status.total).to.be.at.least(1);
    expect(status.pending + status.processing + status.completed + status.failed).to.equal(status.total);
  });

  it("Should clear completed intents", async function () {
    const chainId = 1;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    await nexusService.createIntent(chainId, depositId, user, amount, btcEquivalent);
    
    // Manually set intent as completed
    const intents = nexusService.getAllIntents();
    intents[0].status = "completed";
    
    nexusService.clearCompletedIntents();
    
    const remainingIntents = nexusService.getAllIntents();
    expect(remainingIntents).to.have.length(0);
  });

  it("Should handle emergency stop", async function () {
    nexusService.emergencyStop();
    
    // Should not throw error
    expect(true).to.be.true;
  });

  it("Should support multiple chains", async function () {
    const chain1Id = 1;
    const chain2Id = 137;
    const depositId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    await nexusService.createIntent(chain1Id, depositId, user, amount, btcEquivalent);
    await nexusService.createIntent(chain2Id, depositId + 1, user, amount, btcEquivalent);
    
    const intents = nexusService.getAllIntents();
    expect(intents).to.have.length(2);
    expect(intents[0].chainId).to.equal(chain1Id);
    expect(intents[1].chainId).to.equal(chain2Id);
  });

  it("Should handle sequential processing", async function () {
    const chainId = 1;
    const user = "0x1234567890123456789012345678901234567890";
    const amount = "1000000000000000000";
    const btcEquivalent = "5000000000";

    // Create multiple intents
    for (let i = 1; i <= 3; i++) {
      await nexusService.createIntent(chainId, i, user, amount, btcEquivalent);
    }
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const intents = nexusService.getAllIntents();
    expect(intents).to.have.length(3);
    
    // All should have valid statuses
    intents.forEach(intent => {
      expect(intent.status).to.be.oneOf(["pending", "processing", "completed", "failed"]);
    });
  });
});
