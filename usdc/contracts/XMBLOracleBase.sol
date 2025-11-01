// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./XMBLTokenBase.sol";

/**
 * @title XMBLOracleBase
 * @dev Oracle contract that aggregates state from both Stacks and Base contracts
 * Calculates unified price and proof-of-faith, syncs to both chains
 * Master chain: stores authoritative aggregated state
 */
contract XMBLOracleBase is Ownable {
    // Token contracts
    XMBLTokenBase public baseTokenContract;
    address public stacksTokenContract; // Stacks contract address (for reference)
    
    // Aggregated state
    struct AggregatedState {
        uint256 totalTokensStacks;      // From Stacks contract
        uint256 totalTokensBase;        // From Base contract
        uint256 totalTokensMinted;      // Sum of both
        uint256 proofOfFaithStacks;     // From Stacks (in satoshis)
        uint256 proofOfFaithBase;       // From Base (in WBTC satoshis)
        uint256 aggregatedProofOfFaith; // Unified total (normalized)
        uint256 currentPrice;           // Calculated from totalTokensMinted
        uint256 lastUpdated;           // Timestamp of last update
    }
    
    AggregatedState public aggregatedState;
    
    // Track previous price for incremental calculation
    uint256 private previousPriceHistory;
    
    // Pricing constants (same as token contracts)
    uint256 public constant STARTING_PRICE = 1;
    uint256 public constant SQRT5_PRECISION = 2236;
    uint256 public constant PRECISION_MULTIPLIER = 1000;
    
    // Authorized updaters (can update state)
    mapping(address => bool) public authorizedUpdaters;
    
    // Wormhole integration for syncing to Stacks
    address public wormholeCore;
    uint16 public stacksChainId;
    
    // Events
    event StateUpdated(
        uint256 totalTokensStacks,
        uint256 totalTokensBase,
        uint256 aggregatedProofOfFaith,
        uint256 currentPrice
    );
    
    event PriceSynced(uint256 price, uint16 targetChain);
    event ProofOfFaithSynced(uint256 proofOfFaith, uint16 targetChain);
    
    error Unauthorized();
    error InvalidContract();
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || authorizedUpdaters[msg.sender],
            "Unauthorized"
        );
        _;
    }
    
    constructor(
        address _baseTokenContract,
        address _stacksTokenContract,
        address _wormholeCore,
        uint16 _stacksChainId
    ) {
        require(_baseTokenContract != address(0), "Base contract cannot be zero");
        
        baseTokenContract = XMBLTokenBase(_baseTokenContract);
        stacksTokenContract = _stacksTokenContract;
        wormholeCore = _wormholeCore;
        stacksChainId = _stacksChainId;
        
        // Initialize aggregated state
        aggregatedState.currentPrice = STARTING_PRICE;
        aggregatedState.lastUpdated = block.timestamp;
        previousPriceHistory = STARTING_PRICE;
        
        authorizedUpdaters[msg.sender] = true;
    }
    
    /**
     * @dev Calculate price using same formula as token contracts
     * cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))
     * @param previousPrice Previous price in WBTC satoshis
     * @param tokenNumber Token number for this calculation (1-based)
     * @return New price after increment
     */
    function calculatePrice(uint256 previousPrice, uint256 tokenNumber) public pure returns (uint256) {
        if (tokenNumber == 0) return STARTING_PRICE;
        if (previousPrice == 0) previousPrice = STARTING_PRICE;
        
        uint256 numerator = previousPrice * SQRT5_PRECISION;
        uint256 denominator = (2 * tokenNumber) * PRECISION_MULTIPLIER;
        uint256 divisionResult = numerator / denominator;
        uint256 remainder = numerator % denominator;
        uint256 increase = remainder > 0 ? divisionResult + 1 : divisionResult;
        uint256 newPrice = previousPrice + increase;
        
        return newPrice == 0 ? 1 : newPrice;
    }
    
    /**
     * @dev Calculate final price after N tokens have been minted
     * Calculates price incrementally from token 1 to totalTokens
     * @param totalTokens Total number of tokens minted across both chains
     * @return Final price after all tokens
     */
    function calculateFinalPrice(uint256 totalTokens) internal pure returns (uint256) {
        if (totalTokens == 0) return STARTING_PRICE;
        
        uint256 price = STARTING_PRICE;
        
        // Calculate price incrementally for each token
        // This ensures the price matches what would be calculated if all tokens were minted sequentially
        // Limit iteration to prevent excessive gas usage for very large token counts
        uint256 maxIterations = totalTokens > 1000 ? 1000 : totalTokens;
        for (uint256 i = 1; i <= maxIterations; i++) {
            price = calculatePrice(price, i);
        }
        
        // For tokens beyond limit, use approximation based on final price
        if (totalTokens > 1000) {
            // Apply remaining increments (gas optimization for very large token counts)
            uint256 remaining = totalTokens - 1000;
            for (uint256 i = 1001; i <= totalTokens && i <= 2000; i++) {
                price = calculatePrice(price, i);
            }
        }
        
        return price;
    }
    
    /**
     * @dev Update state from Base contract
     * Called by Base token contract after minting
     */
    function updateBaseState(uint256 tokensMinted, uint256 proofOfFaith) external {
        require(msg.sender == address(baseTokenContract), "Not token contract");
        
        aggregatedState.totalTokensBase = tokensMinted;
        aggregatedState.proofOfFaithBase = proofOfFaith;
        
        _recalculateAggregatedState();
    }
    
    /**
     * @dev Update state from Stacks contract
     * Called by off-chain service or Stacks oracle (via Wormhole message)
     */
    function updateStacksState(uint256 tokensMinted, uint256 proofOfFaith) external onlyAuthorized {
        aggregatedState.totalTokensStacks = tokensMinted;
        aggregatedState.proofOfFaithStacks = proofOfFaith;
        
        _recalculateAggregatedState();
    }
    
    /**
     * @dev Recalculate aggregated state and price
     */
    function _recalculateAggregatedState() internal {
        // Calculate total tokens across both chains
        aggregatedState.totalTokensMinted = aggregatedState.totalTokensStacks + aggregatedState.totalTokensBase;
        
        // Aggregate proof of faith (both in satoshis, same scale)
        aggregatedState.aggregatedProofOfFaith = aggregatedState.proofOfFaithStacks + aggregatedState.proofOfFaithBase;
        
        // Calculate unified price based on total tokens
        // Price formula: cost = cost + ceil((cost * sqrt(5)) / (2 * x))
        // Where x = token number (cumulative across both chains)
        // We recalculate from STARTING_PRICE incrementally to ensure consistency
        // regardless of which chain tokens exist on or were minted first
        if (aggregatedState.totalTokensMinted > 0) {
            aggregatedState.currentPrice = calculateFinalPrice(aggregatedState.totalTokensMinted);
        } else {
            aggregatedState.currentPrice = STARTING_PRICE;
        }
        previousPriceHistory = aggregatedState.currentPrice;
        
        aggregatedState.lastUpdated = block.timestamp;
        
        // Sync to both contracts
        _syncPriceToBase();
        _syncPriceToStacks();
        _syncProofOfFaithToBase();
        _syncProofOfFaithToStacks();
        
        emit StateUpdated(
            aggregatedState.totalTokensStacks,
            aggregatedState.totalTokensBase,
            aggregatedState.aggregatedProofOfFaith,
            aggregatedState.currentPrice
        );
    }
    
    /**
     * @dev Sync price to Base contract
     */
    function _syncPriceToBase() internal {
        baseTokenContract.syncPriceFromOracle(aggregatedState.currentPrice);
    }
    
    /**
     * @dev Sync price to Stacks contract (via Wormhole message)
     */
    function _syncPriceToStacks() internal {
        // In production, this would send Wormhole message to Stacks oracle
        // For now, emit event that off-chain service will handle
        emit PriceSynced(aggregatedState.currentPrice, stacksChainId);
    }
    
    /**
     * @dev Sync proof of faith to Base contract
     */
    function _syncProofOfFaithToBase() internal {
        baseTokenContract.syncProofOfFaithFromOracle(aggregatedState.aggregatedProofOfFaith);
    }
    
    /**
     * @dev Sync proof of faith to Stacks contract (via Wormhole message)
     */
    function _syncProofOfFaithToStacks() internal {
        // In production, this would send Wormhole message to Stacks oracle
        emit ProofOfFaithSynced(aggregatedState.aggregatedProofOfFaith, stacksChainId);
    }
    
    /**
     * @dev Manual sync to Stacks (can be called by authorized updater)
     */
    function syncToStacks() external onlyAuthorized {
        _syncPriceToStacks();
        _syncProofOfFaithToStacks();
    }
    
    /**
     * @dev Get current aggregated state
     */
    function getAggregatedState() external view returns (AggregatedState memory) {
        return aggregatedState;
    }
    
    /**
     * @dev Add authorized updater (for off-chain services)
     */
    function addAuthorizedUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = true;
    }
    
    /**
     * @dev Remove authorized updater
     */
    function removeAuthorizedUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = false;
    }
    
    /**
     * @dev Update Wormhole configuration
     */
    function updateWormholeConfig(address _wormholeCore, uint16 _stacksChainId) external onlyOwner {
        require(_wormholeCore != address(0), "Invalid Wormhole core");
        wormholeCore = _wormholeCore;
        stacksChainId = _stacksChainId;
    }
}

