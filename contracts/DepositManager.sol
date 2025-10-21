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
    
    // Sequential processing state
    bool public processingPaused = false;
    uint256 public maxQueueSize = 1000;
    
    event DepositReceived(
        uint256 indexed activationId,
        address indexed user,
        uint256 amount,
        uint256 btcEquivalent,
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
     */
    function receiveDeposit(
        address user,
        uint256 amount,
        uint256 btcEquivalent
    ) external onlyOwner nonReentrant returns (uint256) {
        require(!processingPaused, "Processing paused");
        require(nextActivationId <= maxQueueSize, "Queue full");
        
        uint256 activationId = nextActivationId++;
        uint256 lockedPrice = priceOracle.getCurrentPrice();
        
        activations[activationId] = Activation({
            id: activationId,
            user: user,
            amount: amount,
            btcEquivalent: btcEquivalent,
            lockedPrice: lockedPrice,
            timestamp: block.timestamp,
            processed: false,
            settled: false
        });
        
        userActivations[user].push(activationId);
        
        emit DepositReceived(activationId, user, amount, btcEquivalent, lockedPrice);
        
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
        
        // Update BTC pool balance
        btcPoolBalance += activation.btcEquivalent;
        
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
     * @dev Emergency function to reset processing state
     */
    function emergencyReset() external onlyOwner {
        currentProcessingId = 0;
        processingPaused = false;
    }
}
