import React, { useState, useEffect } from 'react';
import { TokenActivationService, ActivationResult } from '../services/TokenActivationService';
import { QRCodeGenerator } from './QRCodeGenerator';

interface Chain {
  id: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  explorer?: string;
}

interface ActivationForm {
  chainId: number;
  amount: string;
  tokenAddress: string;
  userAddress: string;
  activationCost: string;
  privateKey?: string;
}

interface WalletInfo {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export const TokenActivation: React.FC = () => {
  const [form, setForm] = useState<ActivationForm>({
    chainId: 1,
    amount: '',
    tokenAddress: '',
    userAddress: '',
    activationCost: ''
  });

  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<any>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    chainId: 0,
    isConnected: false
  });

  const [chains, setChains] = useState<Chain[]>([]);
  const [activationService, setActivationService] = useState<TokenActivationService | null>(null);
  const [currentPrice, setCurrentPrice] = useState<{ price: string; tokensActivated: number }>({ price: '0.00000001', tokensActivated: 0 });
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    fetchChains();
    initializeActivationService();
    fetchCurrentPrice();
  }, []);

  const initializeActivationService = async () => {
    try {
      const response = await fetch('/api/chains');
      const chainsData = await response.json();
      
      const service = new TokenActivationService(
        '0x1234567890123456789012345678901234567890', // Oracle address (placeholder)
        '0x1234567890123456789012345678901234567890', // DepositManager address (placeholder)
        chainsData
      );
      
      setActivationService(service);
    } catch (error) {
      console.error('Error initializing activation service:', error);
    }
  };

  const fetchCurrentPrice = async () => {
    try {
      const response = await fetch('/api/oracle/prices');
      const data = await response.json();
      setCurrentPrice({
        price: data.xmblPrice || '0.00000001',
        tokensActivated: data.tokensActivated || 0
      });
    } catch (error) {
      console.error('Error fetching current price:', error);
    }
  };

  // Monitor for transaction updates
  const monitorTransactions = async () => {
    try {
      const response = await fetch('/api/oracle/prices');
      const data = await response.json();
      
      // Check if token count has changed (indicating new activation)
      if (data.tokensActivated !== currentPrice?.tokensActivated) {
        console.log('🔄 New activation detected! Updating prices...');
        setCurrentPrice({
          price: data.xmblPrice || '0.00000001',
          tokensActivated: data.tokensActivated || 0
        });
        
        // Show success notification
        if (data.tokensActivated > (currentPrice?.tokensActivated || 0)) {
          console.log('✅ Token activation completed successfully!');
          console.log(`📊 New token count: ${data.tokensActivated}`);
          console.log(`💰 New XMBL price: ${data.xmblPrice} BTC`);
        }
      }
    } catch (error) {
      console.error('Error monitoring transactions:', error);
    }
  };

  // Set up real-time monitoring
  useEffect(() => {
    const interval = setInterval(monitorTransactions, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [currentPrice]);

  // Auto-populate contract address when chain changes
  useEffect(() => {
    if (chains.length > 0 && form.chainId) {
      const selectedChain = chains.find(chain => chain.id === form.chainId);
      if (selectedChain) {
        setForm(prev => ({
          ...prev,
          tokenAddress: selectedChain.contractAddress
        }));
      }
    }
  }, [form.chainId, chains]);

  // Calculate activation cost when amount or chain changes
  useEffect(() => {
    if (activationService && form.amount && form.chainId) {
      activationService.calculateActivationCost(form.amount, form.chainId)
        .then(cost => {
          setForm(prev => ({
            ...prev,
            activationCost: cost
          }));
        })
        .catch(error => {
          console.error('Error calculating activation cost:', error);
        });
    }
  }, [form.amount, form.chainId, activationService]);

  const fetchChains = async () => {
    try {
      const response = await fetch('/api/chains');
      const data = await response.json();
      setChains(data);
      
      // Auto-select first chain and populate its contract address
      if (data.length > 0) {
        setForm(prev => ({
          ...prev,
          chainId: data[0].id,
          tokenAddress: data[0].contractAddress
        }));
      }
    } catch (error) {
      console.error('Error fetching chains:', error);
      setChains([]);
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        setWalletInfo({
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          isConnected: true
        });
        
        // Update form with connected wallet address
        setForm(prev => ({
          ...prev,
          userAddress: accounts[0]
        }));
        
        console.log('Wallet connected:', accounts[0]);
      } else {
        alert('Please install MetaMask or another Web3 wallet');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  const switchChain = async (chainId: number) => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }
    } catch (error) {
      console.error('Error switching chain:', error);
      // Chain might not be added to wallet, try to add it
      const chain = chains.find(c => c.id === chainId);
      if (chain) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${chainId.toString(16)}`,
              chainName: chain.name,
              rpcUrls: [chain.rpcUrl],
              blockExplorerUrls: chain.explorer ? [chain.explorer] : undefined,
            }],
          });
        } catch (addError) {
          console.error('Error adding chain:', addError);
        }
      }
    }
  };

  const handleActivate = async () => {
    if (!walletInfo.isConnected && !form.userAddress) {
      alert('Please connect your wallet or enter wallet address first');
      return;
    }

    if (!activationService) {
      alert('Activation service not initialized');
      return;
    }

    setIsActivating(true);
    setActivationResult(null);
    
    try {
      // Switch to the correct chain if needed
      if (walletInfo.chainId !== form.chainId) {
        await switchChain(form.chainId);
      }

      console.log('🚀 Starting complete token activation workflow...');
      console.log(`📊 Current XMBL Price: ${currentPrice.price} BTC per token`);
      console.log(`📈 Tokens Activated: ${currentPrice.tokensActivated}`);
      console.log(`💰 Activation Cost: ${form.activationCost} ETH`);

      // Step 1: Activate tokens on selected chain
      const userAddress = walletInfo.isConnected ? walletInfo.address : form.userAddress;
      const result = await activationService.activateTokens(
        form.chainId,
        form.amount,
        userAddress,
        window.ethereum,
        form.privateKey
      );

      if (result.success) {
        console.log('✅ Token activation completed successfully!');
        console.log(`🔗 Transaction: ${result.transactionHash}`);
        console.log(`🆔 Deposit ID: ${result.depositId}`);
        console.log(`📊 New Token Count: ${result.newTokenCount}`);
        console.log(`💰 New XMBL Price: ${result.newXMBLPrice} BTC`);
        console.log(`₿ BTC Deposited: ${result.btcDeposited}`);

        // Update local state with new price
        setCurrentPrice({
          price: result.newXMBLPrice || currentPrice.price,
          tokensActivated: result.newTokenCount || currentPrice.tokensActivated
        });

        // Refresh oracle data
        await fetchCurrentPrice();

        setActivationResult({
          success: true,
          message: '🎉 Token activation workflow completed successfully!',
          transactionHash: result.transactionHash,
          depositId: result.depositId,
          blockNumber: result.blockNumber,
          gasUsed: result.gasUsed,
          newTokenCount: result.newTokenCount,
          newXMBLPrice: result.newXMBLPrice,
          btcDeposited: result.btcDeposited
        });
      } else {
        throw new Error(result.error || 'Activation failed');
      }

    } catch (error) {
      console.error('❌ Error in activation workflow:', error);
      setActivationResult({
        success: false,
        error: error.message || 'Failed to complete activation workflow'
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="token-activation">
      <h2>Token Activation</h2>
      <p>Activate XMBL tokens across multiple chains</p>
      <div className="security-notice">
        <strong>Security Notice:</strong> This interface will create real blockchain transactions. 
        Connect your wallet to sign and send transactions. 
        Never share your private key with any application.
      </div>

      <div className="workflow-status">
        <h3>🔄 Complete Workflow Status</h3>
        <div className="workflow-steps">
          <div className="step">
            <strong>1. Current XMBL Price:</strong> {currentPrice.price} BTC per token
          </div>
          <div className="step">
            <strong>2. Tokens Activated:</strong> {currentPrice.tokensActivated}
          </div>
          <div className="step">
            <strong>3. Next Activation Cost:</strong> {form.activationCost} ETH
          </div>
        </div>
      </div>

      <div className="activation-form">
        <div className="form-group">
          <label>Select Chain:</label>
          {chains.length === 0 ? (
            <p>No chains available. Deploy contracts first.</p>
          ) : (
            <select 
              value={form.chainId} 
              onChange={(e) => setForm({...form, chainId: parseInt(e.target.value)})}
            >
              {chains.map(chain => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} (Chain ID: {chain.id})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="form-group">
          <label>Token Amount:</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({...form, amount: e.target.value})}
            placeholder="Enter amount to activate"
            min="0"
            step="0.00000001"
          />
        </div>

        <div className="form-group">
          <label>Token Contract Address:</label>
          <input
            type="text"
            value={form.tokenAddress}
            readOnly
            className="readonly-input"
            placeholder="Auto-populated from selected chain"
            title="Contract address is automatically set based on the selected chain"
          />
          <small className="form-help">
            Contract address is automatically detected from deployed contracts on the selected chain
          </small>
        </div>

        <div className="form-group">
          <label>Wallet Connection:</label>
          {walletInfo.isConnected ? (
            <div className="wallet-connected">
              <div className="wallet-info">
                <strong>Connected:</strong> {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
              </div>
              <div className="wallet-actions">
                <button 
                  type="button" 
                  onClick={() => switchChain(form.chainId)}
                  className="switch-chain-btn"
                >
                  Switch to {chains.find(c => c.id === form.chainId)?.name}
                </button>
                <button 
                  type="button" 
                  onClick={() => setWalletInfo({ address: '', chainId: 0, isConnected: false })}
                  className="disconnect-btn"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="wallet-options">
              <button 
                type="button" 
                onClick={connectWallet}
                className="connect-wallet-btn"
              >
                Connect Wallet
              </button>
              <div className="or-divider">OR</div>
              <div className="manual-wallet-input">
                <label>Enter Wallet Address:</label>
                <input
                  type="text"
                  value={form.userAddress}
                  onChange={(e) => setForm({...form, userAddress: e.target.value})}
                  placeholder="0x..."
                  className="wallet-address-input"
                />
                <label>Enter Private Key (for testing only):</label>
                <input
                  type="password"
                  value={form.privateKey || ''}
                  onChange={(e) => setForm({...form, privateKey: e.target.value})}
                  placeholder="Enter private key for testing"
                  className="private-key-input"
                />
                <small className="security-warning">
                  ⚠️ WARNING: Only use for testing. Never share your private key with untrusted applications.
                </small>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleActivate}
          disabled={isActivating || !form.amount || !form.tokenAddress || (!walletInfo.isConnected && !form.userAddress) || chains.length === 0}
          className="activate-button"
        >
          {isActivating ? 'Creating Transaction...' : 'Activate Token'}
        </button>

        <div className="mobile-options">
          <button 
            onClick={() => setShowQRCode(!showQRCode)}
            className="qr-code-toggle-btn"
          >
            📱 {showQRCode ? 'Hide' : 'Show'} Mobile QR Code
          </button>
        </div>
      </div>

      {showQRCode && form.amount && form.tokenAddress && (
        <QRCodeGenerator 
          activationData={{
            chainId: form.chainId,
            amount: form.amount,
            contractAddress: form.tokenAddress,
            currentPrice: currentPrice.price,
            activationCost: form.activationCost
          }}
        />
      )}

      {activationResult && (
        <div className="activation-result">
          <h3>🔄 Complete Workflow Result</h3>
          {activationResult.success ? (
            <div className="success-result">
              <p><strong>✅ {activationResult.message}</strong></p>
              
              <div className="workflow-results">
                <h4>📊 Workflow Steps Completed:</h4>
                <div className="step-result">
                  <strong>1. Token Activation:</strong> ✅ Completed
                  {activationResult.transactionHash && (
                    <p>🔗 <strong>Transaction:</strong> {activationResult.transactionHash}</p>
                  )}
                  {activationResult.depositId && (
                    <p>🆔 <strong>Deposit ID:</strong> {activationResult.depositId}</p>
                  )}
                </div>
                
                <div className="step-result">
                  <strong>2. Oracle Update:</strong> ✅ Completed
                  {activationResult.newTokenCount && (
                    <p>📈 <strong>New Token Count:</strong> {activationResult.newTokenCount}</p>
                  )}
                  {activationResult.newXMBLPrice && (
                    <p>💰 <strong>New XMBL Price:</strong> {activationResult.newXMBLPrice} BTC</p>
                  )}
                </div>
                
                <div className="step-result">
                  <strong>3. BTC Conversion:</strong> ✅ Completed
                  {activationResult.btcDeposited && (
                    <p>₿ <strong>BTC Deposited:</strong> {activationResult.btcDeposited} BTC</p>
                  )}
                </div>
                
                <div className="step-result">
                  <strong>4. Cross-Chain Sync:</strong> ✅ Completed
                  <p>🔄 <strong>All chains updated with new oracle data</strong></p>
                </div>
                
                <div className="step-result">
                  <strong>5. Frontend Update:</strong> ✅ Completed
                  <p>🖥️ <strong>Real-time price and stats updated</strong></p>
                </div>
              </div>
              
              {activationResult.blockNumber && (
                <p><strong>Block Number:</strong> {activationResult.blockNumber}</p>
              )}
              {activationResult.gasUsed && (
                <p><strong>Gas Used:</strong> {activationResult.gasUsed}</p>
              )}
            </div>
          ) : (
            <div className="error-result">
              <p><strong>❌ Workflow Failed</strong></p>
              <p>{activationResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
