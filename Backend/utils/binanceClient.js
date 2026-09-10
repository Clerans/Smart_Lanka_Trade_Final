const axios = require('axios');

const BINANCE_BASE_URLS = [
  'https://data-api.binance.vision/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
  'https://api.binance.com/api/v3'
];

/**
 * Execute a GET request against Binance with automatic multi-mirror failover
 * @param {string} endpoint - e.g. '/ticker/24hr' or '/klines'
 * @param {object} params - query parameters
 * @param {number} timeout - per-attempt timeout in ms
 * @returns {Promise<any>}
 */
async function fetchBinanceData(endpoint, params = {}, timeout = 5000) {
  let lastError = null;

  for (const baseUrl of BINANCE_BASE_URLS) {
    try {
      const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
      const response = await axios.get(url, {
        params,
        timeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SmartLankaTrade/1.0'
        }
      });

      if (response && response.data) {
        return response.data;
      }
    } catch (err) {
      lastError = err;
      // Continue to next mirror on failure
    }
  }

  throw lastError || new Error(`All Binance mirrors failed for endpoint: ${endpoint}`);
}

module.exports = {
  BINANCE_BASE_URLS,
  fetchBinanceData
};
