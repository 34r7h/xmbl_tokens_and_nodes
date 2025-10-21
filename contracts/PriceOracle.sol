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
    
    IPyth public immutable pyth;
    bytes32 public immutable btcUsdPriceId;
    
    uint256 public currentPrice = STARTING_PRICE;
    uint256 public tokensMinted = 0;
    uint256 public activationCount = 0;
    
    mapping(uint256 => uint256) public activationPrices;
    mapping(uint256 => bool) public activationSettled;
    
    event PriceUpdated(uint256 newPrice, uint256 tokensMinted);
    event ActivationProcessed(uint256 activationId, uint256 price, bool settled);
    event SettlementFailed(uint256 activationId);
    
    constructor(address _pyth, bytes32 _btcUsdPriceId) {
        pyth = IPyth(_pyth);
        btcUsdPriceId = _btcUsdPriceId;
    }
    
    /**
     * @dev Calculate token price using golden ratio formula: x / (Phi * y)
     * Always rounds UP to nearest satoshi
     */
    function calculatePrice(uint256 _tokensMinted) public pure returns (uint256) {
        if (_tokensMinted == 0) return STARTING_PRICE;
        
        // Calculate: 1 / (Phi * tokensMinted)
        // Using PHI = 1618 (1.618 * 1000)
        uint256 numerator = 1000; // 1 * 1000 for precision
        uint256 denominator = (PHI * _tokensMinted) / 1000;
        
        if (denominator == 0) return STARTING_PRICE;
        
        uint256 price = numerator / denominator;
        
        // Ensure minimum price of 1 satoshi
        if (price == 0) price = 1;
        
        // Round UP to nearest satoshi
        if (price % SATOSHI_PRECISION != 0) {
            price = ((price / SATOSHI_PRECISION) + 1) * SATOSHI_PRECISION;
        }
        
        return price;
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
     * @dev Increase price on activation
     */
    function activateToken() external {
        activationCount++;
        tokensMinted++;
        updatePrice();
        emit ActivationProcessed(activationCount, currentPrice, false);
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
}
