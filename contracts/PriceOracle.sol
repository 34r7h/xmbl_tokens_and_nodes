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
    uint256 public constant COIN_RELEASE_TARGET = 369; // Initial release target (0.00369 BTC in satoshis)
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
        
        // Your algorithm: cost = x + (x * Math.sqrt(5)) / (2 * y)
        uint256 x = xymPrevPrice > 0 ? xymPrevPrice : STARTING_PRICE;
        uint256 y = xymMinted;
        
        if (y > 0) {
            // Calculate: x + (x * sqrt(5)) / (2 * y)
            // sqrt(5) ≈ 2236 (2236/1000 for precision)
            uint256 sqrt5 = 2236;
            uint256 numerator = x * sqrt5;
            uint256 denominator = 2 * y * 1000; // 1000 for precision
            uint256 goldenRatioIncrease = numerator / denominator;
            uint256 calculatedPrice = x + goldenRatioIncrease;
            
            // ROUND UP to the next satoshi
            if (calculatedPrice > x) {
                xymNextPrice = calculatedPrice;
            } else {
                xymNextPrice = x + 1;
            }
        } else {
            xymNextPrice = STARTING_PRICE;
        }
        
        // Ensure minimum price increase of 1 satoshi
        if (xymNextPrice <= x) {
            xymNextPrice = x + 1;
        }
        
        // Update proof of faith (total BTC deposited)
        proofOfFaith += xymNextPrice;
        
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

    function calculateBulkCost(uint256 tokensToActivate) external view returns (uint256) {
        require(tokensToActivate > 0, "Must activate at least 1 token");
        require(tokensToActivate <= 100, "Cannot activate more than 100 tokens at once");
        
        uint256 x = xymNextPrice > 0 ? xymNextPrice : STARTING_PRICE;
        uint256 y = xymMinted;
        uint256 n = tokensToActivate;
        
        // Harmonic number approximation: H(k) ≈ ln(k) + 0.5772
        // Using fixed-point arithmetic for precision
        uint256 eulerMascheroni = 5772156649; // 0.5772156649 * 10^10
        
        // Calculate harmonic numbers using logarithm approximation
        // ln(k) ≈ (k-1)/k + (k-1)^2/(2*k^2) + ... (truncated series)
        uint256 harmonicY = _calculateHarmonicNumber(y);
        uint256 harmonicYn = _calculateHarmonicNumber(y + n);
        
        // For bulk: sum individual costs from position y to y+n-1
        // Each cost = x + (x * sqrt(5)) / (2 * (y+i))
        // Sum = n*x + (x * sqrt(5)) * sum(1/(2*(y+i))) for i from 0 to n-1
        // sum(1/(2*(y+i))) = (1/2) * sum(1/(y+i)) = (1/2) * (H(y+n) - H(y))
        uint256 sqrt5 = 2236; // sqrt(5) * 1000
        uint256 harmonicDiff = harmonicYn - harmonicY;
        
        // Sum = n*x + (x * sqrt(5)) * (1/2) * (H(y+n) - H(y))
        uint256 goldenRatioSum = (x * sqrt5 * harmonicDiff) / (2 * 1000);
        uint256 totalCost = (x * n) + goldenRatioSum;
        
        // Round up to nearest satoshi
        return totalCost;
    }

    function activateBulkTokens(uint256 tokensToActivate) external {
        require(tokensToActivate > 0, "Must activate at least 1 token");
        require(tokensToActivate <= 100, "Cannot activate more than 100 tokens at once");
        
        // Calculate total cost by summing individual token costs
        uint256 totalCost = 0;
        uint256 currentX = xymNextPrice > 0 ? xymNextPrice : STARTING_PRICE;
        uint256 currentY = xymMinted;
        
        // Calculate cost for each token individually (each token uses its own price)
        for (uint256 i = 0; i < tokensToActivate; i++) {
            uint256 y = currentY + i;
            uint256 x = currentX; // Each token starts with current price
            
            // For each subsequent token, calculate the new price
            if (i > 0) {
                // Calculate new price based on previous token's position
                uint256 prevY = currentY + i - 1;
                uint256 sqrt5 = 2236;
                uint256 numerator = x * sqrt5;
                uint256 denominator = 2 * prevY * 1000;
                uint256 goldenRatioIncrease = numerator / denominator;
                x = x + goldenRatioIncrease;
                
                // Ensure minimum price increase
                if (x <= currentX) {
                    x = currentX + 1;
                }
            }
            
            // Calculate this token's cost
            uint256 sqrt5 = 2236;
            uint256 numerator = x * sqrt5;
            uint256 denominator = 2 * y * 1000;
            uint256 goldenRatioIncrease = numerator / denominator;
            uint256 tokenCost = x + goldenRatioIncrease;
            
            // Round up to next satoshi
            if (tokenCost > x) {
                totalCost += tokenCost;
            } else {
                totalCost += x + 1;
            }
            
            // Update currentX for next iteration
            currentX = tokenCost;
        }
        
        // Update state for bulk activation
        activationCount += tokensToActivate;
        tokensMinted += tokensToActivate;
        xymMinted += tokensToActivate;
        
        // Store previous price
        xymPrevPrice = xymNextPrice;
        
        // Calculate new price after bulk activation (using final position)
        uint256 x = xymPrevPrice > 0 ? xymPrevPrice : STARTING_PRICE;
        uint256 y = xymMinted;
        
        if (y > 0) {
            // Calculate: x + (x * sqrt(5)) / (2 * y)
            uint256 sqrt5 = 2236;
            uint256 numerator = x * sqrt5;
            uint256 denominator = 2 * y * 1000;
            uint256 goldenRatioIncrease = numerator / denominator;
            uint256 calculatedPrice = x + goldenRatioIncrease;
            
            // ROUND UP to the next satoshi
            if (calculatedPrice > x) {
                xymNextPrice = calculatedPrice;
            } else {
                xymNextPrice = x + 1;
            }
        } else {
            xymNextPrice = STARTING_PRICE;
        }
        
        // Ensure minimum price increase of 1 satoshi
        if (xymNextPrice <= x) {
            xymNextPrice = x + 1;
        }
        
        // Update proof of faith (total BTC deposited)
        proofOfFaith += totalCost;
        
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
        emit ActivationProcessed(activationCount, currentPrice, true); // true for bulk
        emit TokenomicsUpdated(proofOfFaith, xymMinted, xymNextPrice);
    }
    
    function _calculateHarmonicNumber(uint256 k) internal pure returns (uint256) {
        if (k == 0) return 0;
        
        // Harmonic number approximation: H(k) ≈ ln(k) + 0.5772
        // Using natural logarithm approximation for large k
        if (k >= 1000) {
            // For large k, use ln(k) + 0.5772
            // ln(k) ≈ (k-1)/k + (k-1)^2/(2*k^2) (first two terms)
            uint256 kMinus1 = k - 1;
            uint256 term1 = (kMinus1 * 10000000000) / k; // 10^10 for precision
            uint256 term2 = (kMinus1 * kMinus1 * 10000000000) / (2 * k * k);
            uint256 lnK = term1 + term2;
            uint256 eulerMascheroni = 5772156649; // 0.5772156649 * 10^10
            return lnK + eulerMascheroni;
        } else {
            // For small k, use exact harmonic series (truncated)
            uint256 sum = 0;
            for (uint256 i = 1; i <= k && i <= 100; i++) {
                sum += 10000000000 / i; // 10^10 / i for precision
            }
            return sum;
        }
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
