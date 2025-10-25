import React from 'react';

interface Feature {
  id: string;
  name: string;
  category: 'contracts' | 'services' | 'integrations';
  status: 'implemented' | 'mock' | 'partial' | 'missing' | 'error' | 'unknown';
  testnetReady: boolean;
  blockers: string[];
  lastVerified: string;
}

interface ConnectionMapProps {
  features: Feature[];
}

export const ConnectionMap: React.FC<ConnectionMapProps> = ({ features }) => {
  const getNodeClass = (feature: Feature) => {
    if (feature.status === 'implemented' && feature.testnetReady) {
      return 'node connected';
    } else if (feature.status === 'error') {
      return 'node disconnected';
    } else {
      return 'node';
    }
  };

  const getNodeIcon = (feature: Feature) => {
    switch (feature.category) {
      case 'contracts': return '📄';
      case 'services': return '⚙️';
      case 'integrations': return '🔗';
      default: return '📦';
    }
  };

  return (
    <div className="connection-map">
      <h2>System Architecture</h2>
      <p>Visual representation of component connections and status</p>
      
      <div className="nodes">
        {features.map(feature => (
          <div key={feature.id} className={getNodeClass(feature)}>
            <div className="node-icon">{getNodeIcon(feature)}</div>
            <div className="node-name">{feature.name}</div>
            <div className="node-status">
              {feature.status === 'implemented' ? '✅ Implemented' : 
               feature.status === 'mock' ? '⚠️ Mock' :
               feature.status === 'error' ? '❌ Error' : '❓ Unknown'}
            </div>
            <div className="node-ready">
              {feature.testnetReady ? '🚀 Ready' : '⏳ Not Ready'}
            </div>
          </div>
        ))}
      </div>

      <div className="legend">
        <h3>Legend:</h3>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color connected"></span>
            <span>Connected & Ready</span>
          </div>
          <div className="legend-item">
            <span className="legend-color disconnected"></span>
            <span>Disconnected</span>
          </div>
          <div className="legend-item">
            <span className="legend-color"></span>
            <span>Unknown Status</span>
          </div>
        </div>
      </div>
    </div>
  );
};
