import React from 'react';

interface QuickActionsProps {
  onRefresh: () => void;
  onRunTests: (suite: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onRefresh, onRunTests }) => {
  const handleDeployToTestnet = () => {
    alert('Deploy to Testnet functionality would be implemented here');
  };

  const handleVerifyConnections = () => {
    onRefresh();
    alert('Verifying all connections...');
  };

  const handleGenerateReport = () => {
    alert('Generating status report...');
  };

  return (
    <div className="quick-actions">
      <button 
        onClick={onRefresh}
        title="Refresh Dashboard"
      >
        🔄
      </button>
      
      <button 
        onClick={() => onRunTests('real')}
        title="Run Integration Tests"
      >
        🧪
      </button>
      
      <button 
        onClick={handleVerifyConnections}
        title="Verify All Connections"
      >
        ✅
      </button>
      
      <button 
        onClick={handleDeployToTestnet}
        title="Deploy to Testnet"
      >
        🚀
      </button>
      
      <button 
        onClick={handleGenerateReport}
        title="Generate Status Report"
      >
        📊
      </button>
    </div>
  );
};
