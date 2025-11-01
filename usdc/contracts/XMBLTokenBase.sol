// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./XMBLOracleBase.sol";

/**
 * @title XMBLTokenBase
 * @dev ERC-721 NFT token contract for Base network with USDC/WBTC pricing
 * Implements tokenomics with NFT minting, pricing algorithm, pool management, and token resale
 */
contract XMBLTokenBase is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant STARTING_PRICE = 1; // 1 wei (scaled for WBTC: 1 satoshi = 1e10 wei for WBTC)
    uint256 public constant MIN_LIQUIDITY_PERCENT = 10; // 10%
    uint256 public constant MAX_LIQUIDITY_PERCENT = 95; // 95%
    uint256 public constant TARGET_BTC_FOR_MAX_LIQUIDITY = 100 * 1e8; // 100 BTC in satoshis (for WBTC: 100 * 1e8 * 1e10 = 1e20 wei)
    uint256 public constant SQRT5_PRECISION = 2236; // sqrt(5) ≈ 2.236, using 2236/1000 for precision
    uint256 public constant PRECISION_MULTIPLIER = 1000;
    uint256 public constant WBTC_DECIMALS = 8; // WBTC has 8 decimals
    uint256 public constant USDC_DECIMALS = 6; // USDC has 6 decimals
    uint256 public constant WBTC_TO_WEI = 1e10; // 1 WBTC satoshi = 1e10 wei

    // State variables
    IERC20 public immutable usdcToken;
    IERC20 public immutable wbtcToken;
    
    address public developmentPool;
    address public liquidityPool;
    
    // Bridge and Oracle integration
    address public bridgeContract;
    address public oracleContract;
    mapping(uint256 => bool) public bridgedTokens; // Tracks bridged tokens
    
    Counters.Counter private _tokenIdCounter;
    uint256 public tokensMinted;
    uint256 public currentPrice; // Price in WBTC satoshis (will be converted to payment token)
    uint256 public proofOfFaith; // Total BTC deposited (in WBTC satoshis) - synced from oracle
    
    // Token listing system (FIFO queue)
    uint256 public listedTokensCount;
    mapping(uint256 => Listing) public listedTokens;
    mapping(uint256 => uint256) public tokenListOrder; // index => tokenId
    mapping(uint256 => uint256) public tokenListIndex; // tokenId => index
    
    // Token data
    mapping(uint256 => uint256) public tokenPrices;
    
    struct Listing {
        address seller;
        uint256 askingPrice; // In payment token (USDC or WBTC)
        bool exists;
    }
    
    // Events
    event NFTMintEvent(uint256 indexed id, address indexed recipient, uint256 price);
    event NFTResaleEvent(uint256 indexed id, address indexed seller, uint256 askingPrice);
    event NFTUnlistedEvent(uint256 indexed id);
    event NFTSoldEvent(uint256 indexed id, address indexed seller, address indexed buyer, uint256 price);
    event PriceUpdateEvent(uint256 indexed tokenId, uint256 price);
    event PoolSplitEvent(uint256 devAmount, uint256 liquidityAmount, uint256 totalBtc);
    event PoolDistributionEvent(uint256 indexed tokenId, uint256 devAmount, uint256 liquidityAmount);
    
    // Errors
    error NotOwner();
    error ContractPaused();
    error InsufficientPayment();
    error InvalidAddress();
    error TokenNotListed();
    error TokenNotOwned();
    error TokenAlreadyListed();
    error NoListedTokens();
    error NotBridge();
    error NotOracle();
    error TokenBridged();
    
    constructor(
        address _usdcToken,
        address _wbtcToken,
        address _developmentPool,
        address _liquidityPool
    ) ERC721("XMBL Token Base", "XMBL-BASE") {
        require(_usdcToken != address(0), "USDC token cannot be zero");
        require(_wbtcToken != address(0), "WBTC token cannot be zero");
        require(_developmentPool != address(0), "Development pool cannot be zero");
        require(_liquidityPool != address(0), "Liquidity pool cannot be zero");
        
        usdcToken = IERC20(_usdcToken);
        wbtcToken = IERC20(_wbtcToken);
        developmentPool = _developmentPool;
        liquidityPool = _liquidityPool;
        
        currentPrice = STARTING_PRICE;
        _tokenIdCounter.increment(); // Start with token ID 1
    }
    
    /**
     * @dev Calculate price using formula: cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))
     * @param previousPrice Previous price in WBTC satoshis
     * @param tokenNumber Token number (tokens minted + 1)
     * @return New price in WBTC satoshis
     */
    function calculatePrice(uint256 previousPrice, uint256 tokenNumber) public pure returns (uint256) {
        if (tokenNumber == 0) return STARTING_PRICE;
        
        // Calculate (cost * sqrt(5)) with precision
        uint256 numerator = previousPrice * SQRT5_PRECISION;
        // Calculate (2 * x) with precision
        uint256 denominator = (2 * tokenNumber) * PRECISION_MULTIPLIER;
        // Division: (cost * sqrt(5)) / (2 * x)
        uint256 divisionResult = numerator / denominator;
        // Check remainder for Math.ceil
        uint256 remainder = numerator % denominator;
        // Round up if remainder > 0
        uint256 increase = remainder > 0 ? divisionResult + 1 : divisionResult;
        uint256 newPrice = previousPrice + increase;
        
        // Ensure minimum of 1 satoshi
        return newPrice == 0 ? 1 : newPrice;
    }
    
    /**
     * @dev Calculate liquidity percentage using logarithmic curve
     * @param totalBtc Total BTC in WBTC satoshis
     * @return Liquidity percentage (10-95)
     */
    function calculateLiquidityPercentage(uint256 totalBtc) public pure returns (uint256) {
        if (totalBtc == 0) return MIN_LIQUIDITY_PERCENT;
        
        uint256 range = MAX_LIQUIDITY_PERCENT - MIN_LIQUIDITY_PERCENT;
        // Calculate progress using cubic root approximation for log-like curve
        uint256 normalized = (totalBtc * PRECISION_MULTIPLIER) / TARGET_BTC_FOR_MAX_LIQUIDITY * PRECISION_MULTIPLIER;
        
        uint256 progress;
        if (totalBtc >= TARGET_BTC_FOR_MAX_LIQUIDITY) {
            progress = PRECISION_MULTIPLIER;
        } else {
            if (normalized <= PRECISION_MULTIPLIER * PRECISION_MULTIPLIER) {
                progress = normalized / PRECISION_MULTIPLIER;
            } else {
                progress = PRECISION_MULTIPLIER;
            }
        }
        
        // Clamp progress to [0, 1] range
        if (progress > PRECISION_MULTIPLIER) progress = PRECISION_MULTIPLIER;
        
        uint256 liquidityIncrease = (range * progress) / PRECISION_MULTIPLIER;
        uint256 liquidityPercent = MIN_LIQUIDITY_PERCENT + liquidityIncrease;
        
        // Clamp final result
        if (liquidityPercent > MAX_LIQUIDITY_PERCENT) return MAX_LIQUIDITY_PERCENT;
        if (liquidityPercent < MIN_LIQUIDITY_PERCENT) return MIN_LIQUIDITY_PERCENT;
        
        return liquidityPercent;
    }
    
    /**
     * @dev Split BTC amount between dev and liquidity pools
     * @param totalBtc Total BTC in WBTC satoshis
     * @return devAmount Amount for development pool
     * @return liquidityAmount Amount for liquidity pool
     */
    function calculatePoolSplit(uint256 totalBtc) public pure returns (uint256 devAmount, uint256 liquidityAmount) {
        uint256 liquidityPercent = calculateLiquidityPercentage(totalBtc);
        liquidityAmount = (totalBtc * liquidityPercent) / 100;
        devAmount = totalBtc - liquidityAmount; // Ensure no rounding errors
    }
    
    /**
     * @dev Get first available listed token ID (preferred order)
     */
    function getFirstListedToken() public view returns (uint256) {
        if (listedTokensCount == 0) return 0;
        return tokenListOrder[0];
    }
    
    /**
     * @dev Convert WBTC satoshis to payment token amount
     * @param wbtcSats WBTC amount in satoshis (1e8 scale)
     * @param useUSDC If true, convert to USDC; if false, use WBTC
     * @return Amount in payment token (scaled to token decimals)
     */
    function convertWBTCToPaymentToken(uint256 wbtcSats, bool useUSDC) public pure returns (uint256) {
        // For simplicity, we use 1:1 ratio for WBTC
        // In production, this should query WBTC/USDC price oracle (Chainlink)
        // For now: 1 WBTC satoshi (1e8) = 1e10 wei for WBTC
        
        if (useUSDC) {
            // Convert WBTC to USDC using approximate price (simplified)
            // 1 BTC ≈ $50,000, 1 USDC = $1
            // 1 BTC satoshi ≈ $0.0005 ≈ 0.0005 USDC
            // So 1 WBTC satoshi = 0.0005 USDC = 500 micro-USDC (USDC has 6 decimals)
            // wbtcSats is in 1e8 scale, USDC needs 1e6 scale
            // So: wbtcSats * 500 will give us the correct USDC amount in 1e6 scale
            return wbtcSats * 500; // Simplified: multiply by 500 for USDC (6 decimals)
        } else {
            // For WBTC: 1 satoshi (1e8) = 1e10 wei
            // WBTC has 8 decimals, so 1 satoshi = 1e8 units
            // But we store as wei, so need to scale: 1e8 * 1e10 = 1e18 wei
            // Actually, WBTC uses 8 decimals, so 1 satoshi = 1 unit in WBTC contract
            // So wbtcSats directly represents the amount (scaled by 1e8 internally)
            return wbtcSats * 1e10; // Convert satoshis to wei equivalent
        }
    }
    
    /**
     * @dev Unified buy function: checks listed tokens first, then mints if none available
     * @param paymentAmount Amount in payment token (USDC or WBTC)
     * @param useUSDC If true, payment is in USDC; if false, payment is in WBTC
     */
    function buy(uint256 paymentAmount, bool useUSDC) external nonReentrant whenNotPaused {
        uint256 firstListed = getFirstListedToken();
        
        if (firstListed > 0 && listedTokens[firstListed].exists) {
            buyListedToken(firstListed, paymentAmount, useUSDC);
        } else {
            mintNew(msg.sender, paymentAmount, useUSDC);
        }
    }
    
    /**
     * @dev Buy a specific listed token
     * @param tokenId Token ID to buy
     * @param paymentAmount Payment amount in payment token
     * @param useUSDC If true, payment is in USDC; if false, payment is in WBTC
     */
    function buyListedToken(uint256 tokenId, uint256 paymentAmount, bool useUSDC) public nonReentrant whenNotPaused {
        Listing memory listing = listedTokens[tokenId];
        require(listing.exists, "Token not listed");
        require(paymentAmount >= listing.askingPrice, "Insufficient payment");
        
        // Transfer payment from buyer to contract
        if (useUSDC) {
            usdcToken.safeTransferFrom(msg.sender, address(this), listing.askingPrice);
        } else {
            wbtcToken.safeTransferFrom(msg.sender, address(this), listing.askingPrice);
        }
        
        // Transfer NFT to buyer
        address seller = listing.seller;
        _transfer(seller, msg.sender, tokenId);
        
        // Remove from listings
        _removeListing(tokenId);
        
        // Send payment to seller
        if (useUSDC) {
            usdcToken.safeTransfer(seller, listing.askingPrice);
        } else {
            wbtcToken.safeTransfer(seller, listing.askingPrice);
        }
        
        emit NFTSoldEvent(tokenId, seller, msg.sender, listing.askingPrice);
    }
    
    /**
     * @dev Mint new NFT
     * @param recipient Recipient address
     * @param paymentAmount Payment amount in payment token
     * @param useUSDC If true, payment is in USDC; if false, payment is in WBTC
     */
    function mintNew(address recipient, uint256 paymentAmount, bool useUSDC) public nonReentrant whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        
        uint256 tokenNumber = tokensMinted + 1;
        uint256 newPriceWBTC = calculatePrice(currentPrice, tokenNumber);
        
        // Convert WBTC price to payment token amount
        uint256 requiredPayment = convertWBTCToPaymentToken(newPriceWBTC, useUSDC);
        require(paymentAmount >= requiredPayment, "Insufficient payment");
        
        // Transfer payment from user to contract
        if (useUSDC) {
            usdcToken.safeTransferFrom(msg.sender, address(this), requiredPayment);
        } else {
            wbtcToken.safeTransferFrom(msg.sender, address(this), requiredPayment);
        }
        
        // Calculate pool split based on updated proof of faith
        uint256 proofOfFaithNew = proofOfFaith + newPriceWBTC;
        (uint256 devAmount, uint256 liquidityAmount) = calculatePoolSplit(proofOfFaithNew);
        
        // Convert pool amounts to payment token
        uint256 devAmountPayment = convertWBTCToPaymentToken(devAmount, useUSDC);
        uint256 liquidityAmountPayment = convertWBTCToPaymentToken(liquidityAmount, useUSDC);
        
        // Update state
        tokensMinted++;
        currentPrice = newPriceWBTC;
        proofOfFaith = proofOfFaithNew;
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(recipient, tokenId);
        tokenPrices[tokenId] = newPriceWBTC;
        
      // Distribute payment to pools
      if (useUSDC) {
        usdcToken.safeTransfer(developmentPool, devAmountPayment);
        usdcToken.safeTransfer(liquidityPool, liquidityAmountPayment);
      } else {
        wbtcToken.safeTransfer(developmentPool, devAmountPayment);
        wbtcToken.safeTransfer(liquidityPool, liquidityAmountPayment);
      }
      
      emit NFTMintEvent(tokenId, recipient, newPriceWBTC);
      emit PriceUpdateEvent(tokenId, newPriceWBTC);
      emit PoolSplitEvent(devAmount, liquidityAmount, proofOfFaithNew);
      emit PoolDistributionEvent(tokenId, devAmountPayment, liquidityAmountPayment);
      
      // Notify oracle of state update
      if (oracleContract != address(0)) {
        XMBLOracleBase(oracleContract).updateBaseState(tokensMinted, proofOfFaithNew);
      }
    }
    
    /**
     * @dev List token for resale
     * @param tokenId Token ID to list
     * @param askingPrice Asking price in payment token (USDC or WBTC)
     */
    function listForSale(uint256 tokenId, uint256 askingPrice) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!listedTokens[tokenId].exists, "Token already listed");
        
        listedTokens[tokenId] = Listing({
            seller: msg.sender,
            askingPrice: askingPrice,
            exists: true
        });
        
        // Add to FIFO queue
        uint256 index = listedTokensCount;
        tokenListOrder[index] = tokenId;
        tokenListIndex[tokenId] = index;
        listedTokensCount++;
        
        emit NFTResaleEvent(tokenId, msg.sender, askingPrice);
    }
    
    /**
     * @dev Unlist token
     * @param tokenId Token ID to unlist
     */
    function unlist(uint256 tokenId) external {
        Listing memory listing = listedTokens[tokenId];
        require(listing.exists, "Token not listed");
        require(listing.seller == msg.sender, "Not seller");
        
        _removeListing(tokenId);
        emit NFTUnlistedEvent(tokenId);
    }
    
    /**
     * @dev Internal function to remove token from listings
     */
    function _removeListing(uint256 tokenId) internal {
        uint256 index = tokenListIndex[tokenId];
        
        // Shift remaining items
        for (uint256 i = index; i < listedTokensCount - 1; i++) {
            uint256 nextTokenId = tokenListOrder[i + 1];
            tokenListOrder[i] = nextTokenId;
            tokenListIndex[nextTokenId] = i;
        }
        
        delete tokenListOrder[listedTokensCount - 1];
        delete tokenListIndex[tokenId];
        delete listedTokens[tokenId];
        listedTokensCount--;
    }
    
    /**
     * @dev Override transfer to remove from listings if listed and check bridged status
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        // Prevent transfer if token is bridged
        require(!bridgedTokens[tokenId] || from == address(0), "Token is bridged");
        
        // If token is listed, remove from listings
        if (listedTokens[tokenId].exists && from != address(0)) {
            _removeListing(tokenId);
        }
        
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    // Owner functions
    function setDevelopmentPool(address _developmentPool) external onlyOwner {
        require(_developmentPool != address(0), "Invalid address");
        developmentPool = _developmentPool;
    }
    
    function setLiquidityPool(address _liquidityPool) external onlyOwner {
        require(_liquidityPool != address(0), "Invalid address");
        liquidityPool = _liquidityPool;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Set bridge contract address
     */
    function setBridgeContract(address _bridgeContract) external onlyOwner {
        require(_bridgeContract != address(0), "Bridge cannot be zero");
        bridgeContract = _bridgeContract;
    }
    
    /**
     * @dev Set oracle contract address
     */
    function setOracleContract(address _oracleContract) external onlyOwner {
        require(_oracleContract != address(0), "Oracle cannot be zero");
        oracleContract = _oracleContract;
    }
    
    /**
     * @dev Bridge function - mark token as bridged (only bridge contract)
     */
    function markAsBridged(uint256 tokenId) external {
        require(msg.sender == bridgeContract, "Not bridge");
        bridgedTokens[tokenId] = true;
    }
    
    /**
     * @dev Unlock token after bridge (only bridge contract)
     */
    function unlockBridgedToken(uint256 tokenId) external {
        require(msg.sender == bridgeContract, "Not bridge");
        bridgedTokens[tokenId] = false;
    }
    
    /**
     * @dev Mint NFT from bridge (only bridge contract)
     * Used when receiving NFT from Stacks
     */
    function mintFromBridge(
        address recipient,
        uint256 tokenId,
        uint256 tokenPrice
    ) external {
        require(msg.sender == bridgeContract, "Not bridge");
        require(recipient != address(0), "Invalid recipient");
        
        _safeMint(recipient, tokenId);
        tokenPrices[tokenId] = tokenPrice;
        tokensMinted++;
        
        emit NFTMintEvent(tokenId, recipient, tokenPrice);
    }
    
    /**
     * @dev Sync price from oracle (only oracle contract)
     */
    function syncPriceFromOracle(uint256 newPrice) external {
        require(msg.sender == oracleContract, "Not oracle");
        currentPrice = newPrice;
    }
    
    /**
     * @dev Sync proof of faith from oracle (only oracle contract)
     */
    function syncProofOfFaithFromOracle(uint256 newProofOfFaith) external {
        require(msg.sender == oracleContract, "Not oracle");
        proofOfFaith = newProofOfFaith;
    }
    
    /**
     * @dev Get token ID counter (for bridge to get next ID)
     */
    function getNextTokenId() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Increment token ID counter (bridge can call after minting)
     */
    function incrementTokenIdCounter() external {
        require(msg.sender == bridgeContract, "Not bridge");
        _tokenIdCounter.increment();
    }
    
    // View functions
    function getCurrentPrice() external view returns (uint256) {
        return currentPrice;
    }
    
    function getTokensMinted() external view returns (uint256) {
        return tokensMinted;
    }
    
    function getProofOfFaith() external view returns (uint256) {
        return proofOfFaith;
    }
    
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listedTokens[tokenId];
    }
    
    function getListedTokensCount() external view returns (uint256) {
        return listedTokensCount;
    }
    
    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

