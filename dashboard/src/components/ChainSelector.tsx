import React, { useState, useEffect } from 'react';

interface Chain {
  id: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  status: 'connected' | 'disconnected' | 'unknown';
  blockHeight?: number;
  gasPrice?: string;
}

export const ChainSelector: React.FC = () => {
  const [selectedChain, setSelectedChain] = useState<number>(1);
  const [chains, setChains] = useState<Chain[]>([]);

  useEffect(() => {
    fetchChains();
  }, []);

  const fetchChains = async () => {
    try {
      const response = await fetch('/api/chains');
      const data = await response.json();
      setChains(data);
    } catch (error) {
      console.error('Error fetching chains:', error);
      setChains([]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      default: return '🟡';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#28a745';
      case 'disconnected': return '#dc3545';
      default: return '#ffc107';
    }
  };

  return (
    <div className="chain-selector">
      <h2>Chain Selection</h2>
      <p>Select and monitor supported blockchain networks</p>

      {chains.length === 0 ? (
        <div className="no-chains">
          <p>No chains available. Check configuration.</p>
        </div>
      ) : (
        <div className="chain-grid">
          {chains.map(chain => (
          <div 
            key={chain.id} 
            className={`chain-card ${selectedChain === chain.id ? 'selected' : ''}`}
            onClick={() => setSelectedChain(chain.id)}
          >
            <div className="chain-header">
              <h3>{chain.name}</h3>
              <span 
                className="status-indicator"
                style={{ color: getStatusColor(chain.status) }}
              >
                {getStatusIcon(chain.status)} {chain.status}
              </span>
            </div>

            <div className="chain-details">
              <div className="detail-item">
                <span className="label">Chain ID:</span>
                <span className="value">{chain.id}</span>
              </div>
              <div className="detail-item">
                <span className="label">Contract:</span>
                <span className="value">{chain.contractAddress}</span>
              </div>
              {chain.blockHeight && (
                <div className="detail-item">
                  <span className="label">Block Height:</span>
                  <span className="value">{chain.blockHeight.toLocaleString()}</span>
                </div>
              )}
              {chain.gasPrice && (
                <div className="detail-item">
                  <span className="label">Gas Price:</span>
                  <span className="value">{chain.gasPrice}</span>
                </div>
              )}
            </div>

            <div className="chain-actions">
              <button className="action-button">
                📊 View Explorer
              </button>
              <button className="action-button">
                🔗 View Contract
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      {chains.length > 0 && (
        <div className="selected-chain-info">
          <h3>Selected Chain Information</h3>
          {(() => {
            const selected = chains.find(c => c.id === selectedChain);
            return selected ? (
              <div className="selected-details">
                <p><strong>Network:</strong> {selected.name}</p>
                <p><strong>RPC URL:</strong> {selected.rpcUrl}</p>
                <p><strong>Contract Address:</strong> {selected.contractAddress}</p>
                <p><strong>Status:</strong> {selected.status}</p>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
};
