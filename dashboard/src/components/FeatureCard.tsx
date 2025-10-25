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

interface FeatureCardProps {
  feature: Feature;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ feature }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return '#28a745';
      case 'mock': return '#ffc107';
      case 'error': return '#dc3545';
      case 'unknown': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented': return '✅';
      case 'mock': return '⚠️';
      case 'error': return '❌';
      case 'unknown': return '❓';
      default: return '❓';
    }
  };

  const getTestnetIcon = (ready: boolean) => {
    return ready ? '🚀' : '⏳';
  };

  return (
    <div className={`feature-card ${feature.status}`}>
      <h3>{feature.name}</h3>
      
      <div className="status" style={{ backgroundColor: getStatusColor(feature.status) + '20', color: getStatusColor(feature.status) }}>
        {getStatusIcon(feature.status)} {feature.status.toUpperCase()}
      </div>

      <div className="testnet-ready">
        <span className="icon">{getTestnetIcon(feature.testnetReady)}</span>
        <span>{feature.testnetReady ? 'Testnet Ready' : 'Not Ready'}</span>
      </div>

      <div className="category">
        <strong>Category:</strong> {feature.category}
      </div>

      <div className="last-verified">
        <strong>Last Verified:</strong> {new Date(feature.lastVerified).toLocaleString()}
      </div>

      {feature.blockers.length > 0 && (
        <div className="blockers">
          <h4>Blockers:</h4>
          <ul>
            {feature.blockers.map((blocker, index) => (
              <li key={index}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
