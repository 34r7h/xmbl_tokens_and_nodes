// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PriceOracle.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DepositManager
 * @dev Central consolidation contract for cross-chain deposits
 * Manages sequential activation queue with price locking
 */
contract DepositManager is ReentrancyGuard, Ownable {
    PriceOracle public immutable priceOracle;
    
    struct Activation {
        uint256 id;
        address user;
        uint256 amount;
        uint256 btcEquivalent;
        uint256 costs;
        uint256 netBtcEquivalent;
        uint256 lockedPrice;
        uint256 timestamp;
        bool processed;
        bool settled;
    }
    
    mapping(uint256 => Activation) public activations;
    mapping(address => uint256[]) public userActivations;
    
    uint256 public nextActivationId = 1;
    uint256 public currentProcessingId = 0;
    uint256 public btcPoolBalance = 0;
    uint256 public totalCosts = 0;
    uint256 public totalNetBtcEquivalent = 0;
    
    // Sequential processing state
    bool public processingPaused = false;
    uint256 public maxQueueSize = 1000;
    
    event DepositReceived(
        uint256 indexed activationId,
        address indexed user,
        uint256 amount,
        uint256 btcEquivalent,
        uint256 costs,
        uint256 netBtcEquivalent,
        uint256 lockedPrice
    );
    
    event ActivationProcessed(
        uint256 indexed activationId,
        uint256 newPrice,
        bool settled
    );
    
    event SettlementFailed(uint256 indexed activationId);
    event BtcPoolUpdated(uint256 newBalance);
    
    constructor(address _priceOracle) {
        priceOracle = PriceOracle(_priceOracle);
    }
    
    /**
     * @dev Receive deposit from chain deposit contract
     * Locks current price for sequential processing
     * Note: btcEquivalent parameter is now the net BTC after costs
     */
    function receiveDeposit(
        address user,
        uint256 amount,
        uint256 netBtcEquivalent
    ) external onlyOwner nonReentrant returns (uint256) {
        require(!processingPaused, "Processing paused");
        require(nextActivationId <= maxQueueSize, "Queue full");
        require(netBtcEquivalent > 0, "Net BTC must be positive");
        
        uint256 activationId = nextActivationId++;
        uint256 lockedPrice = priceOracle.getCurrentPrice();
        
        // Calculate costs (this should match the calculation in ChainDepositContract)
        uint256 costs = calculateCosts(netBtcEquivalent);
        uint256 btcEquivalent = netBtcEquivalent + costs;
        
        activations[activationId] = Activation({
            id: activationId,
            user: user,
            amount: amount,
            btcEquivalent: btcEquivalent,
            costs: costs,
            netBtcEquivalent: netBtcEquivalent,
            lockedPrice: lockedPrice,
            timestamp: block.timestamp,
            processed: false,
            settled: false
        });
        
        userActivations[user].push(activationId);
        totalCosts += costs;
        totalNetBtcEquivalent += netBtcEquivalent;
        
        emit DepositReceived(activationId, user, amount, btcEquivalent, costs, netBtcEquivalent, lockedPrice);
        
        return activationId;
    }
    
    /**
     * @dev Process next activation in sequence
     * Only processes if previous activation is settled
     */
    function processNextActivation() external onlyOwner nonReentrant {
        require(!processingPaused, "Processing paused");
        require(currentProcessingId < nextActivationId, "No activations to process");
        
        uint256 activationId = currentProcessingId + 1;
        Activation storage activation = activations[activationId];
        
        require(!activation.processed, "Already processed");
        
        // Check if previous activation is settled (except for first activation)
        if (activationId > 1) {
            require(activations[activationId - 1].settled, "Previous activation not settled");
        }
        
        // Process activation
        activation.processed = true;
        priceOracle.activateToken();
        
        // Update BTC pool balance (using net BTC equivalent)
        btcPoolBalance += activation.netBtcEquivalent;
        
        emit ActivationProcessed(activationId, priceOracle.getCurrentPrice(), false);
    }
    
    /**
     * @dev Mark activation as settled
     * Reverts if settlement fails
     */
    function settleActivation(uint256 activationId, bool settlementSuccess) external onlyOwner {
        require(activations[activationId].processed, "Not processed");
        
        if (!settlementSuccess) {
            emit SettlementFailed(activationId);
            revert("Settlement failed");
        }
        
        activations[activationId].settled = true;
        currentProcessingId = activationId;
        
        emit ActivationProcessed(activationId, priceOracle.getCurrentPrice(), true);
    }
    
    /**
     * @dev Get activation details
     */
    function getActivation(uint256 activationId) external view returns (Activation memory) {
        return activations[activationId];
    }
    
    /**
     * @dev Get user's activations
     */
    function getUserActivations(address user) external view returns (uint256[] memory) {
        return userActivations[user];
    }
    
    /**
     * @dev Get queue status
     */
    function getQueueStatus() external view returns (
        uint256 totalActivations,
        uint256 processedActivations,
        uint256 settledActivations,
        bool isProcessingPaused
    ) {
        totalActivations = nextActivationId - 1;
        processedActivations = currentProcessingId;
        settledActivations = currentProcessingId;
        isProcessingPaused = processingPaused;
    }
    
    /**
     * @dev Pause/resume processing
     */
    function setProcessingPaused(bool paused) external onlyOwner {
        processingPaused = paused;
    }
    
    /**
     * @dev Set max queue size
     */
    function setMaxQueueSize(uint256 newSize) external onlyOwner {
        maxQueueSize = newSize;
    }
    
    /**
     * @dev Update BTC pool balance (for external BTC conversions)
     */
    function updateBtcPoolBalance(uint256 newBalance) external onlyOwner {
        btcPoolBalance = newBalance;
        emit BtcPoolUpdated(newBalance);
    }
    
    /**
     * @dev Calculate costs for activation (matches ChainDepositContract)
     */
    function calculateCosts(uint256 btcAmount) public pure returns (uint256) {
        // Oracle costs (Pyth price feed updates)
        uint256 oracleCosts = 1000; // 1000 satoshis base cost
        
        // Contract costs (gas for contract calls)
        uint256 contractCosts = 2000; // 2000 satoshis base cost
        
        // Network fees (3% of BTC amount, rounded up to nearest satoshi)
        uint256 networkFees = (btcAmount * 3) / 100;
        if ((btcAmount * 3) % 100 > 0) {
            networkFees += 1; // Round up to nearest satoshi
        }
        
        uint256 totalCosts = oracleCosts + contractCosts + networkFees;
        
        return totalCosts;
    }
    
    /**
     * @dev Get cost statistics
     */
    function getCostStats() external view returns (
        uint256 totalCostsAmount,
        uint256 totalNetBtcEquivalentAmount,
        uint256 btcPoolBalanceAmount
    ) {
        totalCostsAmount = totalCosts;
        totalNetBtcEquivalentAmount = totalNetBtcEquivalent;
        btcPoolBalanceAmount = btcPoolBalance;
    }
    
    /**
     * @dev Emergency function to reset processing state
     */
    function emergencyReset() external onlyOwner {
        currentProcessingId = 0;
        processingPaused = false;
    }
}
