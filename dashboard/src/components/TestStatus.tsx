import React from 'react';

interface TestResults {
  mock: { passed: number; failed: number; total: number; details: string[] };
  real: { passed: number; failed: number; total: number; details: string[] };
  e2e: { passed: number; failed: number; total: number; details: string[] };
}

interface TestStatusProps {
  testResults: TestResults | null;
  onRunTests: (suite: string) => void;
}

export const TestStatus: React.FC<TestStatusProps> = ({ testResults, onRunTests }) => {
  if (!testResults) {
    return (
      <div className="test-results">
        <div className="test-suite">
          <h3>Loading Test Results...</h3>
          <p>Please wait while we fetch the latest test status.</p>
        </div>
      </div>
    );
  }

  const TestSuiteCard: React.FC<{ 
    title: string; 
    suite: keyof TestResults; 
    results: TestResults[keyof TestResults];
  }> = ({ title, suite, results }) => {
    const successRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;
    
    return (
      <div className="test-suite">
        <h3>{title}</h3>
        
        <div className="stats">
          <div className="stat">
            <div className="number passed">{results.passed}</div>
            <div className="label">Passed</div>
          </div>
          <div className="stat">
            <div className="number failed">{results.failed}</div>
            <div className="label">Failed</div>
          </div>
          <div className="stat">
            <div className="number">{results.total}</div>
            <div className="label">Total</div>
          </div>
        </div>

        <div className="success-rate">
          <strong>Success Rate: {successRate.toFixed(1)}%</strong>
        </div>

        {results.details.length > 0 && (
          <div className="test-details">
            <h4>Test Details:</h4>
            <ul>
              {results.details.slice(0, 5).map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
              {results.details.length > 5 && (
                <li>... and {results.details.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        <button onClick={() => onRunTests(suite)}>
          Run {title} Tests
        </button>
      </div>
    );
  };

  return (
    <div className="test-results">
      <TestSuiteCard 
        title="Mock Tests" 
        suite="mock" 
        results={testResults.mock} 
      />
      <TestSuiteCard 
        title="Integration Tests" 
        suite="real" 
        results={testResults.real} 
      />
      <TestSuiteCard 
        title="End-to-End Tests" 
        suite="e2e" 
        results={testResults.e2e} 
      />
    </div>
  );
};
