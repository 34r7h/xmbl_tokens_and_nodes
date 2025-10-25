import { BlockscoutMCPService } from './BlockscoutMCPService';

/**
 * @title MCPApplication
 * @dev Full application using Blockscout MCP server for AI-powered blockchain analytics
 * Provides conversational blockchain analytics and activation auditing
 */
export class MCPApplication {
  private mcpService: BlockscoutMCPService;
  private conversationHistory: Array<{
    timestamp: number;
    user: string;
    assistant: string;
    context: any;
  }>;

  constructor(mcpService: BlockscoutMCPService) {
    this.mcpService = mcpService;
    this.conversationHistory = [];
  }

  /**
   * @dev Process user query with AI reasoning
   */
  async processQuery(query: string, context: any = {}): Promise<{
    response: string;
    analysis: any;
    recommendations: string[];
  }> {
    try {
      // Analyze query intent
      const intent = await this.analyzeQueryIntent(query);
      
      // Get relevant blockchain data
      const blockchainData = await this.getRelevantData(intent, context);
      
      // Perform AI reasoning
      const analysis = await this.performAIReasoning(query, blockchainData);
      
      // Generate response
      const response = await this.generateResponse(query, analysis);
      
      // Store conversation
      this.conversationHistory.push({
        timestamp: Date.now(),
        user: query,
        assistant: response,
        context: analysis
      });
      
      return {
        response,
        analysis,
        recommendations: analysis.recommendations || []
      };
    } catch (error: any) {
      console.error('Error processing query:', error);
      return {
        response: 'Sorry, I encountered an error processing your query.',
        analysis: { error: error?.message || String(error) },
        recommendations: []
      };
    }
  }

  /**
   * @dev Analyze query intent
   */
  private async analyzeQueryIntent(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('activation') || lowerQuery.includes('sequence')) {
      return 'activation_analysis';
    } else if (lowerQuery.includes('price') || lowerQuery.includes('oracle')) {
      return 'price_analysis';
    } else if (lowerQuery.includes('transaction') || lowerQuery.includes('tx')) {
      return 'transaction_analysis';
    } else if (lowerQuery.includes('address') || lowerQuery.includes('wallet')) {
      return 'address_analysis';
    } else if (lowerQuery.includes('anomaly') || lowerQuery.includes('suspicious')) {
      return 'anomaly_detection';
    } else {
      return 'general_analysis';
    }
  }

  /**
   * @dev Get relevant blockchain data based on intent
   */
  private async getRelevantData(intent: string, context: any): Promise<any> {
    switch (intent) {
      case 'activation_analysis':
        return await this.mcpService.analyzeActivationSequence(
          context.chainId || 1,
          context.contractAddress || '',
          context.timeRange || '24h'
        );
      
      case 'address_analysis':
        return await this.mcpService.getAddressInfo(
          context.chainId || 1,
          context.address || ''
        );
      
      case 'transaction_analysis':
        // Mock transaction analysis
        return {
          type: 'transaction',
          hash: context.txHash || '',
          status: 'confirmed',
          blockNumber: 12345
        };
      
      default:
        return { type: 'general', data: 'No specific data requested' };
    }
  }

  /**
   * @dev Perform AI reasoning on blockchain data
   */
  private async performAIReasoning(query: string, data: any): Promise<any> {
    try {
      // Use real MCP service for AI analysis
      const mcpAnalysis = await this.mcpService.analyzeActivationSequence(
        data.chainId || 1,
        data.contractAddress || '',
        data.timeRange || '24h'
      );

      const analysis: any = {
        query: query,
        data: data,
        insights: [],
        anomalies: mcpAnalysis.anomalies || [],
        recommendations: mcpAnalysis.recommendations || [],
        confidence: 0.9 // Higher confidence with real MCP analysis
      };

      // Process MCP analysis results
      const insights: string[] = [];
      if (mcpAnalysis.anomalies && mcpAnalysis.anomalies.length > 0) {
        insights.push('MCP analysis detected potential issues');
        insights.push(mcpAnalysis.summary);
      } else {
        insights.push('No anomalies detected by MCP analysis');
      }
      analysis.insights = insights;

      return analysis;
    } catch (error: any) {
      console.error('Error performing AI reasoning via MCP:', error);
      
      // Fallback to basic analysis if MCP fails
      return {
        query: query,
        data: data,
        insights: ['MCP analysis unavailable, using fallback reasoning'],
        anomalies: [
          {
            type: 'mcp_error',
            description: 'Unable to perform MCP analysis: ' + (error?.message || String(error)),
            severity: 'warning'
          }
        ],
        recommendations: [
          'Check MCP server connectivity',
          'Verify MCP service configuration',
          'Review error logs for details'
        ],
        confidence: 0.3 // Lower confidence with fallback
      };
    }
  }

  /**
   * @dev Generate conversational response
   */
  private async generateResponse(query: string, analysis: any): Promise<string> {
    let response = `Based on my analysis of your query: "${query}"\n\n`;
    
    if (analysis.insights.length > 0) {
      response += `**Key Insights:**\n`;
      analysis.insights.forEach((insight: string) => {
        response += `• ${insight}\n`;
      });
      response += `\n`;
    }

    if (analysis.anomalies.length > 0) {
      response += `**Anomalies Detected:**\n`;
      analysis.anomalies.forEach((anomaly: any) => {
        response += `• ${anomaly.description || anomaly}\n`;
      });
      response += `\n`;
    }

    if (analysis.recommendations.length > 0) {
      response += `**Recommendations:**\n`;
      analysis.recommendations.forEach((rec: string) => {
        response += `• ${rec}\n`;
      });
      response += `\n`;
    }

    response += `Confidence: ${Math.round(analysis.confidence * 100)}%`;

    return response;
  }

  /**
   * @dev Get conversation history
   */
  getConversationHistory(): Array<{
    timestamp: number;
    user: string;
    assistant: string;
    context: any;
  }> {
    return this.conversationHistory;
  }

  /**
   * @dev Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('Conversation history cleared');
  }

  /**
   * @dev Get application status
   */
  getApplicationStatus(): {
    mcpConnected: boolean;
    conversationCount: number;
    lastActivity: number;
    capabilities: string[];
  } {
    const lastActivity = this.conversationHistory.length > 0 
      ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
      : 0;

    return {
      mcpConnected: true, // Mock connection status
      conversationCount: this.conversationHistory.length,
      lastActivity,
      capabilities: [
        'activation_analysis',
        'price_analysis',
        'transaction_analysis',
        'address_analysis',
        'anomaly_detection',
        'conversational_analytics'
      ]
    };
  }

  /**
   * @dev Export conversation data
   */
  exportConversationData(): any {
    return {
      timestamp: Date.now(),
      totalConversations: this.conversationHistory.length,
      conversations: this.conversationHistory,
      mcpConfig: this.mcpService.getMCPConfig()
    };
  }

  /**
   * @dev Get activation auditor interface
   */
  async getActivationAuditorInterface(): Promise<{
    prompt: string;
    tools: any[];
    examples: string[];
  }> {
    const prompt = this.mcpService.createActivationAuditPrompt();
    const tools = this.mcpService.getAvailableTools();
    
    const examples = [
      'Analyze activation sequence for the last 24 hours',
      'Check for anomalies in price locking mechanism',
      'Verify cross-chain deposit consistency',
      'Identify failed settlement patterns',
      'Generate activation audit report'
    ];

    return {
      prompt,
      tools,
      examples
    };
  }
}
