// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./XMBLTokenBase.sol";
import "./XMBLTokenRegistry.sol";

/**
 * @title XMBLTokenBridge
 * @dev Bridge contract for cross-chain NFT transfers between Base and Stacks
 * Uses Wormhole for cross-chain messaging
 */
contract XMBLTokenBridge is Ownable, ReentrancyGuard {
    // Wormhole core contract address (Base network)
    address public immutable wormholeCore;
    
    // XMBL token contract
    XMBLTokenBase public immutable tokenContract;
    
    // Token registry for ID mapping
    XMBLTokenRegistry public immutable registry;
    
    // Stacks chain ID in Wormhole (to be configured)
    uint16 public stacksChainId;
    
    // Bridge state tracking
    mapping(bytes32 => bool) public completedTransfers; // Prevents replay attacks
    mapping(uint256 => bool) public bridgedTokens; // Tracks bridged tokens on Base
    
    // Events
    event BridgeInitiated(
        uint256 indexed tokenId,
        address indexed owner,
        uint16 targetChain,
        bytes32 indexed messageId
    );
    
    event BridgeCompleted(
        uint256 indexed sourceTokenId,
        uint256 indexed targetTokenId,
        address indexed recipient,
        uint16 sourceChain
    );
    
    event BridgeFailed(
        uint256 indexed tokenId,
        address indexed owner,
        string reason
    );
    
    error InvalidChainId();
    error TokenNotFound();
    error AlreadyBridged();
    error InvalidWormholeMessage();
    error TransferAlreadyCompleted();
    
    constructor(
        address _wormholeCore,
        address _tokenContract,
        address _registry,
        uint16 _stacksChainId
    ) {
        require(_wormholeCore != address(0), "Wormhole core cannot be zero");
        require(_tokenContract != address(0), "Token contract cannot be zero");
        require(_registry != address(0), "Registry cannot be zero");
        
        wormholeCore = _wormholeCore;
        tokenContract = XMBLTokenBase(_tokenContract);
        registry = XMBLTokenRegistry(_registry);
        stacksChainId = _stacksChainId;
    }
    
    /**
     * @dev Bridge NFT from Base to Stacks
     * @param tokenId Token ID to bridge
     */
    function bridgeToStacks(uint256 tokenId) external nonReentrant {
        // Verify token exists and user owns it
        require(tokenContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!bridgedTokens[tokenId], "Token already bridged");
        
        // Check if token is listed (must unlist first)
        XMBLTokenBase.Listing memory listing = tokenContract.getListing(tokenId);
        require(!listing.exists, "Token must be unlisted before bridging");
        
        // Mark token as bridged on token contract (prevents transfers and listings)
        tokenContract.markAsBridged(tokenId);
        bridgedTokens[tokenId] = true;
        
        // Get token price for state sync
        uint256 tokenPrice = tokenContract.tokenPrices(tokenId);
        
        // Encode bridge message
        bytes memory message = abi.encode(
            tokenId,
            msg.sender,
            tokenPrice,
            block.chainid // Source chain ID
        );
        
        // In production, this would call Wormhole to send message
        // For now, emit event that off-chain service will monitor
        bytes32 messageId = keccak256(abi.encodePacked(
            tokenId,
            msg.sender,
            stacksChainId,
            block.timestamp
        ));
        
        emit BridgeInitiated(tokenId, msg.sender, stacksChainId, messageId);
        
        // Note: Actual Wormhole integration would be:
        // uint64 sequence = IWormhole(wormholeCore).publishMessage(
        //     nonce,
        //     message,
        //     consistencyLevel
        // );
    }
    
    /**
     * @dev Receive NFT from Stacks (called by Wormhole relayer or off-chain service)
     * @param messageId Wormhole message ID to prevent replay
     * @param sourceTokenId Original token ID on Stacks
     * @param recipient Address to receive NFT on Base
     * @param tokenPrice Token price for state tracking
     * @param sourceChain Chain ID where token originated
     */
    function receiveFromStacks(
        bytes32 messageId,
        uint256 sourceTokenId,
        address recipient,
        uint256 tokenPrice,
        uint16 sourceChain
    ) external nonReentrant {
        require(sourceChain == stacksChainId, "Invalid source chain");
        require(!completedTransfers[messageId], "Transfer already completed");
        require(recipient != address(0), "Invalid recipient");
        
        // In production, verify Wormhole message:
        // (IWormhole.VM memory vm, bool valid, string memory reason) = 
        //     IWormhole(wormholeCore).parseAndVerifyVM(message);
        // require(valid, reason);
        
        // Check if token already mapped
        uint256 existingBaseTokenId = registry.stacksToBase(sourceTokenId);
        require(existingBaseTokenId == 0, "Token already bridged");
        
        // Get next token ID and mint NFT
        uint256 newTokenId = tokenContract.getNextTokenId();
        tokenContract.mintFromBridge(recipient, newTokenId, tokenPrice);
        tokenContract.incrementTokenIdCounter();
        
        // Update registry
        registry.mapTokens(sourceTokenId, newTokenId, true); // true = origin is Stacks
        
        // Mark transfer as completed
        completedTransfers[messageId] = true;
        bridgedTokens[newTokenId] = false; // New token is not bridged (it's native to Base now)
        
        emit BridgeCompleted(sourceTokenId, newTokenId, recipient, sourceChain);
    }
    
    /**
     * @dev Check if token is bridged
     */
    function isBridged(uint256 tokenId) external view returns (bool) {
        return bridgedTokens[tokenId];
    }
    
    /**
     * @dev Unlock token after failed bridge (owner only)
     */
    function unlockToken(uint256 tokenId) external onlyOwner {
        bridgedTokens[tokenId] = false;
    }
    
    /**
     * @dev Update Stacks chain ID
     */
    function setStacksChainId(uint16 _stacksChainId) external onlyOwner {
        require(_stacksChainId > 0, "Invalid chain ID");
        stacksChainId = _stacksChainId;
    }
}

