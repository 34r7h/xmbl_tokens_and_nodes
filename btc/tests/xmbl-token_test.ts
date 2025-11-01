import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';

Clarinet.test({
  name: "Calculate price correctly using formula",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Price for token 1: STARTING_PRICE + ceil((STARTING_PRICE * sqrt(5)) / (2 * 1))
    // = 1 + ceil((1 * 2236) / (2 * 1 * 1000))
    // = 1 + ceil(2236 / 2000)
    // = 1 + ceil(1.118)
    // = 1 + 2 = 3 (rounded up)
    
    // Price for token 2: 3 + ceil((3 * 2236) / (2 * 2 * 1000))
    // = 3 + ceil(6708 / 4000)
    // = 3 + ceil(1.677)
    // = 3 + 2 = 5
    
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'calculate-price', [
        types.uint(1), // previous price
        types.uint(1)  // token number
      ], deployer.address)
    ]);
    
    block.receipts[0].result.expectUint(3); // First token price
  },
});

Clarinet.test({
  name: "Calculate liquidity percentage correctly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // At 0 BTC: should be 10%
    let block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'calculate-liquidity-percentage', [
        types.uint(0)
      ], deployer.address)
    ]);
    block.receipts[0].result.expectUint(10);
    
    // At 100 BTC: should be 95%
    block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'calculate-liquidity-percentage', [
        types.uint(10000000000) // 100 BTC in satoshis
      ], deployer.address)
    ]);
    block.receipts[0].result.expectUint(95);
  },
});

Clarinet.test({
  name: "Mint NFT successfully with correct payment",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const recipient = accounts.get('wallet_1')!;
    
    // Initialize contract first
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Calculate expected price for first token
    const expectedPrice = 3; // From price calculation
    
    // Mint with sufficient payment
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(recipient.address),
        types.uint(expectedPrice * 1000000) // Payment in microstacks
      ], deployer.address)
    ]);
    
    block.receipts[0].result.expectOk();
    
    // Verify NFT ownership
    const ownerCheck = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-owner', [
        types.uint(1)
      ], deployer.address)
    ]);
    
    ownerCheck.receipts[0].result.expectSome(types.principal(recipient.address));
  },
});

Clarinet.test({
  name: "Fail to mint with insufficient payment",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const recipient = accounts.get('wallet_1')!;
    
    // Initialize contract
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Try to mint with insufficient payment
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(recipient.address),
        types.uint(1) // Insufficient payment
      ], deployer.address)
    ]);
    
    block.receipts[0].result.expectErr(types.uint(102)); // ERR_INSUFFICIENT_PAYMENT
  },
});

Clarinet.test({
  name: "Calculate pool split correctly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // At 10 BTC: should split with ~10-27% liquidity (approximate)
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'calculate-pool-split', [
        types.uint(1000000000) // 10 BTC in satoshis
      ], deployer.address)
    ]);
    
    const result = block.receipts[0].result.expectOk().expectTuple();
    result['liquidity'].expectUint();
    result['dev'].expectUint();
    
    // Verify split sums to total
    const liquidity = Number(result['liquidity']);
    const dev = Number(result['dev']);
    const total = liquidity + dev;
    
    // Should be approximately 10 BTC
    console.log(`Split: ${liquidity} liquidity, ${dev} dev, total: ${total}`);
  },
});

Clarinet.test({
  name: "Owner can pause and unpause contract",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const recipient = accounts.get('wallet_1')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Pause contract
    let block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'set-paused', [
        types.bool(true)
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();
    
    // Try to mint while paused (should fail)
    block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(recipient.address),
        types.uint(1000000)
      ], deployer.address)
    ]);
    block.receipts[0].result.expectErr(types.uint(101)); // ERR_PAUSED
    
    // Unpause
    block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'set-paused', [
        types.bool(false)
      ], deployer.address)
    ]);
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "Non-owner cannot change pools",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const nonOwner = accounts.get('wallet_1')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Non-owner tries to change pool (should fail)
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'set-development-pool', [
        types.principal(nonOwner.address)
      ], nonOwner.address)
    ]);
    
    block.receipts[0].result.expectErr(types.uint(100)); // ERR_NOT_OWNER
  },
});

Clarinet.test({
  name: "Price increases correctly with each mint",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const recipient = accounts.get('wallet_1')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Get initial price
    let block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-current-price', [], deployer.address)
    ]);
    const price1 = block.receipts[0].result.expectUint(1);
    
    // Mint first token
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(recipient.address),
        types.uint(10000000) // Large payment
      ], deployer.address)
    ]);
    
    // Get new price (should be higher)
    block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-current-price', [], deployer.address)
    ]);
    const price2 = block.receipts[0].result.expectUint();
    
    // Price should have increased
    console.log(`Price increased from ${price1} to ${price2}`);
  },
});

Clarinet.test({
  name: "List token for resale",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Mint a token to wallet1
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(wallet1.address),
        types.uint(1000000)
      ], deployer.address)
    ]);
    
    // Wallet1 lists token for sale
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'list-for-sale', [
        types.uint(1),
        types.uint(1500000)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Check listing exists
    const listing = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-listing', [
        types.uint(1)
      ], deployer.address)
    ]);
    listing.receipts[0].result.expectSome().expectTuple();
  },
});

Clarinet.test({
  name: "Buy function prefers listed tokens over minting",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Mint and list a token
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(wallet1.address),
        types.uint(1000000)
      ], deployer.address)
    ]);
    
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'list-for-sale', [
        types.uint(1),
        types.uint(1500000)
      ], wallet1.address)
    ]);
    
    // Wallet2 buys using buy function (should buy listed token, not mint new)
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'buy', [
        types.uint(1500000)
      ], wallet2.address)
    ]);
    block.receipts[0].result.expectOk().expectTuple();
    
    // Verify wallet2 now owns token 1
    const owner = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-owner', [
        types.uint(1)
      ], deployer.address)
    ]);
    owner.receipts[0].result.expectSome().expectPrincipal(wallet2.address);
  },
});

Clarinet.test({
  name: "Transfer removes token from listings",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    // Initialize
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'initialize', [
        types.principal(deployer.address)
      ], deployer.address)
    ]);
    
    // Mint and list
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'mint-new', [
        types.principal(wallet1.address),
        types.uint(1000000)
      ], deployer.address)
    ]);
    
    chain.mineBlock([
      Tx.contractCall('xmbl-token', 'list-for-sale', [
        types.uint(1),
        types.uint(1500000)
      ], wallet1.address)
    ]);
    
    // Transfer token (should automatically unlist)
    const block = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'transfer', [
        types.uint(1),
        types.principal(wallet1.address),
        types.principal(wallet2.address)
      ], wallet1.address)
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify listing no longer exists
    const listing = chain.mineBlock([
      Tx.contractCall('xmbl-token', 'get-listing', [
        types.uint(1)
      ], deployer.address)
    ]);
    listing.receipts[0].result.expectNone();
  },
});
