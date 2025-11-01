// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title XMBLTokenRegistry
 * @dev Registry for mapping token IDs between Stacks and Base networks
 * Maintains bidirectional mappings and tracks token origin
 */
contract XMBLTokenRegistry is Ownable {
    // Bridge contract address (only bridge can update mappings)
    address public bridgeContract;
    
    // Bidirectional mappings
    mapping(uint256 => uint256) public stacksToBase; // stacksTokenId => baseTokenId
    mapping(uint256 => uint256) public baseToStacks; // baseTokenId => stacksTokenId
    
    // Origin tracking: true = originated on Stacks, false = originated on Base
    mapping(uint256 => bool) public tokenOrigin; // baseTokenId => isStacksOrigin
    
    // Events
    event TokensMapped(
        uint256 indexed stacksTokenId,
        uint256 indexed baseTokenId,
        bool isStacksOrigin
    );
    
    error NotBridge();
    error MappingExists();
    error InvalidTokenId();
    
    constructor() {}
    
    /**
     * @dev Set bridge contract address (only owner)
     */
    function setBridgeContract(address _bridgeContract) external onlyOwner {
        require(_bridgeContract != address(0), "Bridge cannot be zero");
        bridgeContract = _bridgeContract;
    }
    
    /**
     * @dev Map tokens between chains (only bridge can call)
     * @param stacksTokenId Token ID on Stacks
     * @param baseTokenId Token ID on Base
     * @param isFromStacks True if token originated on Stacks
     */
    function mapTokens(
        uint256 stacksTokenId,
        uint256 baseTokenId,
        bool isFromStacks
    ) external {
        require(msg.sender == bridgeContract, "Not bridge");
        require(stacksTokenId > 0, "Invalid Stacks token ID");
        require(baseTokenId > 0, "Invalid Base token ID");
        
        // Prevent duplicate mappings
        if (isFromStacks) {
            require(stacksToBase[stacksTokenId] == 0, "Mapping exists");
            require(baseToStacks[baseTokenId] == 0, "Mapping exists");
            
            stacksToBase[stacksTokenId] = baseTokenId;
            baseToStacks[baseTokenId] = stacksTokenId;
            tokenOrigin[baseTokenId] = true;
        } else {
            require(baseToStacks[baseTokenId] == 0, "Mapping exists");
            require(stacksToBase[stacksTokenId] == 0, "Mapping exists");
            
            baseToStacks[baseTokenId] = stacksTokenId;
            stacksToBase[stacksTokenId] = baseTokenId;
            tokenOrigin[baseTokenId] = false;
        }
        
        emit TokensMapped(stacksTokenId, baseTokenId, isFromStacks);
    }
    
    /**
     * @dev Get Base token ID from Stacks token ID
     */
    function getBaseTokenId(uint256 stacksTokenId) external view returns (uint256) {
        return stacksToBase[stacksTokenId];
    }
    
    /**
     * @dev Get Stacks token ID from Base token ID
     */
    function getStacksTokenId(uint256 baseTokenId) external view returns (uint256) {
        return baseToStacks[baseTokenId];
    }
    
    /**
     * @dev Check if token originated on Stacks
     */
    function isStacksOrigin(uint256 baseTokenId) external view returns (bool) {
        return tokenOrigin[baseTokenId];
    }
    
    /**
     * @dev Check if tokens are mapped
     */
    function areMapped(uint256 stacksTokenId, uint256 baseTokenId) external view returns (bool) {
        return stacksToBase[stacksTokenId] == baseTokenId && 
               baseToStacks[baseTokenId] == stacksTokenId;
    }
}

