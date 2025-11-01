import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { XMBLTokenBase, XMBLTokenBridge, XMBLTokenRegistry, XMBLOracleBase } from "../typechain-types";
import { MockERC20 } from "../typechain-types/contracts/MockERC20";

describe("XMBL Token Bridge", function () {
  let tokenContract: XMBLTokenBase;
  let bridgeContract: XMBLTokenBridge;
  let registryContract: XMBLTokenRegistry;
  let oracleContract: XMBLOracleBase;
  let deployer: Signer;
  let user1: Signer;
  let user2: Signer;
  let mockUSDC: MockERC20;
  let mockWBTC: MockERC20;

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("USDC", "USDC", 6);
    mockWBTC = await MockERC20Factory.deploy("WBTC", "WBTC", 8);
    await mockUSDC.waitForDeployment();
    await mockWBTC.waitForDeployment();

    const usdcAddress = await mockUSDC.getAddress();
    const wbtcAddress = await mockWBTC.getAddress();

    // Deploy token contract
    const TokenFactory = await ethers.getContractFactory("XMBLTokenBase");
    tokenContract = await TokenFactory.deploy(
      usdcAddress,
      wbtcAddress,
      await deployer.getAddress(),
      await deployer.getAddress()
    );
    await tokenContract.waitForDeployment();

    // Deploy registry
    const RegistryFactory = await ethers.getContractFactory("XMBLTokenRegistry");
    registryContract = await RegistryFactory.deploy();
    await registryContract.waitForDeployment();

    // Deploy oracle (mock Wormhole addresses)
    const OracleFactory = await ethers.getContractFactory("XMBLOracleBase");
    oracleContract = await OracleFactory.deploy(
      await tokenContract.getAddress(),
      ethers.ZeroAddress, // Stacks contract address
      ethers.ZeroAddress, // Wormhole core (mock)
      1 // Stacks chain ID
    );
    await oracleContract.waitForDeployment();

    // Deploy bridge
    const BridgeFactory = await ethers.getContractFactory("XMBLTokenBridge");
    bridgeContract = await BridgeFactory.deploy(
      ethers.ZeroAddress, // Wormhole core (mock)
      await tokenContract.getAddress(),
      await registryContract.getAddress(),
      1 // Stacks chain ID
    );
    await bridgeContract.waitForDeployment();

    // Set bridge contract on registry
    await registryContract.setBridgeContract(await bridgeContract.getAddress());

    // Set bridge and oracle on token contract
    await tokenContract.setBridgeContract(await bridgeContract.getAddress());
    await tokenContract.setOracleContract(await oracleContract.getAddress());

    // Mint test tokens
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("10000", 6));
    await mockWBTC.mint(await user1.getAddress(), ethers.parseUnits("10", 8));
  });

  describe("Bridge Initiation", function () {
    it("Should allow user to initiate bridge to Stacks", async function () {
      // First mint a token
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await tokenContract.getAddress(), paymentAmount);
      await tokenContract.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;
      
      // Bridge token
      await bridgeContract.connect(user1).bridgeToStacks(tokenId);

      // Verify token is marked as bridged
      expect(await tokenContract.bridgedTokens(tokenId)).to.be.true;
      expect(await bridgeContract.bridgedTokens(tokenId)).to.be.true;
    });

    it("Should prevent bridging if token is listed", async function () {
      // Mint and list token
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await tokenContract.getAddress(), paymentAmount);
      await tokenContract.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;
      const askingPrice = ethers.parseUnits("1500000", 6);
      await tokenContract.connect(user1).listForSale(tokenId, askingPrice);

      // Try to bridge - should fail
      await expect(
        bridgeContract.connect(user1).bridgeToStacks(tokenId)
      ).to.be.revertedWith("Token must be unlisted before bridging");
    });

    it("Should prevent bridging if not token owner", async function () {
      // Mint token as user1
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await tokenContract.getAddress(), paymentAmount);
      await tokenContract.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;

      // user2 tries to bridge - should fail
      await expect(
        bridgeContract.connect(user2).bridgeToStacks(tokenId)
      ).to.be.revertedWith("Not token owner");
    });
  });

  describe("Token ID Mapping", function () {
    it("Should map token IDs correctly when bridging", async function () {
      // Bridge a token from Base
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await tokenContract.getAddress(), paymentAmount);
      await tokenContract.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const baseTokenId = 1;
      await bridgeContract.connect(user1).bridgeToStacks(baseTokenId);

      // Simulate receiving on Stacks (would normally be via Wormhole)
      const stacksTokenId = 5; // Example: next available ID on Stacks
      const messageId = ethers.keccak256(ethers.toUtf8Bytes(`test_${Date.now()}`));
      
      await bridgeContract.receiveFromStacks(
        messageId,
        stacksTokenId,
        await user1.getAddress(),
        ethers.parseUnits("1", 8), // token price
        1 // source chain (Stacks)
      );

      // Verify mapping
      expect(await registryContract.stacksToBase(stacksTokenId)).to.equal(baseTokenId);
      expect(await registryContract.baseToStacks(baseTokenId)).to.equal(stacksTokenId);
    });

    it("Should prevent duplicate mappings", async function () {
      const stacksTokenId = 5;
      const baseTokenId = 1;
      
      // First mapping
      await registryContract.connect(await bridgeContract.getAddress() as any).mapTokens(
        stacksTokenId,
        baseTokenId,
        true
      );

      // Try duplicate - should fail (via bridge contract validation)
      await expect(
        bridgeContract.receiveFromStacks(
          ethers.keccak256(ethers.toUtf8Bytes("test2")),
          stacksTokenId,
          await user1.getAddress(),
          ethers.parseUnits("1", 8),
          1
        )
      ).to.be.revertedWith("Token already bridged");
    });
  });
});

describe("XMBL Oracle", function () {
  let tokenContract: XMBLTokenBase;
  let oracleContract: XMBLOracleBase;
  let deployer: Signer;
  let mockUSDC: MockERC20;
  let mockWBTC: MockERC20;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("USDC", "USDC", 6);
    mockWBTC = await MockERC20Factory.deploy("WBTC", "WBTC", 8);
    await mockUSDC.waitForDeployment();
    await mockWBTC.waitForDeployment();

    const TokenFactory = await ethers.getContractFactory("XMBLTokenBase");
    tokenContract = await TokenFactory.deploy(
      await mockUSDC.getAddress(),
      await mockWBTC.getAddress(),
      await deployer.getAddress(),
      await deployer.getAddress()
    );
    await tokenContract.waitForDeployment();

    const OracleFactory = await ethers.getContractFactory("XMBLOracleBase");
    oracleContract = await OracleFactory.deploy(
      await tokenContract.getAddress(),
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      1
    );
    await oracleContract.waitForDeployment();

    await tokenContract.setOracleContract(await oracleContract.getAddress());
  });

  it("Should aggregate state from both chains", async function () {
    // Update Base state (from minting)
    await oracleContract.updateBaseState(10, 1000000000);

    // Update Stacks state
    await oracleContract.updateStacksState(5, 500000000);

    const state = await oracleContract.getAggregatedState();
    expect(state.totalTokensBase).to.equal(10);
    expect(state.totalTokensStacks).to.equal(5);
    expect(state.totalTokensMinted).to.equal(15);
    expect(state.aggregatedProofOfFaith).to.equal(1500000000);
  });

  it("Should calculate unified price correctly", async function () {
    // Update states
    await oracleContract.updateBaseState(3, 300000000);
    await oracleContract.updateStacksState(2, 200000000);

    const state = await oracleContract.getAggregatedState();
    
    // Verify price is calculated based on total tokens (5 tokens)
    // Price should be calculated incrementally: STARTING_PRICE + increments for tokens 1-5
    expect(state.currentPrice).to.be.greaterThan(1);
    expect(state.totalTokensMinted).to.equal(5);
  });

  it("Should sync price to Base contract", async function () {
    await oracleContract.updateBaseState(5, 500000000);
    await oracleContract.updateStacksState(3, 300000000);

    // Price should be synced to token contract
    const syncedPrice = await tokenContract.getCurrentPrice();
    const oraclePrice = (await oracleContract.getAggregatedState()).currentPrice;
    
    // Prices should match (oracle syncs to contract)
    expect(syncedPrice).to.equal(oraclePrice);
  });
});

