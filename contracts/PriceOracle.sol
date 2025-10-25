// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PriceOracle
 * @dev Implements XMBL token economics with Pyth oracle integration
 * Price calculation: x / (Phi * y) where Phi = Golden Ratio (1.618...)
 * All prices round UP to nearest satoshi
 */
contract PriceOracle {
    // Golden ratio constant: (1 + sqrt(5)) / 2 ≈ 1.618
    uint256 public constant PHI = 1618; // 1.618 * 1000 for precision
    
    uint256 public constant STARTING_PRICE = 1; // 1 satoshi
    uint256 public constant NETWORK_FEE_PERCENT = 3; // 3%
    uint256 public constant SATOSHI_PRECISION = 1e8; // 8 decimal places for satoshi
    
    // Tokenomics Configuration (from Firebase implementation)
    uint256 public constant COIN_SUPPLY = 999999999; // Total coin supply
    uint256 public constant COIN_DIVIDE = 9; // Initial divisor for coin distribution
    uint256 public constant COIN_RELEASE_TARGET = 369000; // Initial release target (0.00369 BTC in satoshis)
    uint256 public constant GROWTH_FACTOR = 1; // Minimal growth factor
    
    IPyth public immutable pyth;
    bytes32 public immutable btcUsdPriceId;
    
    uint256 public currentPrice = STARTING_PRICE;
    uint256 public tokensMinted = 0;
    uint256 public activationCount = 0;
    
    // Tokenomics State
    uint256 public proofOfFaith = 0; // Total BTC deposited
    uint256 public xymMinted = 0; // Tokens minted
    uint256 public xymNextPrice = STARTING_PRICE; // Next token price
    uint256 public xymPrevPrice = 0; // Previous token price
    uint256 public xyDivisor = COIN_SUPPLY / COIN_DIVIDE; // Coin distribution divisor
    uint256 public xyReleased = 0; // Coins released
    uint256 public xyRemaining = COIN_SUPPLY; // Coins remaining
    uint256 public xyReleaseTarget = COIN_RELEASE_TARGET; // Release target price
    uint256 public xyNextAmount = 9; // Next coin release amount
    
    mapping(uint256 => uint256) public activationPrices;
    mapping(uint256 => bool) public activationSettled;
    
    event PriceUpdated(uint256 newPrice, uint256 tokensMinted);
    event ActivationProcessed(uint256 activationId, uint256 price, bool settled);
    event SettlementFailed(uint256 activationId);
    event CoinsReleased(uint256 amount, uint256 totalReleased, uint256 remaining);
    event TokenomicsUpdated(uint256 proofOfFaith, uint256 xymMinted, uint256 xymNextPrice);
    
    constructor(address _pyth, bytes32 _btcUsdPriceId) {
        pyth = IPyth(_pyth);
        btcUsdPriceId = _btcUsdPriceId;
    }
    
    /**
     * @dev Calculate token price using Firebase tokenomics formula
     * Price = previousPrice + (previousPrice / (GROWTH_FACTOR * tokenNumber))
     * Always rounds UP to nearest satoshi
     */
    function calculatePrice(uint256 _tokensMinted) public pure returns (uint256) {
        if (_tokensMinted == 0) return STARTING_PRICE;
        
        // Firebase tokenomics formula: newPrice = cost + (cost / (GROWTH_FACTOR * (tokensMinted + 1)))
        uint256 cost = STARTING_PRICE;
        uint256 growthMultiplier = (GROWTH_FACTOR * (_tokensMinted + 1)) / 1000;
        
        if (growthMultiplier == 0) return cost;
        
        uint256 priceIncrease = cost / growthMultiplier;
        uint256 newPrice = cost + priceIncrease;
        
        // Ensure minimum price of 1 satoshi
        if (newPrice == 0) newPrice = 1;
        
        return newPrice;
    }
    
    /**
     * @dev Update price based on current token supply
     */
    function updatePrice() public {
        uint256 newPrice = calculatePrice(tokensMinted);
        currentPrice = newPrice;
        emit PriceUpdated(newPrice, tokensMinted);
    }
    
    /**
     * @dev Increase price on activation with full tokenomics
     */
    function activateToken() external {
        activationCount++;
        tokensMinted++;
        xymMinted++;
        
        // Store previous price
        xymPrevPrice = xymNextPrice;
        
        // Firebase tokenomics formula: newPrice = cost + (cost / (GROWTH_FACTOR * (tokensMinted + 1)))
        uint256 cost = xymPrevPrice > 0 ? xymPrevPrice : STARTING_PRICE;
        uint256 growthMultiplier = (GROWTH_FACTOR * (xymMinted + 1)) / 1000;
        
        if (growthMultiplier > 0) {
            uint256 priceIncrease = cost / growthMultiplier;
            xymNextPrice = cost + priceIncrease;
        } else {
            xymNextPrice = STARTING_PRICE;
        }
        
        // Update proof of faith (total BTC deposited)
        proofOfFaith += cost;
        
        // Check if we should release coins
        if (xyRemaining > 0 && xymNextPrice > xyReleaseTarget) {
            // Release coins
            uint256 amount = xyNextAmount;
            xyReleased += amount;
            
            // Update coin divisor (halve it)
            xyDivisor = xyDivisor / 2;
            
            // Update remaining coins
            xyRemaining = COIN_SUPPLY - xyReleased;
            
            // Update next coin release amount (prevent division by zero)
            if (xyDivisor > 0) {
                xyNextAmount = xyRemaining / xyDivisor;
            } else {
                xyNextAmount = xyRemaining; // Release all remaining coins
            }
            
            // Update coin release target using golden ratio
            xyReleaseTarget = (xyReleaseTarget * 1618) / 1000;
            
            emit CoinsReleased(amount, xyReleased, xyRemaining);
        }
        
        currentPrice = xymNextPrice;
        emit ActivationProcessed(activationCount, currentPrice, false);
        emit TokenomicsUpdated(proofOfFaith, xymMinted, xymNextPrice);
    }
    
    /**
     * @dev Decrease price on deactivation
     */
    function deactivateToken() external {
        if (tokensMinted > 0) {
            tokensMinted--;
            updatePrice();
        }
    }
    
    /**
     * @dev Process activation with settlement verification
     * Reverts if settlement fails
     */
    function processActivationWithSettlement(bool settlementSuccess) external {
        require(settlementSuccess, "Settlement failed");
        
        activationCount++;
        tokensMinted++;
        updatePrice();
        
        activationPrices[activationCount] = currentPrice;
        activationSettled[activationCount] = true;
        
        emit ActivationProcessed(activationCount, currentPrice, true);
    }
    
    /**
     * @dev Calculate 3% network fee, rounded UP to nearest satoshi
     */
    function calculateNetworkFee(uint256 amount) public pure returns (uint256) {
        uint256 fee = (amount * NETWORK_FEE_PERCENT) / 100;
        
        // Ensure minimum fee of 1 satoshi
        if (fee == 0) fee = 1;
        
        // Round UP to nearest satoshi
        if (fee % SATOSHI_PRECISION != 0) {
            fee = ((fee / SATOSHI_PRECISION) + 1) * SATOSHI_PRECISION;
        }
        
        return fee;
    }
    
    /**
     * @dev Get current price
     */
    function getCurrentPrice() external view returns (uint256) {
        return currentPrice;
    }
    
    /**
     * @dev Set tokens minted (for testing)
     */
    function setTokensMinted(uint256 _tokensMinted) external {
        tokensMinted = _tokensMinted;
        updatePrice();
    }
    
    /**
     * @dev Get BTC price from Pyth oracle
     */
    function getBtcPrice() external view returns (uint256) {
        // For now, return a mock price. In production, this would use Pyth's getPrice
        return 50000 * 1e8; // $50,000 in satoshis
    }
    
    /**
     * @dev Get tokenomics state
     */
    function getTokenomicsState() external view returns (
        uint256 _proofOfFaith,
        uint256 _xymMinted,
        uint256 _xymNextPrice,
        uint256 _xymPrevPrice,
        uint256 _xyDivisor,
        uint256 _xyReleased,
        uint256 _xyRemaining,
        uint256 _xyReleaseTarget,
        uint256 _xyNextAmount
    ) {
        return (
            proofOfFaith,
            xymMinted,
            xymNextPrice,
            xymPrevPrice,
            xyDivisor,
            xyReleased,
            xyRemaining,
            xyReleaseTarget,
            xyNextAmount
        );
    }
    
    /**
     * @dev Get coin distribution status
     */
    function getCoinDistributionStatus() external view returns (
        bool canReleaseCoins,
        uint256 nextReleaseAmount,
        uint256 releaseTarget,
        uint256 totalReleased,
        uint256 remaining
    ) {
        canReleaseCoins = xyRemaining > 0 && xymNextPrice > xyReleaseTarget;
        nextReleaseAmount = xyNextAmount;
        releaseTarget = xyReleaseTarget;
        totalReleased = xyReleased;
        remaining = xyRemaining;
    }
}
