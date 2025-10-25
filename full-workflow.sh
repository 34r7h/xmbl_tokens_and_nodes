#!/bin/bash

if [ -f ".env" ]; then
    source .env
else
    echo "❌ .env file not found"
    exit 1
fi

# Step 1: User deposits on any chain → ChainDepositContract
echo "Step 1: User deposits on any chain → ChainDepositContract"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL npx hardhat run scripts/activate.ts --network sepolia

# Step 2: Contract queries Pyth for BTC price
echo "Step 2: Contract queries Pyth for BTC price"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS PYTH_HERMES_URL=$PYTH_HERMES_URL PYTH_BTC_USD_FEED_ID=$PYTH_BTC_USD_FEED_ID npx hardhat run scripts/fetch-prices.ts --network sepolia

# Step 3: Creates Avail intent for cross-chain routing
echo "Step 3: Creates Avail intent for cross-chain routing"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL DEPOSIT_MANAGER_ADDRESS=$DEPOSIT_MANAGER_ADDRESS CHAIN_DEPOSIT_CONTRACT_ETHEREUM_ADDRESS=$CHAIN_DEPOSIT_CONTRACT_ETHEREUM_ADDRESS PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS BLOCKSCOUT_API_URL=$BLOCKSCOUT_API_URL AUTOSCOUT_URL=$AUTOSCOUT_URL BLOCKSCOUT_MCP_SERVER_URL=$BLOCKSCOUT_MCP_SERVER_URL BLOCKSCOUT_API_KEY=$BLOCKSCOUT_API_KEY AVAIL_RPC_URL=$AVAIL_RPC_URL AVAIL_WS_URL=$AVAIL_WS_URL npx ts-node scripts/test-flow.ts full 3

# Step 4: Intent queues in sequential order (on-chain confirmation required)
echo "Step 4: Intent queues in sequential order (on-chain confirmation required)"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL DEPOSIT_MANAGER_ADDRESS=$DEPOSIT_MANAGER_ADDRESS CHAIN_DEPOSIT_CONTRACT_ETHEREUM_ADDRESS=$CHAIN_DEPOSIT_CONTRACT_ETHEREUM_ADDRESS PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS BLOCKSCOUT_API_URL=$BLOCKSCOUT_API_URL AUTOSCOUT_URL=$AUTOSCOUT_URL BLOCKSCOUT_MCP_SERVER_URL=$BLOCKSCOUT_MCP_SERVER_URL BLOCKSCOUT_API_KEY=$BLOCKSCOUT_API_KEY AVAIL_RPC_URL=$AVAIL_RPC_URL AVAIL_WS_URL=$AVAIL_WS_URL npx ts-node scripts/test-flow.ts full 3

# Step 5: Central DepositManager processes when prior activation settles
echo "Step 5: Central DepositManager processes when prior activation settles"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS npx hardhat run scripts/tokenomics-status.ts --network sepolia

# Step 6: Algorithmic price increment applied
echo "Step 6: Algorithmic price increment applied"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS npx hardhat run scripts/tokenomics-status.ts --network sepolia

# Step 7: BTC conversion executed
echo "Step 7: BTC conversion executed"
PRIVATE_KEY=$PRIVATE_KEY SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL PRICE_ORACLE_ADDRESS=$PRICE_ORACLE_ADDRESS npx hardhat run scripts/tokenomics-status.ts --network sepolia

# Step 8: All events indexed by Blockscout
echo "Step 8: All events indexed by Blockscout"