import React, { useState, useEffect } from 'react';
import { TokenActivationService } from '../services/TokenActivationService';

interface MobileActivationProps {
  chainId: number;
  amount: string;
  contractAddress: string;
  currentPrice: string;
  activationCost: string;
}

export const MobileActivation: React.FC<MobileActivationProps> = ({
  chainId,
  amount,
  contractAddress,
  currentPrice,
  activationCost
}) => {
  const [walletInfo, setWalletInfo] = useState({
    address: '',
    chainId: 0,
    isConnected: false
  });
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<any>(null);
  const [activationService, setActivationService] = useState<TokenActivationService | null>(null);

  useEffect(() => {
    initializeActivationService();
    checkWalletConnection();
  }, []);

  // Auto-trigger activation when wallet is connected and service is ready
  useEffect(() => {
    if (walletInfo.isConnected && activationService && !isActivating && !activationResult) {
      console.log('🚀 Auto-triggering mobile activation...');
      handleActivate();
    }
  }, [walletInfo.isConnected, activationService, isActivating, activationResult]);

  const initializeActivationService = async () => {
    try {
      const service = new TokenActivationService(
        '0x1234567890123456789012345678901234567890', // Oracle address
        '0x1234567890123456789012345678901234567890', // DepositManager address
        [{ id: chainId, name: 'Selected Chain', rpcUrl: '', contractAddress }]
      );
      setActivationService(service);
    } catch (error) {
      console.error('Error initializing activation service:', error);
    }
  };

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        if (accounts.length > 0) {
          setWalletInfo({
            address: accounts[0],
            chainId: parseInt(chainId, 16),
            isConnected: true
          });
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        setWalletInfo({
          address: accounts[0],
          chainId: parseInt(chainId, 16),
          isConnected: true
        });
      } else {
        alert('Please install MetaMask or another Web3 wallet');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  const switchChain = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }
    } catch (error) {
      console.error('Error switching chain:', error);
    }
  };

  const handleActivate = async () => {
    if (!walletInfo.isConnected) {
      alert('Please connect your wallet first');
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
      if (walletInfo.chainId !== chainId) {
        await switchChain();
      }

      console.log('🚀 Starting mobile token activation...');
      console.log(`📊 Current XMBL Price: ${currentPrice} BTC per token`);
      console.log(`💰 Activation Cost: ${activationCost} ETH`);

      const result = await activationService.activateTokens(
        chainId,
        amount,
        walletInfo.address,
        window.ethereum
      );

      if (result.success) {
        console.log('✅ Mobile token activation completed!');
        setActivationResult({
          success: true,
          message: '🎉 Mobile token activation completed successfully!',
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
      console.error('❌ Error in mobile activation:', error);
      setActivationResult({
        success: false,
        error: error.message || 'Failed to complete mobile activation'
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="mobile-activation">
      <div className="mobile-header">
        <h1>📱 XMBL Mobile Activation</h1>
        <p>Activate XMBL tokens from your mobile device</p>
      </div>

      <div className="activation-summary">
        <h3>📋 Activation Summary</h3>
        <div className="summary-details">
          <div><strong>Chain ID:</strong> {chainId}</div>
          <div><strong>Amount:</strong> {amount} XMBL</div>
          <div><strong>Current Price:</strong> {currentPrice} BTC per token</div>
          <div><strong>Activation Cost:</strong> {activationCost} ETH</div>
          <div><strong>Contract:</strong> {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}</div>
        </div>
      </div>

      <div className="wallet-section">
        <h3>🔗 Wallet Connection</h3>
        {walletInfo.isConnected ? (
          <div className="wallet-connected">
            <div className="wallet-info">
              <strong>✅ Connected:</strong> {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
            </div>
            <div className="wallet-actions">
              <button onClick={switchChain} className="switch-chain-btn">
                🔄 Switch to Chain {chainId}
              </button>
              <button 
                onClick={() => setWalletInfo({ address: '', chainId: 0, isConnected: false })}
                className="disconnect-btn"
              >
                🔌 Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button onClick={connectWallet} className="connect-wallet-btn">
            🔗 Connect Wallet
          </button>
        )}
      </div>

      <div className="activation-section">
        <button 
          onClick={handleActivate}
          disabled={isActivating || !walletInfo.isConnected}
          className="activate-button"
        >
          {isActivating ? '🔄 Activating...' : '🚀 Activate Tokens'}
        </button>
      </div>

      {activationResult && (
        <div className="activation-result">
          <h3>🔄 Activation Result</h3>
          {activationResult.success ? (
            <div className="success-result">
              <p><strong>✅ {activationResult.message}</strong></p>
              
              <div className="result-details">
                <div><strong>🔗 Transaction:</strong> {activationResult.transactionHash}</div>
                <div><strong>🆔 Deposit ID:</strong> {activationResult.depositId}</div>
                <div><strong>📊 New Token Count:</strong> {activationResult.newTokenCount}</div>
                <div><strong>💰 New XMBL Price:</strong> {activationResult.newXMBLPrice} BTC</div>
                <div><strong>₿ BTC Deposited:</strong> {activationResult.btcDeposited} BTC</div>
                <div><strong>📦 Block:</strong> {activationResult.blockNumber}</div>
                <div><strong>⛽ Gas Used:</strong> {activationResult.gasUsed}</div>
              </div>
            </div>
          ) : (
            <div className="error-result">
              <p><strong>❌ Activation Failed</strong></p>
              <p>{activationResult.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="mobile-footer">
        <p>🔒 Secure mobile activation powered by XMBL</p>
        <p>📱 Optimized for mobile wallets</p>
      </div>
    </div>
  );
};
