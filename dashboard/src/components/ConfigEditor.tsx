import React, { useState, useEffect } from 'react';

interface Config {
  avail: {
    rpcUrl: string;
    chainId: string;
    apiKey: string;
  };
  pyth: {
    hermesUrl: string;
    btcUsdFeedId: string;
  };
  blockscout: {
    mcpServerUrl: string;
    apiKey: string;
  };
}

interface EnvStatus {
  AVAIL_RPC_URL: boolean;
  AVAIL_CHAIN_ID: boolean;
  AVAIL_API_KEY: boolean;
  PYTH_HERMES_URL: boolean;
  PYTH_BTC_USD_FEED_ID: boolean;
  BLOCKSCOUT_MCP_SERVER_URL: boolean;
  BLOCKSCOUT_API_KEY: boolean;
}

interface ConfigEditorProps {
  onConfigUpdate: () => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState<Config>({
    avail: { rpcUrl: '', chainId: '2024', apiKey: '' },
    pyth: { hermesUrl: '', btcUsdFeedId: '' },
    blockscout: { mcpServerUrl: 'http://localhost:3001', apiKey: '' }
  });
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      
      const [configResponse, envResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/config/env')
      ]);
      
      const configData = await configResponse.json();
      const envData = await envResponse.json();
      
      setConfig(configData);
      setEnvStatus(envData);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        alert('Configuration saved successfully!');
        onConfigUpdate();
      } else {
        alert('Error saving configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section: keyof Config, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="config-editor">
        <h2>Loading Configuration...</h2>
      </div>
    );
  }

  return (
    <div className="config-editor">
      <h2>Configuration Editor</h2>
      <p>Configure your integrations and API keys</p>

      <div className="config-sections">
        <div className="config-section">
          <h3>🔗 Avail Nexus Configuration</h3>
          <div className="form-group">
            <label>RPC URL:</label>
            <input
              type="text"
              value={config.avail.rpcUrl}
              onChange={(e) => updateConfig('avail', 'rpcUrl', e.target.value)}
              placeholder="https://rpc.avail.tools"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.AVAIL_RPC_URL ? 'set' : 'not-set'}`}>
                {envStatus.AVAIL_RPC_URL ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label>Chain ID:</label>
            <input
              type="text"
              value={config.avail.chainId}
              onChange={(e) => updateConfig('avail', 'chainId', e.target.value)}
              placeholder="2024"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.AVAIL_CHAIN_ID ? 'set' : 'not-set'}`}>
                {envStatus.AVAIL_CHAIN_ID ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label>API Key:</label>
            <input
              type="password"
              value={config.avail.apiKey}
              onChange={(e) => updateConfig('avail', 'apiKey', e.target.value)}
              placeholder="Your Avail API key"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.AVAIL_API_KEY ? 'set' : 'not-set'}`}>
                {envStatus.AVAIL_API_KEY ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
        </div>

        <div className="config-section">
          <h3>📊 Pyth Network Configuration</h3>
          <div className="form-group">
            <label>Hermes URL:</label>
            <input
              type="text"
              value={config.pyth.hermesUrl}
              onChange={(e) => updateConfig('pyth', 'hermesUrl', e.target.value)}
              placeholder="https://hermes.pyth.network"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.PYTH_HERMES_URL ? 'set' : 'not-set'}`}>
                {envStatus.PYTH_HERMES_URL ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label>BTC/USD Feed ID:</label>
            <input
              type="text"
              value={config.pyth.btcUsdFeedId}
              onChange={(e) => updateConfig('pyth', 'btcUsdFeedId', e.target.value)}
              placeholder="0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.PYTH_BTC_USD_FEED_ID ? 'set' : 'not-set'}`}>
                {envStatus.PYTH_BTC_USD_FEED_ID ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
        </div>

        <div className="config-section">
          <h3>🔍 Blockscout MCP Configuration</h3>
          <div className="form-group">
            <label>MCP Server URL:</label>
            <input
              type="text"
              value={config.blockscout.mcpServerUrl}
              onChange={(e) => updateConfig('blockscout', 'mcpServerUrl', e.target.value)}
              placeholder="http://localhost:3001"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.BLOCKSCOUT_MCP_SERVER_URL ? 'set' : 'not-set'}`}>
                {envStatus.BLOCKSCOUT_MCP_SERVER_URL ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label>API Key:</label>
            <input
              type="password"
              value={config.blockscout.apiKey}
              onChange={(e) => updateConfig('blockscout', 'apiKey', e.target.value)}
              placeholder="Your Blockscout API key"
            />
            {envStatus && (
              <span className={`env-status ${envStatus.BLOCKSCOUT_API_KEY ? 'set' : 'not-set'}`}>
                {envStatus.BLOCKSCOUT_API_KEY ? '✅ Set' : '❌ Not Set'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="config-actions">
        <button 
          onClick={saveConfig} 
          disabled={saving}
          className="save-button"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        
        <button 
          onClick={loadConfig}
          className="refresh-button"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};
