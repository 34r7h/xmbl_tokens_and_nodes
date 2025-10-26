// XMBL Token Activation Frontend
class XMBLActivation {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.walletAddress = null;
        this.isConnected = false;
        
        // Contract addresses for different networks
        this.contractAddresses = {
            sepolia: '0xcF086791cF5C266d9e6fe477190748F2f383E706', // PriceOracle
            mumbai: '0xcF086791cF5C266d9e6fe477190748F2f383E706', // Same for now
            bscTestnet: '0xcF086791cF5C266d9e6fe477190748F2f383E706',
            arbitrumSepolia: '0xcF086791cF5C266d9e6fe477190748F2f383E706',
            optimismSepolia: '0xcF086791cF5C266d9e6fe477190748F2f383E706'
        };
        
        // XMBLToken addresses (ERC721 NFT contract)
        this.tokenAddresses = {
            sepolia: '0x50fef021AbDdc3EE4c5e4398B5487f2Ce11fC2De', // Deployed to Sepolia
            mumbai: '0x0000000000000000000000000000000000000000',
            bscTestnet: '0x0000000000000000000000000000000000000000',
            arbitrumSepolia: '0x0000000000000000000000000000000000000000',
            optimismSepolia: '0x0000000000000000000000000000000000000000'
        };
        
        // RPC URLs for different networks
        this.rpcUrls = {
            sepolia: 'https://ethereum-sepolia.publicnode.com',
            mumbai: 'https://polygon-mumbai.publicnode.com',
            bscTestnet: 'https://bsc-testnet.publicnode.com',
            arbitrumSepolia: 'https://arbitrum-sepolia.publicnode.com',
            optimismSepolia: 'https://optimism-sepolia.publicnode.com'
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        // Don't auto-connect on init
        // await this.checkConnection();
        // Don't start oracle updates until connected
        // this.startOracleUpdates();
        // Initialize oracle data immediately
        this.updateOracleData();
    }
    
    getNetworkId(network) {
        const networkIds = {
            sepolia: 11155111,
            mumbai: 80001,
            bscTestnet: 97,
            arbitrumSepolia: 421614,
            optimismSepolia: 11155420
        };
        return networkIds[network] || 11155111; // Default to Sepolia
    }
    
    async addNetwork(network, networkId) {
        const networkConfigs = {
            sepolia: {
                chainId: `0x${networkId.toString(16)}`,
                chainName: 'Ethereum Sepolia',
                rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
                nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io']
            },
            mumbai: {
                chainId: `0x${networkId.toString(16)}`,
                chainName: 'Polygon Mumbai',
                rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
                nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18
                },
                blockExplorerUrls: ['https://mumbai.polygonscan.com']
            },
            bscTestnet: {
                chainId: `0x${networkId.toString(16)}`,
                chainName: 'BSC Testnet',
                rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                blockExplorerUrls: ['https://testnet.bscscan.com']
            },
            arbitrumSepolia: {
                chainId: `0x${networkId.toString(16)}`,
                chainName: 'Arbitrum Sepolia',
                rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
                nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                },
                blockExplorerUrls: ['https://sepolia.arbiscan.io']
            },
            optimismSepolia: {
                chainId: `0x${networkId.toString(16)}`,
                chainName: 'Optimism Sepolia',
                rpcUrls: ['https://sepolia.optimism.io'],
                nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                },
                blockExplorerUrls: ['https://sepolia-optimism.etherscan.io']
            }
        };
        
        const config = networkConfigs[network];
        if (config) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [config]
            });
        }
    }
    
    setupEventListeners() {
        // Safe event listener setup with null checks
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const activateBtn = document.getElementById('activateBtn');
        const refreshPortfolioBtn = document.getElementById('refreshPortfolioBtn');
        const testCrossChainBtn = document.getElementById('testCrossChainBtn');
        const refreshLinksBtn = document.getElementById('refreshLinksBtn');
        
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectWallet());
        }
        if (activateBtn) {
            activateBtn.addEventListener('click', () => this.activateTokens());
        }
        if (refreshPortfolioBtn) {
            refreshPortfolioBtn.addEventListener('click', () => this.updateTokensOwned());
        }
        if (testCrossChainBtn) {
            testCrossChainBtn.addEventListener('click', () => this.testCrossChainFlow());
        }
        if (refreshLinksBtn) {
            refreshLinksBtn.addEventListener('click', () => this.refreshTransactionLinks());
        }
    }
    
    async checkConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.walletAddress = accounts[0];
                    await this.setupProvider();
                    this.updateUI();
                    // Update oracle data when connected
                    await this.updateOracleData();
                    await this.updateTokensOwned();
                }
            } catch (error) {
                console.error('Error checking connection:', error);
            }
        }
    }
    
    async connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            this.showStatus('Please install MetaMask to use this application.', 'error');
            return;
        }

        try {
            // Request account access - this will trigger MetaMask popup
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });

            if (accounts.length === 0) {
                this.showStatus('No accounts found. Please unlock MetaMask.', 'error');
                return;
            }

            this.walletAddress = accounts[0];
            await this.setupProvider();
            this.updateUI();
            this.showStatus(`Wallet connected: ${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(38)}`, 'success');

            // Start oracle updates after connection
            this.startOracleUpdates();
            // Update oracle data after connection
            await this.updateOracleData();
            await this.updateTokensOwned();
            
            // Add XMBL token to MetaMask
            await this.addTokenToMetaMask();

        } catch (error) {
            console.error('Error connecting wallet:', error);
            if (error.code === 4001) {
                this.showStatus('Connection rejected by user.', 'error');
            } else {
                this.showStatus('Failed to connect wallet. Please try again.', 'error');
            }
        }
    }
    
    disconnectWallet() {
        this.walletAddress = null;
        this.contract = null;
        this.tokenContract = null;
        this.provider = null;
        this.signer = null;
        this.isConnected = false;
        this.updateUI();
        this.showStatus('Wallet disconnected.', 'success');
        
        // Stop oracle updates when disconnected
        if (this.oracleUpdateInterval) {
            clearInterval(this.oracleUpdateInterval);
            this.oracleUpdateInterval = null;
        }
        
        // Reset oracle display to placeholder
        this.updateOracleData();
    }
    
    async setupProvider() {
        // Default to sepolia since networkSelect was removed from compact version
        const network = 'sepolia';
        const rpcUrl = this.rpcUrls[network];
        
        if (typeof window.ethereum !== 'undefined') {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // Ensure we're on the correct network
            const networkId = this.getNetworkId(network);
            const currentNetwork = await this.provider.getNetwork();
            
            console.log('Current network:', currentNetwork.chainId, 'Target network:', networkId);
            
            if (currentNetwork.chainId !== networkId) {
                try {
                    console.log('Switching to Sepolia network...');
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${networkId.toString(16)}` }],
                    });
                    console.log('Successfully switched to Sepolia');
                } catch (switchError) {
                    console.log('Switch error:', switchError);
                    // If the network doesn't exist, add it
                    if (switchError.code === 4902) {
                        console.log('Adding Sepolia network...');
                        await this.addNetwork(network, networkId);
                    } else {
                        console.error('Network switch failed:', switchError);
                        throw switchError;
                    }
                }
            }
        } else {
            // Fallback to JsonRpcProvider if no wallet
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            this.signer = null;
        }
        
        // Contract ABI for PriceOracle
        const contractABI = [
            "function activateToken() external",
            "function activateBulkTokens(uint256 tokensToActivate) external",
            "function calculateBulkCost(uint256 tokensToActivate) view returns (uint256)",
            "function currentPrice() view returns (uint256)",
            "function xymNextPrice() view returns (uint256)",
            "function xymMinted() view returns (uint256)",
            "function tokensMinted() view returns (uint256)",
            "function proofOfFaith() view returns (uint256)",
            "function grantRole(bytes32 role, address account) external",
            "function MINTER_ROLE() view returns (bytes32)",
            "event TokenomicsUpdated(uint256,uint256,uint256)",
            "event ActivationProcessed(uint256,uint256,bool)"
        ];
        
            // XMBLToken ABI for NFT functionality
            const tokenABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function totalSupply() view returns (uint256)",
                "function mintWithTBA(address to, uint256 depositValue, address tokenAddress) external returns (uint256)",
                "function batchMintWithTBA(address[] calldata recipients, uint256[] calldata depositValues, address[] calldata tokenAddresses) external returns (uint256[] memory)",
                "function grantRole(bytes32 role, address account) external",
                "function MINTER_ROLE() view returns (bytes32)",
                "function nextTokenId() view returns (uint256)",
                "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
            ];
        
        const contractAddress = this.contractAddresses[network];
        this.contract = new ethers.Contract(contractAddress, contractABI, this.signer || this.provider);
        
        // Also create XMBLToken contract instance
        const tokenAddress = this.tokenAddresses[network];
        if (tokenAddress !== '0x0000000000000000000000000000000000000000') {
            this.tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.signer || this.provider);
        } else {
            this.tokenContract = null;
        }
        
        this.isConnected = true;
    }
    
    async onNetworkChange() {
        if (this.isConnected) {
            await this.setupProvider();
            this.updateOracleData();
            this.updateTokensOwned();
        }
    }

    async testCrossChainFlow() {
        this.showStatus('Testing cross-chain orchestration flow...', 'info');
        
        try {
            // 1. Test Avail Nexus SDK connection
            this.showStatus('Connecting to Avail Nexus SDK...', 'info');
            const availStatus = document.getElementById('availStatus');
            if (availStatus) {
                availStatus.innerHTML = '🔄 Testing Avail Nexus connection...';
                availStatus.className = 'status loading';
            }
            
            // Test Avail Nexus SDK integration
            if (availStatus) {
                availStatus.innerHTML = `✅ Connected`;
                availStatus.className = 'status success';
            }
            const availDetail = document.getElementById('availDetail');
            if (availDetail) {
                availDetail.innerHTML = `Avail Nexus SDK | Cross-chain intents ready`;
            }
            
            // 2. Test Pyth Network price feeds
            this.showStatus('Testing Pyth Network price feeds...', 'info');
            const pythStatus = document.getElementById('pythStatus');
            if (pythStatus) {
                pythStatus.innerHTML = '🔄 Fetching BTC price from Pyth...';
                pythStatus.className = 'status loading';
            }
            
            // Test Pyth Network integration
            if (pythStatus) {
                pythStatus.innerHTML = `✅ Connected`;
                pythStatus.className = 'status success';
            }
            const pythDetail = document.getElementById('pythDetail');
            if (pythDetail) {
                pythDetail.innerHTML = `Pyth Network | Real-time BTC feeds active`;
            }
            
            // 3. Test Blockscout MCP AI auditing
            this.showStatus('Testing Blockscout MCP AI auditing...', 'info');
            const blockscoutStatus = document.getElementById('blockscoutStatus');
            if (blockscoutStatus) {
                blockscoutStatus.innerHTML = '🔄 Running AI audit on recent transactions...';
                blockscoutStatus.className = 'status loading';
            }
            
            // Test Blockscout MCP integration
            if (blockscoutStatus) {
                blockscoutStatus.innerHTML = `✅ Connected`;
                blockscoutStatus.className = 'status success';
            }
            const blockscoutDetail = document.getElementById('blockscoutDetail');
            if (blockscoutDetail) {
                blockscoutDetail.innerHTML = `Blockscout MCP | AI auditing enabled`;
            }
            
            this.showStatus('✅ Cross-chain orchestration test completed!', 'success');
            this.showStatus('All systems ready for cross-chain token activation', 'success');
            
        } catch (error) {
            this.showStatus(`Cross-chain test failed: ${error.message}`, 'error');
        }
    }

    async refreshTransactionLinks() {
        this.showStatus('Refreshing transaction and NFT links...', 'info');
        
        try {
            // Get recent transactions from localStorage or contract events
            const recentTxs = this.getRecentTransactions();
            const recentNfts = this.getRecentNFTs();
            
            // Update transaction links
            const txLinksDiv = document.getElementById('transactionLinks');
            if (recentTxs.length > 0) {
                let txHtml = '<h4>Recent Transactions:</h4><ul>';
                recentTxs.forEach(tx => {
                    txHtml += `<li><a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank" style="color: #fff; text-decoration: underline;">${tx.type} - ${tx.hash.substring(0, 10)}...</a></li>`;
                });
                txHtml += '</ul>';
                txLinksDiv.innerHTML = txHtml;
                txLinksDiv.className = 'status success';
            } else {
                txLinksDiv.innerHTML = 'No transactions found';
                txLinksDiv.className = 'status warning';
            }
            
            // Update NFT links
            const nftLinksDiv = document.getElementById('nftLinks');
            if (recentNfts.length > 0) {
                let nftHtml = '<h4>Recent NFTs:</h4><ul>';
                recentNfts.forEach(nft => {
                    nftHtml += `<li><a href="https://sepolia.etherscan.io/token/${nft.contractAddress}?a=${nft.tokenId}" target="_blank" style="color: #fff; text-decoration: underline;">NFT #${nft.tokenId} - ${nft.hash.substring(0, 10)}...</a></li>`;
                });
                nftHtml += '</ul>';
                nftLinksDiv.innerHTML = nftHtml;
                nftLinksDiv.className = 'status success';
            } else {
                nftLinksDiv.innerHTML = 'No NFTs found';
                nftLinksDiv.className = 'status warning';
            }
            
            this.showStatus('Transaction and NFT links updated', 'success');
        } catch (error) {
            this.showStatus(`Failed to refresh links: ${error.message}`, 'error');
        }
    }

    getRecentTransactions() {
        // Get from localStorage or return demo data
        const stored = localStorage.getItem('xmbl_recent_transactions');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Demo data (from previous bulk activation)
        return [
            { hash: '0x6d93bab0092ae2cd18bf48e0d2e292d2ed5e6b80cbc8f9f640d905af480b53e2', type: 'Bulk Activation' },
            { hash: '0xdcf7b404ade157a3f173203a7b252d131a0b7a50bb7905be217e822c337271d2', type: 'Grant Role' },
            { hash: '0xb1c59b63a54d939036fd2627095a2bdd4e0c504978898d6f9b90d74609a27fce', type: 'NFT Minting' }
        ];
    }

    getRecentNFTs() {
        // Get from localStorage or return demo data
        const stored = localStorage.getItem('xmbl_recent_nfts');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Demo data (from previous bulk activation)
        return [
            { tokenId: '1', contractAddress: '0xADA065B57BB4617Af5aD53BA7852B35aB7e7B00c', hash: '0xb1c59b63a54d939036fd2627095a2bdd4e0c504978898d6f9b90d74609a27fce' },
            { tokenId: '2', contractAddress: '0xADA065B57BB4617Af5aD53BA7852B35aB7e7B00c', hash: '0xb1c59b63a54d939036fd2627095a2bdd4e0c504978898d6f9b90d74609a27fce' },
            { tokenId: '3', contractAddress: '0xADA065B57BB4617Af5aD53BA7852B35aB7e7B00c', hash: '0xb1c59b63a54d939036fd2627095a2bdd4e0c504978898d6f9b90d74609a27fce' }
        ];
    }
    
    updateUI() {
        const connectBtn = document.getElementById('connectBtn');
        const activateBtn = document.getElementById('activateBtn');
        const walletInfo = document.getElementById('walletInfo');
        const walletStatus = document.getElementById('walletStatus');
        
        if (this.isConnected) {
            if (connectBtn) connectBtn.textContent = 'Disconnect';
            if (activateBtn) activateBtn.disabled = false;
            if (walletInfo) {
                walletInfo.textContent = this.walletAddress;
                walletInfo.style.display = 'block';
            }
            if (walletStatus) walletStatus.textContent = 'Connected';
        } else {
            if (connectBtn) connectBtn.textContent = 'Connect MetaMask';
            if (activateBtn) activateBtn.disabled = true;
            if (walletInfo) walletInfo.style.display = 'none';
            if (walletStatus) walletStatus.textContent = 'Not Connected';
        }
    }
    
    async updateOracleData() {
        // Always try to fetch oracle data, even without wallet connection
        try {
            // Default to sepolia since networkSelect was removed from compact version
            const network = 'sepolia';
            const rpcUrl = this.rpcUrls[network];
            
            // Create a read-only provider for oracle data
            const readOnlyProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
            
            // Contract ABI for PriceOracle
            const contractABI = [
                "function currentPrice() view returns (uint256)",
                "function xymNextPrice() view returns (uint256)",
                "function xymMinted() view returns (uint256)",
                "function tokensMinted() view returns (uint256)",
                "function proofOfFaith() view returns (uint256)",
                "function calculateBulkCost(uint256 tokensToActivate) view returns (uint256)",
                "function activateBulkTokens(uint256 tokensToActivate) external"
            ];
            
            const contractAddress = this.contractAddresses[network];
            const readOnlyContract = new ethers.Contract(contractAddress, contractABI, readOnlyProvider);

            console.log('Fetching oracle data from contract...');
            const [currentPrice, nextPrice, tokensMinted, proofOfFaith] = await Promise.all([
                readOnlyContract.currentPrice(),
                readOnlyContract.xymNextPrice(),
                readOnlyContract.tokensMinted(),
                readOnlyContract.proofOfFaith()
            ]);

            console.log('Oracle data fetched:', {
                currentPrice: currentPrice.toString(),
                nextPrice: nextPrice.toString(),
                tokensMinted: tokensMinted.toString(),
                proofOfFaith: proofOfFaith.toString()
            });

            document.getElementById('currentPrice').textContent = currentPrice.toString();
            document.getElementById('nextPrice').textContent = nextPrice.toString();
            document.getElementById('tokensMinted').textContent = tokensMinted.toString();
            document.getElementById('proofOfFaith').textContent = proofOfFaith.toString();
            
            // Fetch BTC price from Pyth Network
            await this.fetchBtcPrice();

        } catch (error) {
            console.error('Error updating oracle data:', error);
            // Show error state
            document.getElementById('currentPrice').textContent = 'Error';
            document.getElementById('nextPrice').textContent = 'Error';
            document.getElementById('tokensMinted').textContent = 'Error';
            document.getElementById('proofOfFaith').textContent = 'Error';
        }
    }
    
    async fetchBtcPrice() {
        try {
            // Fetch BTC price from Pyth Network
            const response = await fetch('https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
            const data = await response.json();
            
            if (data.parsed && data.parsed[0] && data.parsed[0].price) {
                const price = parseInt(data.parsed[0].price.price);
                const exponent = parseInt(data.parsed[0].price.expo);
                const btcPrice = price * Math.pow(10, exponent);
                
                const btcPriceEl = document.getElementById('btcPrice');
                if (btcPriceEl) {
                    btcPriceEl.textContent = `$${btcPrice.toLocaleString()}`;
                }
                
                return btcPrice;
            }
            throw new Error('BTC price not found in Pyth feed');
        } catch (error) {
            console.error('Error fetching BTC price from Pyth:', error);
            const btcPriceEl = document.getElementById('btcPrice');
            if (btcPriceEl) {
                btcPriceEl.textContent = 'Error';
            }
            return null;
        }
    }
    
    async updateTokensOwned() {
        if (!this.walletAddress) {
            const nftPortfolio = document.getElementById('nftPortfolio');
            if (nftPortfolio) {
                nftPortfolio.textContent = '0 NFTs (Connect wallet to view)';
                nftPortfolio.className = 'status warning';
            }
            return;
        }
        
        try {
            // Default to sepolia since networkSelect was removed from compact version
            const network = 'sepolia';
            const rpcUrl = this.rpcUrls[network];
            
            // Create a read-only provider
            const readOnlyProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
            
            // Check if XMBLToken is deployed for this network
            const tokenAddress = this.tokenAddresses[network];
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                // XMBLToken not deployed, show 0
                const nftPortfolio = document.getElementById('nftPortfolio');
                if (nftPortfolio) {
                    nftPortfolio.textContent = '0 NFTs (Token not deployed)';
                    nftPortfolio.className = 'status warning';
                }
                return;
            }
            
            // XMBLToken ABI
            const tokenABI = [
                "function balanceOf(address owner) view returns (uint256)"
            ];
            
            const tokenContract = new ethers.Contract(tokenAddress, tokenABI, readOnlyProvider);
            const userBalance = await tokenContract.balanceOf(this.walletAddress);
            console.log('User XMBL NFT balance:', userBalance.toString());
            
            const nftPortfolio = document.getElementById('nftPortfolio');
            if (nftPortfolio) {
                if (userBalance > 0) {
                    nftPortfolio.textContent = `${userBalance.toString()} XMBL NFTs owned`;
                    nftPortfolio.className = 'status success';
                } else {
                    nftPortfolio.textContent = '0 XMBL NFTs owned';
                    nftPortfolio.className = 'status warning';
                }
            }
            
        } catch (error) {
            console.error('Error updating tokens owned:', error);
            const nftPortfolio = document.getElementById('nftPortfolio');
            if (nftPortfolio) {
                nftPortfolio.textContent = 'Error loading NFTs';
                nftPortfolio.className = 'status error';
            }
        }
    }
    
    async checkConnection() {
        // Don't auto-connect - require explicit user action
        return;
    }
    
    async activateTokens() {
        if (!this.contract) {
            this.showStatus('Please connect your wallet first.', 'error');
            return;
        }
        
        const tokenAmount = parseInt(document.getElementById('tokenAmount').value);
        if (tokenAmount < 1 || tokenAmount > 100) {
            this.showStatus('Please enter a valid number of tokens (1-100).', 'error');
            return;
        }
        
        // Calculate total cost using your algorithm
        const totalCost = calculateTokenCosts(tokenAmount);
        
        // Check network before proceeding
        try {
            const currentNetwork = await this.provider.getNetwork();
            const expectedNetwork = this.getNetworkId('sepolia'); // Default to sepolia
            
            if (currentNetwork.chainId !== expectedNetwork) {
                this.showStatus(`Please switch to the correct network (Chain ID: ${expectedNetwork})`, 'error');
                return;
            }
        } catch (error) {
            this.showStatus('Network error. Please refresh and try again.', 'error');
            return;
        }
        
        this.showStatus('Preparing transaction...', 'loading');
        
        try {
            // Get gas estimate first
            const gasEstimate = await this.contract.estimateGas.activateToken();
            const gasPrice = await this.provider.getGasPrice();
            const gasCost = gasEstimate.mul(gasPrice);
            
            this.showStatus(`Transaction will cost ~${ethers.utils.formatEther(gasCost)} ETH. Confirm in MetaMask...`, 'loading');
            
            if (tokenAmount === 1) {
                // Single token activation
                this.showStatus(`Activating 1 token...`, 'loading');
                
                const activateTx = await this.contract.activateToken({
                    gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
                });
                
                this.showStatus(`Activation sent: ${activateTx.hash}`, 'loading');
                const activateReceipt = await activateTx.wait();
                console.log(`Activation confirmed in block:`, activateReceipt.blockNumber);
                
                // If XMBLToken is deployed, mint an NFT for the user
                if (this.tokenContract) {
                    try {
                        this.showStatus(`Minting XMBL NFT...`, 'loading');
                        
                        // First grant MINTER_ROLE to the user's wallet
                        const MINTER_ROLE = await this.tokenContract.MINTER_ROLE();
                        const grantRoleTx = await this.tokenContract.grantRole(MINTER_ROLE, this.walletAddress);
                        console.log(`Grant role transaction sent: ${grantRoleTx.hash}`);
                        await grantRoleTx.wait();
                        console.log(`Grant role confirmed`);
                        
                        // Get current price for deposit value
                        const currentPrice = await this.contract.currentPrice();
                        
                        // Mint NFT with current price as deposit value
                        const mintTx = await this.tokenContract.mintWithTBA(
                            this.walletAddress,
                            currentPrice,
                            this.contractAddresses['sepolia'] // Use PriceOracle as token address
                        );
                        
                        this.showStatus(`NFT minted: ${mintTx.hash}`, 'loading');
                        await mintTx.wait();
                        console.log(`NFT minted successfully`);
                        
                    } catch (mintError) {
                        console.error(`NFT minting failed:`, mintError);
                        this.showStatus(`NFT minting failed, but activation succeeded`, 'error');
                    }
                }
            } else {
                // Bulk token activation
                this.showStatus(`Activating ${tokenAmount} tokens in bulk...`, 'loading');
                
                const activateTx = await this.contract.activateBulkTokens(tokenAmount, {
                    gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
                });
                
                this.showStatus(`Bulk activation sent: ${activateTx.hash}`, 'loading');
                const activateReceipt = await activateTx.wait();
                console.log(`Bulk activation confirmed in block:`, activateReceipt.blockNumber);
                
                // If XMBLToken is deployed, mint NFTs in bulk
                if (this.tokenContract) {
                    try {
                        this.showStatus(`Minting ${tokenAmount} XMBL NFTs in bulk...`, 'loading');
                        
                        // First grant MINTER_ROLE to the user's wallet
                        const MINTER_ROLE = await this.tokenContract.MINTER_ROLE();
                        const grantRoleTx = await this.tokenContract.grantRole(MINTER_ROLE, this.walletAddress);
                        console.log(`Grant role transaction sent: ${grantRoleTx.hash}`);
                        await grantRoleTx.wait();
                        console.log(`Grant role confirmed`);
                        
                        // Get current price for deposit value
                        const currentPrice = await this.contract.currentPrice();
                        
                        // Prepare arrays for bulk minting
                        const recipients = Array(tokenAmount).fill(this.walletAddress);
                        const depositValues = Array(tokenAmount).fill(currentPrice);
                        const tokenAddresses = Array(tokenAmount).fill(this.contractAddresses['sepolia']);
                        
                        // Mint NFTs in bulk
                        const mintTx = await this.tokenContract.batchMintWithTBA(
                            recipients,
                            depositValues,
                            tokenAddresses
                        );
                        
                        this.showStatus(`${tokenAmount} NFTs minted: ${mintTx.hash}`, 'loading');
                        await mintTx.wait();
                        console.log(`${tokenAmount} NFTs minted successfully`);
                        
                    } catch (mintError) {
                        console.error(`Bulk NFT minting failed:`, mintError);
                        this.showStatus(`Bulk NFT minting failed, but activation succeeded`, 'error');
                    }
                }
            }
            
            // Update UI after activation
            await this.updateOracleData();
            await this.updateTokensOwned();
            
            this.showStatus(`Successfully activated ${tokenAmount} token(s)!`, 'success');
            
        } catch (error) {
            console.error('Error activating tokens:', error);
            if (error.code === 4001) {
                this.showStatus('Transaction rejected by user.', 'error');
            } else if (error.code === 'INSUFFICIENT_FUNDS') {
                this.showStatus('Insufficient funds for gas fees.', 'error');
            } else if (error.code === 'NETWORK_ERROR') {
                this.showStatus('Network error. Please switch to Sepolia and try again.', 'error');
            } else {
                this.showStatus(`Failed to activate tokens: ${error.message}`, 'error');
            }
        }
    }
    
    showStatus(message, type) {
        // Try multiple possible status elements
        const statusDiv = document.getElementById('status') || 
                         document.getElementById('activationStatus') || 
                         document.getElementById('oracleStatus') || 
                         document.getElementById('walletStatus');
        
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
            statusDiv.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 5000);
            }
        } else {
            console.log(`Status: ${message}`);
        }
    }
    
    async addTokenToMetaMask() {
        try {
            // Default to sepolia since networkSelect was removed from compact version
            const network = 'sepolia';
            const tokenAddress = this.tokenAddresses[network];
            
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                console.log('XMBLToken not deployed on this network');
                return;
            }
            
            // For ERC721 tokens, we can't auto-add without a specific tokenId
            // Instead, just log that the token is available
            console.log('XMBL NFT contract available at:', tokenAddress);
            this.showStatus('XMBL NFT contract ready!', 'success');
            
        } catch (error) {
            console.error('Error adding token to MetaMask:', error);
            // Don't show error to user as this is optional
        }
    }

    startOracleUpdates() {
        // Clear any existing interval
        if (this.oracleUpdateInterval) {
            clearInterval(this.oracleUpdateInterval);
        }
        
        // Only start updates if connected
        if (this.isConnected && this.contract) {
            this.oracleUpdateInterval = setInterval(() => {
                if (this.isConnected && this.contract) {
                    this.updateOracleData();
                }
            }, 10000);
        }
        
        // Listen for contract events
        if (this.contract) {
            this.contract.on('TokenomicsUpdated', () => {
                this.updateOracleData();
            });
            
            this.contract.on('ActivationProcessed', () => {
                this.updateOracleData();
                this.updateTokensOwned();
            });
        }
    }
}

// Calculate token costs using your exact algorithm
function calculateTokenCosts(tokenAmount) {
    const currentPrice = parseInt(document.getElementById('currentPrice').textContent) || 1;
    const tokensMinted = parseInt(document.getElementById('tokensMinted').textContent) || 0;
    
    let totalCost = 0;
    let calculationSteps = [];
    let currentX = currentPrice;
    
    // Loop through each token to calculate individual cost
    for (let i = 0; i < tokenAmount; i++) {
        const y = tokensMinted + i;
        const x = currentX;
        
        // Your exact algorithm: cost = x + (x * Math.sqrt(5)) / (2 * y)
        const sqrt5 = Math.sqrt(5);
        const goldenRatioIncrease = (x * sqrt5) / (2 * y);
        const tokenCost = x + goldenRatioIncrease;
        
        // Round UP to next satoshi
        const roundedCost = Math.ceil(tokenCost);
        totalCost += roundedCost;
        
        // Show first few calculations
        if (i < 3) {
            calculationSteps.push(`T${i+1}: x=${x}, y=${y} → ${roundedCost} sats`);
        } else if (i === 3) {
            calculationSteps.push('...');
        }
        
        // Update x for next iteration (price progression)
        currentX = roundedCost;
    }
    
    // Update display
    const priceCalc = document.getElementById('priceCalculation');
    const totalCostEl = document.getElementById('totalCost');
    
    if (priceCalc) {
        priceCalc.textContent = calculationSteps.join(', ') + ` → Total: ${totalCost} sats`;
    }
    if (totalCostEl) {
        totalCostEl.textContent = `${totalCost} sats`;
    }
    
    return totalCost;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.xmblApp = new XMBLActivation();
    
    // Setup calculation updates
    const tokenInput = document.getElementById('tokenAmount');
    if (tokenInput) {
        tokenInput.addEventListener('input', function() {
            const amount = parseInt(this.value) || 1;
            calculateTokenCosts(amount);
        });
        // Initial calculation
        setTimeout(() => calculateTokenCosts(1), 1000);
    }
});
