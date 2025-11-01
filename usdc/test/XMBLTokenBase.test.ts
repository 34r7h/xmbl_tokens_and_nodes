import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { XMBLTokenBase } from "../typechain-types";

describe("XMBLTokenBase", function () {
  let xmblToken: XMBLTokenBase;
  let deployer: Signer;
  let user1: Signer;
  let user2: Signer;
  let usdcToken: any;
  let wbtcToken: any;
  let mockUSDC: any;
  let mockWBTC: any;

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USDC", "USDC", 6); // 6 decimals
    mockWBTC = await MockERC20.deploy("WBTC", "WBTC", 8); // 8 decimals
    
    await mockUSDC.waitForDeployment();
    await mockWBTC.waitForDeployment();

    usdcToken = await mockUSDC.getAddress();
    wbtcToken = await mockWBTC.getAddress();

    // Deploy XMBLTokenBase
    const XMBLTokenBaseFactory = await ethers.getContractFactory("XMBLTokenBase");
    xmblToken = await XMBLTokenBaseFactory.deploy(
      usdcToken,
      wbtcToken,
      await deployer.getAddress(),
      await deployer.getAddress()
    );

    await xmblToken.waitForDeployment();

    // Mint some test tokens to users
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("10000", 6));
    await mockUSDC.mint(await user2.getAddress(), ethers.parseUnits("10000", 6));
    await mockWBTC.mint(await user1.getAddress(), ethers.parseUnits("10", 8));
    await mockWBTC.mint(await user2.getAddress(), ethers.parseUnits("10", 8));
  });

  describe("Deployment", function () {
    it("Should set correct initial values", async function () {
      expect(await xmblToken.currentPrice()).to.equal(1);
      expect(await xmblToken.tokensMinted()).to.equal(0);
      expect(await xmblToken.proofOfFaith()).to.equal(0);
    });
  });

  describe("Pricing", function () {
    it("Should calculate price correctly", async function () {
      // Price for token 1: 1 + ceil((1 * 2236) / (2 * 1 * 1000)) = 1 + ceil(1.118) = 1 + 2 = 3
      const price1 = await xmblToken.calculatePrice(1, 1);
      expect(price1).to.equal(3);

      // Price for token 2: 3 + ceil((3 * 2236) / (2 * 2 * 1000)) = 3 + ceil(1.677) = 3 + 2 = 5
      const price2 = await xmblToken.calculatePrice(3, 2);
      expect(price2).to.equal(5);
    });

    it("Should convert WBTC to payment tokens", async function () {
      const wbtcSats = 1000; // 1000 satoshis
      
      // WBTC conversion: 1000 * 1e10 = 1e13
      const wbtcAmount = await xmblToken.convertWBTCToPaymentToken(wbtcSats, false);
      expect(wbtcAmount).to.equal(ethers.parseUnits("1000", 8)); // Should handle properly
      
      // USDC conversion: 1000 * 500 = 500000 micro-USDC
      const usdcAmount = await xmblToken.convertWBTCToPaymentToken(wbtcSats, true);
      expect(usdcAmount).to.equal(500000); // 500000 with 6 decimals
    });
  });

  describe("Minting", function () {
    it("Should mint NFT with USDC payment", async function () {
      const recipient = await user1.getAddress();
      const paymentAmount = ethers.parseUnits("1000000", 6); // 1 USDC

      // Approve
      await mockUSDC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);

      // Mint
      const tx = await xmblToken.connect(user1).mintNew(recipient, paymentAmount, true);
      const receipt = await tx.wait();

      expect(await xmblToken.balanceOf(recipient)).to.equal(1);
      expect(await xmblToken.tokensMinted()).to.equal(1);
      expect(await xmblToken.currentPrice()).to.be.greaterThan(1);
    });

    it("Should mint NFT with WBTC payment", async function () {
      const recipient = await user1.getAddress();
      const paymentAmount = ethers.parseUnits("1", 8); // 1 WBTC satoshi scaled

      // Approve
      await mockWBTC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);

      // Mint
      await xmblToken.connect(user1).mintNew(recipient, paymentAmount, false);

      expect(await xmblToken.balanceOf(recipient)).to.equal(1);
      expect(await xmblToken.tokensMinted()).to.equal(1);
    });

    it("Should fail with insufficient payment", async function () {
      const recipient = await user1.getAddress();
      const paymentAmount = ethers.parseUnits("1", 6); // Too small

      await mockUSDC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);

      await expect(
        xmblToken.connect(user1).mintNew(recipient, paymentAmount, true)
      ).to.be.revertedWithCustomError(xmblToken, "InsufficientPayment");
    });
  });

  describe("Listing and Buying", function () {
    it("Should list token for sale", async function () {
      // First mint a token
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);
      await xmblToken.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;
      const askingPrice = ethers.parseUnits("1500000", 6); // 1.5 USDC

      await xmblToken.connect(user1).listForSale(tokenId, askingPrice);

      const listing = await xmblToken.getListing(tokenId);
      expect(listing.exists).to.be.true;
      expect(listing.seller).to.equal(await user1.getAddress());
      expect(listing.askingPrice).to.equal(askingPrice);
    });

    it("Should buy listed token before minting new", async function () {
      // Mint and list
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);
      await xmblToken.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;
      const askingPrice = ethers.parseUnits("1500000", 6);
      await xmblToken.connect(user1).listForSale(tokenId, askingPrice);

      // User2 buys using buy() function (should buy listed token)
      await mockUSDC.connect(user2).approve(await xmblToken.getAddress(), askingPrice);
      await xmblToken.connect(user2).buy(askingPrice, true);

      // Check ownership
      expect(await xmblToken.ownerOf(tokenId)).to.equal(await user2.getAddress());
    });

    it("Should unlist token", async function () {
      // Mint and list
      const paymentAmount = ethers.parseUnits("1000000", 6);
      await mockUSDC.connect(user1).approve(await xmblToken.getAddress(), paymentAmount);
      await xmblToken.connect(user1).mintNew(await user1.getAddress(), paymentAmount, true);

      const tokenId = 1;
      const askingPrice = ethers.parseUnits("1500000", 6);
      await xmblToken.connect(user1).listForSale(tokenId, askingPrice);

      // Unlist
      await xmblToken.connect(user1).unlist(tokenId);

      const listing = await xmblToken.getListing(tokenId);
      expect(listing.exists).to.be.false;
    });
  });

  describe("Pool Split", function () {
    it("Should calculate liquidity percentage correctly", async function () {
      // At 0 BTC: should be 10%
      const percent0 = await xmblToken.calculateLiquidityPercentage(0);
      expect(percent0).to.equal(10);

      // At 100 BTC: should be 95%
      const percent100 = await xmblToken.calculateLiquidityPercentage(100 * 1e8);
      expect(percent100).to.equal(95);
    });

    it("Should split pools correctly", async function () {
      const totalBtc = 10 * 1e8; // 10 BTC
      const (devAmount, liquidityAmount) = await xmblToken.calculatePoolSplit(totalBtc);

      expect(devAmount + liquidityAmount).to.equal(totalBtc);
      expect(liquidityAmount).to.be.greaterThan(devAmount); // More liquidity as BTC increases
    });
  });
});

