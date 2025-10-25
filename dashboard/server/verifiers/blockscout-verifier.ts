async function checkBlockscoutIntegration(): Promise<{
  status: 'implemented' | 'mock' | 'error' | 'unknown';
  testnetReady: boolean;
  blockers: string[];
  details: any;
}> {
  try {
    const mcpServerUrl = process.env.BLOCKSCOUT_MCP_SERVER_URL || 'http://localhost:3001';
    const apiKey = process.env.BLOCKSCOUT_API_KEY || '';

    // Try to connect to MCP server
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${mcpServerUrl}/health`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        // Try to get chains list to verify MCP functionality
        try {
          const chainsResponse = await axios.default.get(`${mcpServerUrl}/mcp/tools/get_chains_list`, {
            timeout: 10000,
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          return {
            status: 'implemented',
            testnetReady: true,
            blockers: [],
            details: {
              mcpServerUrl,
              healthStatus: response.data,
              chainsData: chainsResponse.data
            }
          };
        } catch (chainsError) {
          return {
            status: 'error',
            testnetReady: false,
            blockers: [`MCP tools not accessible: ${chainsError.message}`],
            details: { 
              mcpServerUrl,
              healthStatus: response.data,
              error: chainsError.message
            }
          };
        }
      } else {
        return {
          status: 'error',
          testnetReady: false,
          blockers: [`MCP server returned status ${response.status}`],
          details: { mcpServerUrl, status: response.status }
        };
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          status: 'error',
          testnetReady: false,
          blockers: [`MCP server not running at ${mcpServerUrl}`],
          details: { 
            mcpServerUrl,
            error: 'Connection refused',
            suggestion: 'Start MCP server with: docker-compose -f docker-compose.mcp.yml up'
          }
        };
      } else {
        return {
          status: 'error',
          testnetReady: false,
          blockers: [`MCP server error: ${error.message}`],
          details: { mcpServerUrl, error: error.message }
        };
      }
    }
  } catch (error) {
    return {
      status: 'error',
      testnetReady: false,
      blockers: [error.message],
      details: { error: error.message }
    };
  }
}

module.exports = { checkBlockscoutIntegration };
