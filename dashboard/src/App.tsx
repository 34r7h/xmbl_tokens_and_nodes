import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { AvailService } from './services/AvailService';
import { PythService } from './services/PythService';
import { BlockscoutService } from './services/BlockscoutService';
import { TokenActivationService } from './services/TokenActivationService';
import './index.css';
import { FaWallet, FaExchangeAlt, FaChartLine, FaCube, FaCoins, FaCheckCircle, FaTimesCircle, FaSpinner, FaCopy, FaExternalLinkAlt } from 'react-icons/fa';

interface ContractInfo {
  name: string;
  address: string;
  chain: string;
  explorerUrl: string;
}

interface Alert {
  type: 'success' | 'error' | 'warning';
  message: string;
}

const env = {
  SEPOLIA_RPC_URL: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
  PRICE_ORACLE_ADDRESS: import.meta.env.VITE_PRICE_ORACLE_ADDRESS || '0x19d9ebAe7d0883f15f64D0519D35526FFDff0891',
  DEPOSIT_MANAGER_ADDRESS: import.meta.env.VITE_DEPOSIT_MANAGER_ADDRESS || '0x230b0488c505cfadF97495c4Fd2243B8b531C83F',
  PYTH_HERMES_URL: import.meta.env.VITE_PYTH_HERMES_URL || 'https://hermes.pyth.network',
  PYTH_BTC_USD_FEED_ID: import.meta.env.VITE_PYTH_BTC_USD_FEED_ID || '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  BLOCKSCOUT_API_URL: import.meta.env.VITE_BLOCKSCOUT_API_URL || 'https://sepolia.blockscout.com',
  AVAIL_RPC_URL: import.meta.env.VITE_AVAIL_RPC_URL || 'https://nexus-rpc.avail.tools',
  BTC_POOL_ADDRESS: import.meta.env.VITE_BTC_POOL_ADDRESS || 'bc1qax3zp2z0yux95n32y5s6lnwj89mncsavjz64k6',
  BTC_DEV_ADDRESS: import.meta.env.VITE_BTC_DEV_ADDRESS || 'bc1q2fna87prmtl3fc3daerqzmtngp7fdnk7f9crff',
  ETHEREUM_DEPOSIT_CONTRACT: import.meta.env.VITE_ETHEREUM_DEPOSIT_CONTRACT || '0x8c55AfF0d51444aFa640F57d22E8d634d32aE24d',
  POLYGON_DEPOSIT_CONTRACT: import.meta.env.VITE_POLYGON_DEPOSIT_CONTRACT || '0x974c32ECB7a26f3F3C08E439A8EE6aB0625964D7',
  BSC_DEPOSIT_CONTRACT: import.meta.env.VITE_BSC_DEPOSIT_CONTRACT || '0xD8E4a3a42C5704A5bb996C679606785C34dE5D43',
  ARBITRUM_DEPOSIT_CONTRACT: import.meta.env.VITE_ARBITRUM_DEPOSIT_CONTRACT || '0x1FDc7523c9355a6010c86e8Cc614605AAef85700',
  OPTIMISM_DEPOSIT_CONTRACT: import.meta.env.VITE_OPTIMISM_DEPOSIT_CONTRACT || '0xd7CBf08480ba78814382f918230485DAFe02FdC6'
};

const chains = [
  { id: 'Ethereum Sepolia', name: 'Ethereum Sepolia', rpc: env.SEPOLIA_RPC_URL },
  { id: 'Polygon Mumbai', name: 'Polygon Mumbai', rpc: 'https://polygon-mumbai.infura.io/v3/YOUR_KEY' },
  { id: 'BSC Testnet', name: 'BSC Testnet', rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545' },
  { id: 'Arbitrum Sepolia', name: 'Arbitrum Sepolia', rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
  { id: 'Optimism Sepolia', name: 'Optimism Sepolia', rpc: 'https://sepolia.optimism.io' }
];

function App() {
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [activationAmount, setActivationAmount] = useState<number>(0.1);
  const [selectedChain, setSelectedChain] = useState<string>('Ethereum Sepolia');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [systemStatus, setSystemStatus] = useState({
    pyth: 'loading',
    avail: 'loading',
    blockscout: 'loading',
    oracle: 'loading'
  });
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [xmblPrice, setXmblPrice] = useState<number>(0.00000001);

  useEffect(() => {
    initializeSystem();
    loadContracts();
  }, []);

  const initializeSystem = async () => {
    try {
      // Initialize provider
      const rpcUrl = chains.find(c => c.id === selectedChain)?.rpc || env.SEPOLIA_RPC_URL;
      const newProvider = new ethers.JsonRpcProvider(rpcUrl);
      setProvider(newProvider);

      // Initialize services
      const signer = wallet;
      const availService = new AvailService(env.AVAIL_RPC_URL, 'testnet', signer);
      const pythService = new PythService(env.PYTH_HERMES_URL, env.PYTH_BTC_USD_FEED_ID, env.PRICE_ORACLE_ADDRESS, newProvider, signer);
      const blockscoutService = new BlockscoutService(env.BLOCKSCOUT_API_URL);
      const tokenActivationService = new TokenActivationService(
        newProvider,
        signer,
        env.DEPOSIT_MANAGER_ADDRESS,
        env.PRICE_ORACLE_ADDRESS,
        {
          'Ethereum Sepolia': env.ETHEREUM_DEPOSIT_CONTRACT,
          'Polygon Mumbai': env.POLYGON_DEPOSIT_CONTRACT,
          'BSC Testnet': env.BSC_DEPOSIT_CONTRACT,
          'Arbitrum Sepolia': env.ARBITRUM_DEPOSIT_CONTRACT,
          'Optimism Sepolia': env.OPTIMISM_DEPOSIT_CONTRACT,
        }
      );

      // Check Pyth Network
      try {
        const price = await pythService.fetchBtcPrice();
        setBtcPrice(price / 1e8);
        setSystemStatus(prev => ({ ...prev, pyth: 'connected' }));
      } catch (error) {
        console.error('Pyth error:', error);
        setSystemStatus(prev => ({ ...prev, pyth: 'error' }));
      }

      // Check Avail Nexus
      try {
        await availService.initializeNexus();
        setSystemStatus(prev => ({ ...prev, avail: 'connected' }));
      } catch (error) {
        console.error('Avail error:', error);
        setSystemStatus(prev => ({ ...prev, avail: 'error' }));
      }

      // Check Blockscout
      try {
        await blockscoutService.checkApiStatus();
        setSystemStatus(prev => ({ ...prev, blockscout: 'connected' }));
      } catch (error) {
        console.error('Blockscout error:', error);
        setSystemStatus(prev => ({ ...prev, blockscout: 'error' }));
      }

      // Check Oracle
      try {
        if (newProvider) {
          const code = await newProvider.getCode(env.PRICE_ORACLE_ADDRESS);
          if (code && code !== '0x') {
            setSystemStatus(prev => ({ ...prev, oracle: 'connected' }));
            const price = await tokenActivationService.getXMBLPrice();
            setXmblPrice(parseFloat(ethers.formatUnits(price, 8)));
          }
        }
      } catch (error) {
        console.error('Oracle error:', error);
        setSystemStatus(prev => ({ ...prev, oracle: 'error' }));
      }

    } catch (error) {
      console.error('System initialization failed:', error);
    }
  };

  const loadContracts = () => {
    const contractList: ContractInfo[] = [
      {
        name: 'PriceOracle',
        address: env.PRICE_ORACLE_ADDRESS,
        chain: 'Sepolia',
        explorerUrl: `https://sepolia.etherscan.io/address/${env.PRICE_ORACLE_ADDRESS}`
      },
      {
        name: 'DepositManager',
        address: env.DEPOSIT_MANAGER_ADDRESS,
        chain: 'Sepolia',
        explorerUrl: `https://sepolia.etherscan.io/address/${env.DEPOSIT_MANAGER_ADDRESS}`
      },
      {
        name: 'Ethereum Deposit',
        address: env.ETHEREUM_DEPOSIT_CONTRACT,
        chain: 'Sepolia',
        explorerUrl: `https://sepolia.etherscan.io/address/${env.ETHEREUM_DEPOSIT_CONTRACT}`
      },
      {
        name: 'Polygon Deposit',
        address: env.POLYGON_DEPOSIT_CONTRACT,
        chain: 'Mumbai',
        explorerUrl: `https://mumbai.polygonscan.com/address/${env.POLYGON_DEPOSIT_CONTRACT}`
      },
      {
        name: 'BSC Deposit',
        address: env.BSC_DEPOSIT_CONTRACT,
        chain: 'BSC Testnet',
        explorerUrl: `https://testnet.bscscan.com/address/${env.BSC_DEPOSIT_CONTRACT}`
      },
      {
        name: 'Arbitrum Deposit',
        address: env.ARBITRUM_DEPOSIT_CONTRACT,
        chain: 'Arbitrum Sepolia',
        explorerUrl: `https://sepolia.arbiscan.io/address/${env.ARBITRUM_DEPOSIT_CONTRACT}`
      },
      {
        name: 'Optimism Deposit',
        address: env.OPTIMISM_DEPOSIT_CONTRACT,
        chain: 'Optimism Sepolia',
        explorerUrl: `https://sepolia-optimism.etherscan.io/address/${env.OPTIMISM_DEPOSIT_CONTRACT}`
      }
    ];
    setContracts(contractList);
  };

  const connectWallet = async () => {
    try {
      if (!provider) {
        throw new Error('Provider not initialized');
      }

      // Check if MetaMask is available
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const newWallet = new ethers.BrowserProvider(window.ethereum).getSigner();
        setWallet(await newWallet);
        addAlert('success', 'Wallet connected successfully!');
      } else {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }
    } catch (error) {
      addAlert('error', `Failed to connect wallet: ${error}`);
    }
  };

  const activateToken = async () => {
    if (!wallet || !provider || !activationAmount) {
      addAlert('error', 'Please connect wallet and enter amount');
      return;
    }

    setIsActivating(true);
    try {
      const contractAddress = contracts.find(c => c.name.includes(selectedChain.split(' ')[0]))?.address;
      if (!contractAddress) {
        throw new Error('Contract not found for selected chain');
      }

      // Initialize services
      const availService = new AvailService(env.AVAIL_RPC_URL, 'testnet', wallet);
      const pythService = new PythService(env.PYTH_HERMES_URL, env.PYTH_BTC_USD_FEED_ID, env.PRICE_ORACLE_ADDRESS, provider, wallet);
      const tokenActivationService = new TokenActivationService(
        provider,
        wallet,
        env.DEPOSIT_MANAGER_ADDRESS,
        env.PRICE_ORACLE_ADDRESS,
        {
          'Ethereum Sepolia': env.ETHEREUM_DEPOSIT_CONTRACT,
          'Polygon Mumbai': env.POLYGON_DEPOSIT_CONTRACT,
          'BSC Testnet': env.BSC_DEPOSIT_CONTRACT,
          'Arbitrum Sepolia': env.ARBITRUM_DEPOSIT_CONTRACT,
          'Optimism Sepolia': env.OPTIMISM_DEPOSIT_CONTRACT,
        }
      );

      // Get current BTC price
      const btcPrice = await pythService.fetchBtcPrice();
      const amount = ethers.parseEther(activationAmount.toString());

      // Create Avail intent for cross-chain activation
      const intentId = await availService.createIntent(
        1, // source chain (Ethereum)
        1, // destination chain (same for now)
        wallet.address,
        amount.toString(),
        'ETH'
      );

      // Process the intent
      const result = await availService.processIntent(intentId);
      if (!result.success) {
        throw new Error(`Intent processing failed: ${result.error}`);
      }

      // Update oracle with new price
      const newPrice = xmblPrice + (activationAmount * 0.1); // Simple price increase
      await tokenActivationService.updateOraclePrice(ethers.parseEther(newPrice.toString()));
      setXmblPrice(newPrice);

      addAlert('success', `Token activated! Transaction: ${result.transactionHash}`);
      
      // Refresh system status
      await initializeSystem();

    } catch (error) {
      addAlert('error', `Activation failed: ${error}`);
    } finally {
      setIsActivating(false);
    }
  };

  const addAlert = (type: 'success' | 'error' | 'warning', message: string) => {
    setAlerts(prev => [...prev, { type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.slice(1));
    }, 5000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addAlert('success', 'Copied to clipboard!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <FaCheckCircle className="text-green-500" size={20} />;
      case 'error': return <FaTimesCircle className="text-red-500" size={20} />;
      default: return <FaSpinner className="animate-spin text-blue-500" size={20} />;
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>XMBL Token Activation Dashboard</h1>
        <p>Cross-Chain Token Activation Platform with Real-Time Oracle Updates</p>
      </div>

      {/* Alerts */}
      {alerts.map((alert, index) => (
        <div key={index} className={`alert ${alert.type}`}>
          {alert.message}
        </div>
      ))}

      {/* System Status */}
      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaChartLine size={24} />
          System Status
        </h2>
        <div className="status-grid">
          <div className={`status-card ${systemStatus.pyth === 'connected' ? 'connected' : systemStatus.pyth === 'error' ? 'error' : 'loading'}`}>
            <h3>Pyth Network</h3>
            <p>Status: {systemStatus.pyth}</p>
            <p>BTC Price: ${btcPrice > 0 ? btcPrice.toFixed(2) : 'Loading...'}</p>
            {getStatusIcon(systemStatus.pyth)}
          </div>
          <div className={`status-card ${systemStatus.avail === 'connected' ? 'connected' : systemStatus.avail === 'error' ? 'error' : 'loading'}`}>
            <h3>Avail Nexus</h3>
            <p>Status: {systemStatus.avail}</p>
            <p>Network: Testnet</p>
            {getStatusIcon(systemStatus.avail)}
          </div>
          <div className={`status-card ${systemStatus.blockscout === 'connected' ? 'connected' : systemStatus.blockscout === 'error' ? 'error' : 'loading'}`}>
            <h3>Blockscout</h3>
            <p>Status: {systemStatus.blockscout}</p>
            <p>API: Connected</p>
            {getStatusIcon(systemStatus.blockscout)}
          </div>
          <div className={`status-card ${systemStatus.oracle === 'connected' ? 'connected' : systemStatus.oracle === 'error' ? 'error' : 'loading'}`}>
            <h3>Price Oracle</h3>
            <p>Status: {systemStatus.oracle}</p>
            <p>XMBL Price: {xmblPrice.toFixed(8)} BTC</p>
            <p>Oracle Address: {env.PRICE_ORACLE_ADDRESS}</p>
            {getStatusIcon(systemStatus.oracle)}
          </div>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaWallet size={24} />
          Wallet Connection
        </h2>
        {!wallet ? (
          <div>
            <button className="button" onClick={connectWallet}>
              Connect MetaMask
            </button>
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              Connect your MetaMask wallet to activate tokens
            </p>
          </div>
        ) : (
          <div>
            <p><strong>Connected:</strong> {wallet.address}</p>
            <p><strong>Balance:</strong> {wallet.provider ? 'Loading...' : 'N/A'}</p>
            <button className="button" onClick={() => setWallet(null)}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Token Activation */}
      {wallet && (
        <div className="card">
          <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaExchangeAlt size={24} />
            Token Activation
          </h2>
          <div className="input-group">
            <label htmlFor="chain-select">Select Chain:</label>
            <select 
              id="chain-select" 
              value={selectedChain} 
              onChange={(e) => setSelectedChain(e.target.value)}
            >
              {chains.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="activation-amount">Activation Amount (ETH):</label>
            <input
              id="activation-amount"
              type="number"
              value={activationAmount}
              onChange={(e) => setActivationAmount(parseFloat(e.target.value))}
              placeholder="Enter amount"
              min="0"
              step="0.01"
            />
          </div>
          <button 
            className="button" 
            onClick={activateToken} 
            disabled={!wallet || isActivating}
          >
            {isActivating ? 'Activating...' : 'Activate Token'}
          </button>
        </div>
      )}

      {/* Deployed Contracts */}
      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaCube size={24} />
          Deployed Contracts
        </h2>
        <div className="grid">
          {contracts.map((contract) => (
            <div key={contract.address} className="contract-info">
              <h4>{contract.name}</h4>
              <p><strong>Chain:</strong> {contract.chain}</p>
              <p><strong>Address:</strong> {contract.address}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="button" 
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  onClick={() => copyToClipboard(contract.address)}
                >
                  <FaCopy size={14} />
                </button>
                <a 
                  href={contract.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                >
                  <FaExternalLinkAlt size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oracle Information */}
      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaChartLine size={24} />
          Oracle Information
        </h2>
        <div className="grid">
          <div className="contract-info">
            <h4>Current XMBL Price</h4>
            <p><strong>Price:</strong> {xmblPrice.toFixed(8)} BTC</p>
            <p><strong>USD Value:</strong> ${btcPrice > 0 ? (xmblPrice * btcPrice).toFixed(6) : 'Loading...'}</p>
            <p><strong>Status:</strong> {systemStatus.oracle === 'connected' ? 'Active' : 'Error'}</p>
          </div>
          <div className="contract-info">
            <h4>Oracle Contract</h4>
            <p><strong>Address:</strong> {env.PRICE_ORACLE_ADDRESS}</p>
            <p><strong>Chain:</strong> Sepolia</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <button 
                className="button" 
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => copyToClipboard(env.PRICE_ORACLE_ADDRESS)}
              >
                <FaCopy size={14} />
              </button>
              <a 
                href={`https://sepolia.etherscan.io/address/${env.PRICE_ORACLE_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                <FaExternalLinkAlt size={14} />
              </a>
            </div>
          </div>
          <div className="contract-info">
            <h4>BTC Price Feed</h4>
            <p><strong>BTC Price:</strong> ${btcPrice > 0 ? btcPrice.toFixed(2) : 'Loading...'}</p>
            <p><strong>Source:</strong> Pyth Network</p>
            <p><strong>Feed ID:</strong> {env.PYTH_BTC_USD_FEED_ID}</p>
          </div>
        </div>
      </div>

      {/* Pool Information */}
      <div className="card">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaCoins size={24} />
          Pool Information
        </h2>
        <div className="grid">
          <div className="contract-info">
            <h4>BTC Liquidity Pool</h4>
            <p><strong>Address:</strong> {env.BTC_POOL_ADDRESS}</p>
            <button 
              className="button" 
              style={{ padding: '5px 10px', fontSize: '12px' }}
              onClick={() => copyToClipboard(env.BTC_POOL_ADDRESS)}
            >
              <FaCopy size={14} />
            </button>
          </div>
          <div className="contract-info">
            <h4>BTC Developer Pool</h4>
            <p><strong>Address:</strong> {env.BTC_DEV_ADDRESS}</p>
            <button 
              className="button" 
              style={{ padding: '5px 10px', fontSize: '12px' }}
              onClick={() => copyToClipboard(env.BTC_DEV_ADDRESS)}
            >
              <FaCopy size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;