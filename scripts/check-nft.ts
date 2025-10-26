import hre from 'hardhat';
import { config } from 'dotenv';

config();

async function main() {
    console.log('🔍 Checking XMBLToken NFT Status');
    console.log('================================');
    
    // Get the deployed XMBLToken contract
    const xmblTokenAddress = '0x99A264D087958B6744b4cdA41EA64531321f9BC0';
    
    // XMBLToken ABI (minimal for checking)
    const tokenABI = [
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address owner) view returns (uint256)",
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function tokenURI(uint256 tokenId) view returns (string)",
        "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
    ];
    
    // Create provider and wallet like other scripts
    const provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com');
    const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
    console.log(`Using account: ${wallet.address}`);
    
    const xmblToken = new hre.ethers.Contract(xmblTokenAddress, tokenABI, wallet);
    
    try {
        // Check total supply
        const totalSupply = await xmblToken.totalSupply();
        console.log(`Total NFTs minted: ${totalSupply.toString()}`);
        
        // Check wallet's balance
        const walletBalance = await xmblToken.balanceOf(wallet.address);
        console.log(`Wallet NFT balance: ${walletBalance.toString()}`);
        
        // Get all token IDs owned by wallet
        if (walletBalance > 0) {
            console.log(`\n📋 Token IDs owned by wallet:`);
            for (let i = 0; i < walletBalance; i++) {
                try {
                    const tokenId = await xmblToken.tokenOfOwnerByIndex(wallet.address, i);
                    console.log(`  Token #${tokenId.toString()}`);
                } catch (error) {
                    console.log(`  Error getting token at index ${i}: ${error.message}`);
                }
            }
        }
        
        // If there are NFTs, check the first one
        if (totalSupply > 0) {
            const firstTokenId = 1;
            try {
                const owner = await xmblToken.ownerOf(firstTokenId);
                console.log(`\nOwner of token #${firstTokenId}: ${owner}`);
                
                const tokenURI = await xmblToken.tokenURI(firstTokenId);
                console.log(`Token URI: ${tokenURI}`);
            } catch (error) {
                console.log(`Error checking token #${firstTokenId}: ${error.message}`);
            }
        }
        
        // Check if the contract is properly configured
        console.log('\n📊 Contract Status:');
        console.log(`XMBLToken Address: ${xmblTokenAddress}`);
        console.log(`Total Supply: ${totalSupply.toString()}`);
        console.log(`Wallet Balance: ${walletBalance.toString()}`);
        
    } catch (error) {
        console.error('Error checking XMBLToken:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
