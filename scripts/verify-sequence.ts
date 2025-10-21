#!/usr/bin/env ts-node

import { ethers } from 'hardhat';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BlockscoutMCPService } from '../services/BlockscoutMCPService';
import { MCPApplication } from '../services/MCPApplication';

config();

interface VerificationConfig {
  network: string;
  contracts: {
    [key: string]: {
      address: string;
    };
  };
}

/**
 * @title Verify Sequence Script
 * @dev Verifies activation sequences and provides AI-powered auditing
 * Uses Blockscout MCP for conversational blockchain analytics
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'verify';
  const contractAddress = args[1];
  const timeRange = args[2] || '24h';

  console.log(`Verifying sequences - Command: ${command}`);
  if (contractAddress) {
    console.log(`Contract: ${contractAddress}`);
  }
  console.log(`Time range: ${timeRange}`);

  try {
    // Load deployment configuration
    const network = process.env.HARDHAT_NETWORK || 'hardhat';
    const configPath = join(process.cwd(), 'deployments', `${network}.json`);
    let deploymentConfig: VerificationConfig;
    
    try {
      const configData = readFileSync(configPath, 'utf8');
      deploymentConfig = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Could not load deployment configuration. Run deployment first.');
      process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Verifying with account: ${signer.address}`);

    // Initialize MCP services
    const mcpService = new BlockscoutMCPService({
      apiKey: process.env.BLOCKSCOUT_API_KEY || 'test-api-key',
      mcpServerUrl: process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3000'
    });

    const mcpApp = new MCPApplication(mcpService);

    switch (command) {
      case 'verify':
        await verifyActivationSequence(mcpApp, deploymentConfig, contractAddress, timeRange);
        break;
      case 'audit':
        await auditActivationSequence(mcpApp, deploymentConfig, contractAddress, timeRange);
        break;
      case 'analyze':
        await analyzeSequence(mcpApp, deploymentConfig, contractAddress, timeRange);
        break;
      case 'report':
        await generateReport(mcpApp, deploymentConfig, contractAddress, timeRange);
        break;
      default:
        console.log('Available commands:');
        console.log('  verify  - Verify activation sequence integrity');
        console.log('  audit   - Perform AI-powered audit');
        console.log('  analyze - Analyze sequence patterns');
        console.log('  report  - Generate detailed report');
        console.log('\nUsage: npm run verify-sequence <command> [contract_address] [time_range]');
        break;
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

async function verifyActivationSequence(
  mcpApp: MCPApplication,
  config: VerificationConfig,
  contractAddress?: string,
  timeRange: string = '24h'
) {
  console.log('\n=== VERIFYING ACTIVATION SEQUENCE ===');
  
  const targetContract = contractAddress || config.contracts.DepositManager.address;
  console.log(`Target contract: ${targetContract}`);
  console.log(`Time range: ${timeRange}`);

  try {
    // Query for activation status
    const query = `Check activation status for contract ${targetContract} in the last ${timeRange}`;
    console.log(`Query: ${query}`);
    
    const result = await mcpApp.processQuery(query);
    console.log('\n📊 Verification Results:');
    console.log(`Response: ${result.response}`);
    console.log(`Analysis: ${result.analysis}`);
    console.log(`Recommendations: ${result.recommendations}`);

    // Get conversation history
    const history = mcpApp.getConversationHistory();
    console.log(`\n📝 Conversation entries: ${history.length}`);

    if (history.length > 0) {
      console.log('\nRecent conversation:');
      history.slice(-2).forEach((entry, index) => {
        console.log(`  ${index + 1}. User: ${entry.user}`);
        console.log(`     Assistant: ${entry.assistant.substring(0, 100)}...`);
      });
    }

    console.log('\n✅ Verification completed');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function auditActivationSequence(
  mcpApp: MCPApplication,
  config: VerificationConfig,
  contractAddress?: string,
  timeRange: string = '24h'
) {
  console.log('\n=== AI-POWERED AUDIT ===');
  
  const targetContract = contractAddress || config.contracts.DepositManager.address;
  console.log(`Auditing contract: ${targetContract}`);
  console.log(`Time range: ${timeRange}`);

  try {
    // Create audit prompt
    const auditQuery = `Perform a comprehensive security audit of activation sequences for contract ${targetContract} over the last ${timeRange}. Look for anomalies, potential risks, and security issues.`;
    console.log(`Audit query: ${auditQuery}`);
    
    const auditResult = await mcpApp.processQuery(auditQuery);
    console.log('\n🔍 Audit Results:');
    console.log(`Response: ${auditResult.response}`);
    console.log(`Analysis: ${auditResult.analysis}`);
    console.log(`Recommendations: ${auditResult.recommendations}`);

    // Additional security checks
    console.log('\n🛡️ Security Checks:');
    const securityQueries = [
      `Check for unusual transaction patterns in contract ${targetContract}`,
      `Analyze potential MEV attacks on contract ${targetContract}`,
      `Verify proper access controls for contract ${targetContract}`
    ];

    for (const query of securityQueries) {
      try {
        const result = await mcpApp.processQuery(query);
        console.log(`\n  ✓ ${query}`);
        console.log(`    ${result.response.substring(0, 100)}...`);
      } catch (error) {
        console.log(`  ❌ ${query} - Failed: ${error}`);
      }
    }

    console.log('\n✅ Audit completed');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

async function analyzeSequence(
  mcpApp: MCPApplication,
  config: VerificationConfig,
  contractAddress?: string,
  timeRange: string = '24h'
) {
  console.log('\n=== SEQUENCE ANALYSIS ===');
  
  const targetContract = contractAddress || config.contracts.DepositManager.address;
  console.log(`Analyzing contract: ${targetContract}`);
  console.log(`Time range: ${timeRange}`);

  try {
    // Analyze activation patterns
    const analysisQuery = `Analyze activation sequence patterns for contract ${targetContract} over the last ${timeRange}. Identify trends, anomalies, and optimization opportunities.`;
    console.log(`Analysis query: ${analysisQuery}`);
    
    const analysisResult = await mcpApp.processQuery(analysisQuery);
    console.log('\n📈 Analysis Results:');
    console.log(`Response: ${analysisResult.response}`);
    console.log(`Analysis: ${analysisResult.analysis}`);
    console.log(`Recommendations: ${analysisResult.recommendations}`);

    // Get address information
    console.log('\n🔍 Address Analysis:');
    const addressQuery = `Get address info for ${targetContract}`;
    const addressResult = await mcpApp.processQuery(addressQuery);
    console.log(`Address info: ${addressResult.response}`);

    // Get token holdings
    console.log('\n💰 Token Holdings:');
    const holdingsQuery = `Show token holdings for ${targetContract}`;
    const holdingsResult = await mcpApp.processQuery(holdingsQuery);
    console.log(`Token holdings: ${holdingsResult.response}`);

    console.log('\n✅ Analysis completed');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

async function generateReport(
  mcpApp: MCPApplication,
  config: VerificationConfig,
  contractAddress?: string,
  timeRange: string = '24h'
) {
  console.log('\n=== GENERATING REPORT ===');
  
  const targetContract = contractAddress || config.contracts.DepositManager.address;
  console.log(`Generating report for: ${targetContract}`);
  console.log(`Time range: ${timeRange}`);

  try {
    // Generate comprehensive report
    const reportQuery = `Generate a comprehensive report for contract ${targetContract} covering activation sequences, security analysis, and recommendations for the last ${timeRange}.`;
    console.log(`Report query: ${reportQuery}`);
    
    const reportResult = await mcpApp.processQuery(reportQuery);
    console.log('\n📋 Report Generated:');
    console.log(`Response: ${reportResult.response}`);
    console.log(`Analysis: ${reportResult.analysis}`);
    console.log(`Recommendations: ${reportResult.recommendations}`);

    // Export conversation history
    console.log('\n📄 Exporting conversation history...');
    const history = mcpApp.getConversationHistory();
    const exportData = mcpApp.exportConversationHistory('json');
    
    // Save report to file
    const reportPath = join(process.cwd(), 'exports', `verification_report_${Date.now()}.json`);
    const fs = require('fs');
    const path = require('path');
    
    // Ensure exports directory exists
    const exportsDir = path.dirname(reportPath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const reportData = {
      timestamp: new Date().toISOString(),
      contract: targetContract,
      timeRange,
      verification: reportResult,
      conversationHistory: JSON.parse(exportData)
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    console.log('\n✅ Report generation completed');

  } catch (error) {
    console.error('❌ Report generation failed:', error);
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as verifySequence };
