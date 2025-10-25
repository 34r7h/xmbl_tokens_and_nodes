const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const router = express.Router();

// Get test status
router.get('/', async (req, res) => {
  try {
    const testResults = {
      mock: { passed: 0, failed: 0, total: 0, details: [] },
      real: { passed: 0, failed: 0, total: 0, details: [] },
      e2e: { passed: 0, failed: 0, total: 0, details: [] }
    };

    // Run mock tests
    try {
      const { stdout: mockOutput } = await execAsync('npm run test:mock');
      testResults.mock = parseTestOutput(mockOutput);
    } catch (error) {
      testResults.mock = { passed: 0, failed: 1, total: 1, details: [error.message] };
    }

    // Run integration tests
    try {
      const { stdout: realOutput } = await execAsync('npm run test:integration');
      testResults.real = parseTestOutput(realOutput);
    } catch (error) {
      testResults.real = { passed: 0, failed: 1, total: 1, details: [error.message] };
    }

    // Run E2E tests
    try {
      const { stdout: e2eOutput } = await execAsync('npm run test:e2e');
      testResults.e2e = parseTestOutput(e2eOutput);
    } catch (error) {
      testResults.e2e = { passed: 0, failed: 1, total: 1, details: [error.message] };
    }

    res.json(testResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run specific test suite
router.post('/run/:suite', async (req, res) => {
  try {
    const { suite } = req.params;
    let command;

    switch (suite) {
      case 'mock':
        command = 'npm run test:mock';
        break;
      case 'real':
        command = 'npm run test:integration';
        break;
      case 'e2e':
        command = 'npm run test:e2e';
        break;
      default:
        return res.status(400).json({ error: 'Invalid test suite' });
    }

    const { stdout, stderr } = await execAsync(command);
    const result = parseTestOutput(stdout);

    res.json({
      suite,
      result,
      output: stdout,
      errors: stderr
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function parseTestOutput(output) {
  const lines = output.split('\n');
  let passed = 0;
  let failed = 0;
  const details = [];

  for (const line of lines) {
    if (line.includes('✓') || line.includes('passing')) {
      passed++;
    } else if (line.includes('✗') || line.includes('failing')) {
      failed++;
    }
    if (line.trim()) {
      details.push(line.trim());
    }
  }

  return {
    passed,
    failed,
    total: passed + failed,
    details
  };
}

module.exports = { testsRouter: router };
