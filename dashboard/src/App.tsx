import React, { useState, useEffect } from 'react';
import { FeatureCard } from './components/FeatureCard';
import { ConnectionMap } from './components/ConnectionMap';
import { TestStatus } from './components/TestStatus';
import { QuickActions } from './components/QuickActions';
import { ConfigEditor } from './components/ConfigEditor';
import { TokenActivation } from './components/TokenActivation';
import { OracleDisplay } from './components/OracleDisplay';
import { ChainSelector } from './components/ChainSelector';
import { MobileActivation } from './components/MobileActivation';
import './ethers-global';
import './App.css';

interface Feature {
  id: string;
  name: string;
  category: 'contracts' | 'services' | 'integrations';
  status: 'implemented' | 'mock' | 'partial' | 'missing' | 'error' | 'unknown';
  testnetReady: boolean;
  blockers: string[];
  lastVerified: string;
}

interface TestResults {
  mock: { passed: number; failed: number; total: number; details: string[] };
  real: { passed: number; failed: number; total: number; details: string[] };
  e2e: { passed: number; failed: number; total: number; details: string[] };
}

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'features' | 'tests' | 'config' | 'activation' | 'oracle' | 'chains'>('features');
  const [isMobileActivation, setIsMobileActivation] = useState(false);
  const [mobileActivationParams, setMobileActivationParams] = useState<any>(null);

  useEffect(() => {
    loadData();
    checkMobileActivation();
  }, []);

  const checkMobileActivation = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mobile-activate')) {
      const params = {
        chainId: parseInt(urlParams.get('chainId') || '1'),
        amount: urlParams.get('amount') || '',
        contractAddress: urlParams.get('contractAddress') || '',
        currentPrice: urlParams.get('currentPrice') || '0.00000001',
        activationCost: urlParams.get('activationCost') || '0'
      };
      setMobileActivationParams(params);
      setIsMobileActivation(true);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load features
      const featuresResponse = await fetch('/api/features');
      const featuresData = await featuresResponse.json();
      setFeatures(featuresData);

      // Load test results
      const testsResponse = await fetch('/api/tests');
      const testsData = await testsResponse.json();
      setTestResults(testsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTests = async (suite: string) => {
    try {
      const response = await fetch(`/api/tests/run/${suite}`, { method: 'POST' });
      const result = await response.json();
      console.log(`Test results for ${suite}:`, result);
      await loadData(); // Refresh data
    } catch (error) {
      console.error(`Error running ${suite} tests:`, error);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading XMBL Dashboard...</h2>
          <p>Checking integrations and test status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>XMBL Dashboard</h1>
        <p>Cross-Chain Token Activation Platform Monitor</p>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'features' ? 'active' : ''}
          onClick={() => setActiveTab('features')}
        >
          Features
        </button>
        <button 
          className={activeTab === 'tests' ? 'active' : ''}
          onClick={() => setActiveTab('tests')}
        >
          Tests
        </button>
        <button 
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          Config
        </button>
        <button 
          className={activeTab === 'activation' ? 'active' : ''}
          onClick={() => setActiveTab('activation')}
        >
          Activation
        </button>
        <button 
          className={activeTab === 'oracle' ? 'active' : ''}
          onClick={() => setActiveTab('oracle')}
        >
          Oracle
        </button>
        <button 
          className={activeTab === 'chains' ? 'active' : ''}
          onClick={() => setActiveTab('chains')}
        >
          Chains
        </button>
      </nav>

      <main className="main">
        {isMobileActivation && mobileActivationParams ? (
          <MobileActivation 
            chainId={mobileActivationParams.chainId}
            amount={mobileActivationParams.amount}
            contractAddress={mobileActivationParams.contractAddress}
            currentPrice={mobileActivationParams.currentPrice}
            activationCost={mobileActivationParams.activationCost}
          />
        ) : activeTab === 'features' && (
          <div className="features-tab">
            <div className="features-grid">
              {features.map(feature => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
            <ConnectionMap features={features} />
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="tests-tab">
            <TestStatus testResults={testResults} onRunTests={runTests} />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-tab">
            <ConfigEditor onConfigUpdate={loadData} />
          </div>
        )}

        {activeTab === 'activation' && (
          <div className="activation-tab">
            <TokenActivation />
          </div>
        )}

        {activeTab === 'oracle' && (
          <div className="oracle-tab">
            <OracleDisplay />
          </div>
        )}

        {activeTab === 'chains' && (
          <div className="chains-tab">
            <ChainSelector />
          </div>
        )}
      </main>

      <QuickActions onRefresh={loadData} onRunTests={runTests} />
    </div>
  );
}

export default App;
