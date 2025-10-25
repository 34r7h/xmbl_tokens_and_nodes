async function checkPythIntegration(): Promise<{
  status: 'implemented' | 'mock' | 'error' | 'unknown';
  testnetReady: boolean;
  blockers: string[];
  details: any;
}> {
  try {
    // Check if PYTH_HERMES_URL is configured
    if (!process.env.PYTH_HERMES_URL) {
      return {
        status: 'error',
        testnetReady: false,
        blockers: ['PYTH_HERMES_URL not configured'],
        details: { error: 'Missing environment variable' }
      };
    }

    // Check if PYTH_BTC_USD_FEED_ID is configured
    if (!process.env.PYTH_BTC_USD_FEED_ID) {
      return {
        status: 'error',
        testnetReady: false,
        blockers: ['PYTH_BTC_USD_FEED_ID not configured'],
        details: { error: 'Missing feed ID' }
      };
    }

    // Try to fetch price from Hermes API
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${process.env.PYTH_HERMES_URL}/v2/updates/price/latest`, {
        params: {
          ids: [process.env.PYTH_BTC_USD_FEED_ID]
        },
        timeout: 10000
      });

      if (response.data && response.data.parsed && response.data.parsed.length > 0) {
        return {
          status: 'implemented',
          testnetReady: true,
          blockers: [],
          details: {
            hermesUrl: process.env.PYTH_HERMES_URL,
            feedId: process.env.PYTH_BTC_USD_FEED_ID,
            priceData: response.data.parsed[0]
          }
        };
      } else {
        return {
          status: 'error',
          testnetReady: false,
          blockers: ['No price data received from Hermes'],
          details: { error: 'Invalid response from Hermes API' }
        };
      }
    } catch (error) {
      return {
        status: 'error',
        testnetReady: false,
        blockers: [`Hermes API error: ${error.message}`],
        details: { error: error.message }
      };
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

module.exports = { checkPythIntegration };
