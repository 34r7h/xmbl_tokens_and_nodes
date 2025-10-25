import React, { useState, useEffect } from 'react';

interface PriceData {
  btcPrice: number;
  xmblPrice: number;
  tokensActivated: number;
  totalValue: number;
  nextActivationCost: number;
  lastUpdated: string;
  btcPools: {
    liquidityPool: {
      address: string;
      holdings: string;
      verification: string;
    };
    developerPool: {
      address: string;
      holdings: string;
      verification: string;
    };
  };
}

export const OracleDisplay: React.FC = () => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPriceData();
    const interval = setInterval(fetchPriceData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPriceData = async () => {
    try {
      const response = await fetch('/api/oracle/prices');
      const data = await response.json();
      setPriceData(data);
    } catch (error) {
      console.error('Error fetching price data:', error);
      setPriceData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="oracle-display">
        <h2>Oracle Pricing</h2>
        <p>Loading price data...</p>
      </div>
    );
  }

  if (!priceData) {
    return (
      <div className="oracle-display">
        <h2>Oracle Pricing</h2>
        <p>Unable to fetch price data. Check Pyth integration status.</p>
      </div>
    );
  }

  return (
    <div className="oracle-display">
      <h2>Oracle Pricing</h2>
      <p>Real-time price feeds and token activation statistics</p>

      <div className="price-grid">
        <div className="price-card">
          <h3>BTC Price</h3>
          <div className="price-value">
            ${priceData?.btcPrice ? priceData.btcPrice.toLocaleString() : 'N/A'}
          </div>
          <div className="price-label">USD per BTC</div>
        </div>

        <div className="price-card">
          <h3>XMBL Price</h3>
          <div className="price-value">
            {priceData?.xmblPrice ? priceData.xmblPrice.toFixed(8) : 'N/A'} BTC
          </div>
          <div className="price-label">per XMBL token</div>
        </div>

        <div className="price-card">
          <h3>Tokens Activated</h3>
          <div className="price-value">
            {priceData?.tokensActivated ? priceData.tokensActivated.toLocaleString() : 'N/A'}
          </div>
          <div className="price-label">total activated</div>
        </div>

        <div className="price-card">
          <h3>Total Value</h3>
          <div className="price-value">
            {priceData?.totalValue ? priceData.totalValue.toFixed(8) : 'N/A'} BTC
          </div>
          <div className="price-label">locked value</div>
        </div>

        <div className="price-card">
          <h3>Next Activation Cost</h3>
          <div className="price-value">
            {priceData?.nextActivationCost ? priceData.nextActivationCost.toFixed(6) : 'N/A'} ETH
          </div>
          <div className="price-label">estimated cost</div>
        </div>
      </div>

      <div className="btc-pools">
        <h3>BTC Pools</h3>
        <div className="pool-grid">
          <div className="pool-card">
            <h4>Liquidity Pool</h4>
            <div className="pool-address">
              {priceData?.btcPools?.liquidityPool?.address || 'N/A'}
            </div>
            <div className="pool-holdings">
              Holdings: {priceData?.btcPools?.liquidityPool?.holdings || '0.00000000'} BTC
            </div>
            <a 
              href={priceData?.btcPools?.liquidityPool?.verification} 
              target="_blank" 
              rel="noopener noreferrer"
              className="verification-link"
            >
              🔗 Verify on Blockstream
            </a>
          </div>
          
          <div className="pool-card">
            <h4>Developer Pool</h4>
            <div className="pool-address">
              {priceData?.btcPools?.developerPool?.address || 'N/A'}
            </div>
            <div className="pool-holdings">
              Holdings: {priceData?.btcPools?.developerPool?.holdings || '0.00000000'} BTC
            </div>
            <a 
              href={priceData?.btcPools?.developerPool?.verification} 
              target="_blank" 
              rel="noopener noreferrer"
              className="verification-link"
            >
              🔗 Verify on Blockstream
            </a>
          </div>
        </div>
      </div>

      <div className="oracle-status">
        <div className="status-item">
          <span className="label">Last Updated:</span>
          <span className="value">
            {priceData?.lastUpdated ? new Date(priceData.lastUpdated).toLocaleString() : 'Never'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Oracle Status:</span>
          <span className="value status-active">Active</span>
        </div>
        <div className="status-item">
          <span className="label">Price Source:</span>
          <span className="value">Pyth Network</span>
        </div>
      </div>

      <button onClick={fetchPriceData} className="refresh-button">
        🔄 Refresh Prices
      </button>
    </div>
  );
};
