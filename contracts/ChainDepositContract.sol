// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DepositManager.sol";
import "./PriceOracle.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ChainDepositContract
 * @dev Deployed per chain to accept user deposits
 * Creates cross-chain intents via Avail Nexus
 * Implements "Bridge & Execute" pattern
 */
contract ChainDepositContract is ReentrancyGuard, Ownable {
    DepositManager public immutable depositManager;
    PriceOracle public immutable priceOracle;
    
    // Supported tokens for deposits
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenDecimals;
    
    // Deposit tracking
    struct Deposit {
        uint256 id;
        address user;
        address token;
        uint256 amount;
        uint256 btcEquivalent;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(uint256 => Deposit) public deposits;
    mapping(address => uint256[]) public userDeposits;
    
    uint256 public nextDepositId = 1;
    uint256 public totalDeposits = 0;
    uint256 public totalBtcEquivalent = 0;
    
    event DepositCreated(
        uint256 indexed depositId,
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 btcEquivalent
    );
    
    event IntentCreated(
        uint256 indexed depositId,
        uint256 activationId,
        string intentData
    );
    
    event BtcEquivalentCalculated(
        address indexed token,
        uint256 amount,
        uint256 btcEquivalent
    );
    
    constructor(
        address _depositManager,
        address _priceOracle
    ) {
        depositManager = DepositManager(_depositManager);
        priceOracle = PriceOracle(_priceOracle);
    }
    
    /**
     * @dev Add supported token for deposits
     */
    function addSupportedToken(address token, uint256 decimals) external onlyOwner {
        supportedTokens[token] = true;
        tokenDecimals[token] = decimals;
    }
    
    /**
     * @dev Remove supported token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        tokenDecimals[token] = 0;
    }
    
    /**
     * @dev Deposit tokens and create cross-chain intent
     */
    function deposit(
        address token,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be positive");
        
        // Transfer tokens from user
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Calculate BTC equivalent using current price
        uint256 btcEquivalent = calculateBtcEquivalent(token, amount);
        
        // Create deposit record
        uint256 depositId = nextDepositId++;
        deposits[depositId] = Deposit({
            id: depositId,
            user: msg.sender,
            token: token,
            amount: amount,
            btcEquivalent: btcEquivalent,
            timestamp: block.timestamp,
            processed: false
        });
        
        userDeposits[msg.sender].push(depositId);
        totalDeposits++;
        totalBtcEquivalent += btcEquivalent;
        
        emit DepositCreated(depositId, msg.sender, token, amount, btcEquivalent);
        
        return depositId;
    }
    
    /**
     * @dev Create cross-chain intent for deposit
     * Implements "Bridge & Execute" pattern
     */
    function createIntent(uint256 depositId) external onlyOwner returns (uint256) {
        require(depositId < nextDepositId, "Invalid deposit ID");
        require(!deposits[depositId].processed, "Already processed");
        
        Deposit storage depositData = deposits[depositId];
        depositData.processed = true;
        
        // Send deposit to central manager
        uint256 activationId = depositManager.receiveDeposit(
            depositData.user,
            depositData.amount,
            depositData.btcEquivalent
        );
        
        // Create intent data for Avail Nexus
        string memory intentData = createIntentData(depositData, activationId);
        
        emit IntentCreated(depositId, activationId, intentData);
        
        return activationId;
    }
    
    /**
     * @dev Calculate BTC equivalent for token amount
     */
    function calculateBtcEquivalent(address token, uint256 amount) public returns (uint256) {
        // Get current BTC price from oracle
        uint256 btcPrice = priceOracle.getBtcPrice();
        
        // Get token decimals
        uint256 tokenDecimalsValue = tokenDecimals[token];
        if (tokenDecimalsValue == 0) {
            tokenDecimalsValue = 18; // Default to 18 decimals
        }
        
        // Calculate equivalent (simplified for demo)
        // In production, this would use actual price feeds
        uint256 btcEquivalent = (amount * btcPrice) / (10**tokenDecimalsValue);
        
        emit BtcEquivalentCalculated(token, amount, btcEquivalent);
        
        return btcEquivalent;
    }
    
    /**
     * @dev Create intent data for Avail Nexus
     */
    function createIntentData(Deposit memory depositData, uint256 activationId) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"type":"bridge_execute",',
            '"depositId":', uint2str(depositData.id), ',',
            '"activationId":', uint2str(activationId), ',',
            '"user":"', addressToString(depositData.user), '",',
            '"token":"', addressToString(depositData.token), '",',
            '"amount":', uint2str(depositData.amount), ',',
            '"btcEquivalent":', uint2str(depositData.btcEquivalent),
            '}'
        ));
    }
    
    /**
     * @dev Get deposit details
     */
    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        return deposits[depositId];
    }
    
    /**
     * @dev Get user's deposits
     */
    function getUserDeposits(address user) external view returns (uint256[] memory) {
        return userDeposits[user];
    }
    
    /**
     * @dev Get contract statistics
     */
    function getStats() external view returns (
        uint256 totalDepositsCount,
        uint256 totalBtcEquivalentAmount,
        uint256 nextDepositIdValue
    ) {
        totalDepositsCount = totalDeposits;
        totalBtcEquivalentAmount = totalBtcEquivalent;
        nextDepositIdValue = nextDepositId;
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    // Helper functions
    function uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    function addressToString(address addr) internal pure returns (string memory) {
        return uint2str(uint256(uint160(addr)));
    }
}
