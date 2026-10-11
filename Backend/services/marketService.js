const axios = require("axios");
const { fetchBinanceData } = require("../utils/binanceClient");

// Canonical list of supported market symbols
const ALLOWED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT'];

function normalizeSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;
  let normalized = symbol.toUpperCase().trim().replace('/', '');
  if (!normalized.endsWith('USDT')) {
    normalized = normalized + 'USDT';
  }
  return normalized;
}

// Shared rate & inflight caches
let cachedUsdToLkr = null;
let cachedUsdToLkrTime = 0;
let cachedUsdToLkrSource = 'uninitialized';
let inflightLivePricesPromise = null;

// 1. Get crypto ticker from Binance (Price + 24h Change)
async function getCryptoTicker(symbol = "BTCUSDT") {
  const norm = normalizeSymbol(symbol);
  // Special case for USDT/USDT (used for LKR/USDT rate alerts)
  if (symbol === "USDTUSDT" || symbol === "USDT") {
    return {
      price: 1.0,
      changePercent: 0
    };
  }

  if (!norm || !ALLOWED_SYMBOLS.includes(norm)) {
    throw new Error(`Symbol '${symbol}' is not allowed. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`);
  }

  const data = await fetchBinanceData('/ticker/24hr', { symbol: norm }, 4000);

  return {
    price: parseFloat(data.lastPrice),
    changePercent: parseFloat(data.priceChangePercent)
  };
}

// 2. Get USD → LKR rate with explicit source disclosure
async function getUSDToLKRDetails() {
  if (cachedUsdToLkr && (Date.now() - cachedUsdToLkrTime) < 60000) {
    return {
      rate: cachedUsdToLkr,
      source: cachedUsdToLkrSource,
      isEstimated: cachedUsdToLkrSource === 'fallback_estimate',
      updatedAt: new Date(cachedUsdToLkrTime).toISOString()
    };
  }

  try {
    const response = await axios.get(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { timeout: 3500 }
    );
    if (response.data && response.data.rates && response.data.rates.LKR) {
      cachedUsdToLkr = parseFloat(response.data.rates.LKR);
      cachedUsdToLkrTime = Date.now();
      cachedUsdToLkrSource = 'live';
      return {
        rate: cachedUsdToLkr,
        source: 'live',
        isEstimated: false,
        updatedAt: new Date(cachedUsdToLkrTime).toISOString()
      };
    }
  } catch (err) {
    console.warn('⚠️ Currency API warning, using cached or fallback rate:', err.message);
  }

  if (cachedUsdToLkr) {
    return {
      rate: cachedUsdToLkr,
      source: 'stale_cache',
      isEstimated: true,
      updatedAt: new Date(cachedUsdToLkrTime).toISOString()
    };
  }

  cachedUsdToLkr = 328.2;
  cachedUsdToLkrTime = Date.now();
  cachedUsdToLkrSource = 'fallback_estimate';

  return {
    rate: 328.2,
    source: 'fallback_estimate',
    isEstimated: true,
    updatedAt: new Date(cachedUsdToLkrTime).toISOString()
  };
}

async function getUSDToLKR() {
  const details = await getUSDToLKRDetails();
  return details.rate;
}

// 3. Final conversion
async function getPriceInLKR(symbol) {
  const ticker = await getCryptoTicker(symbol);
  const fxDetails = await getUSDToLKRDetails();

  return {
    symbol,
    priceUSDT: ticker.price,
    changePercent: ticker.changePercent,
    usdToLkr: fxDetails.rate,
    isRateEstimated: fxDetails.isEstimated,
    rateSource: fxDetails.source,
    priceLKR: Math.round(ticker.price * fxDetails.rate * 100) / 100,
  };
}

// 4. Get multiple prices with optional sparklines
async function getMultiplePricesInLKR(symbols = ["BTCUSDT", "ETHUSDT"], includeSparkline = false) {
  const usdToLkr = await getUSDToLKR();
  
  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      const ticker = await getCryptoTicker(symbol);
      let sparkline = [];

      if (includeSparkline) {
        if (symbol === "USDTUSDT" || symbol === "USDT") {
          sparkline = Array(24).fill(1.0);
        } else {
          // Fetch last 24 1-hour candles
          try {
            const klinesData = await fetchBinanceData('/klines', { symbol, interval: '1h', limit: 24 }, 3500);
            sparkline = klinesData.map(k => parseFloat(k[4])); // Closing prices
          } catch (e) {
            sparkline = [];
          }
        }
      }

      return {
        symbol,
        priceUSDT: ticker.price,
        changePercent: ticker.changePercent,
        usdToLkr,
        priceLKR: ticker.price * usdToLkr,
        sparkline
      };
    } catch (err) {
      return {
        symbol,
        priceUSDT: 0,
        changePercent: 0,
        usdToLkr,
        priceLKR: 0,
        sparkline: []
      };
    }
  }));

  return {
    usdToLkr,
    totalCoins: results.length,
    prices: results
  };
}

// 5. Get ALL USDT prices from Binance
async function getAllPricesInLKR() {
  const usdToLkr = await getUSDToLKR();
  
  // Call 24hr ticker without symbol to get ALL symbols with failover
  const data = await fetchBinanceData('/ticker/24hr', {}, 5000);
  
  const results = data
    .filter(ticker => ticker.symbol && ticker.symbol.endsWith("USDT"))
    .map(ticker => ({
      symbol: ticker.symbol,
      priceUSDT: parseFloat(ticker.lastPrice),
      changePercent: parseFloat(ticker.priceChangePercent),
      priceLKR: parseFloat(ticker.lastPrice) * usdToLkr
    }));

  return {
    usdToLkr,
    totalCoins: results.length,
    prices: results
  };
}

// Internal worker for fetching live prices
async function fetchFreshLivePrices() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  const data = await fetchBinanceData('/ticker/24hr', {}, 4000);
  const usdToLkr = await getUSDToLKR();
  
  const tickerMap = {};
  if (Array.isArray(data)) {
    data.forEach(t => {
      if (symbols.includes(t.symbol)) {
        tickerMap[t.symbol] = t;
      }
    });
  }

  const liveData = symbols.map(symbol => {
    const ticker = tickerMap[symbol] || { lastPrice: "0", priceChangePercent: "0", volume: "0" };
    const coin = symbol.replace('USDT', '');
    const priceUSD = parseFloat(ticker.lastPrice) || 0;
    const priceLKR = priceUSD * usdToLkr;
    const change24h = parseFloat(ticker.priceChangePercent) || 0;
    const volume = parseFloat(ticker.volume) || 0;

    return {
      coin,
      symbol,
      priceUSD,
      priceLKR,
      change24h,
      volume
    };
  });

  global.marketCacheMemory = liveData;
  global.marketCacheMemoryTime = Date.now();
  return liveData;
}

async function getLivePrices() {
  const oracledb = require('oracledb');
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  
  // 1. Return in-memory cache if fresh (within 5 seconds)
  if (global.marketCacheMemory && (Date.now() - (global.marketCacheMemoryTime || 0)) < 5000) {
    return global.marketCacheMemory;
  }

  // 2. Coalesce in-flight requests
  if (inflightLivePricesPromise) {
    return inflightLivePricesPromise;
  }

  let liveData = null;

  // 3. Fetch live data with deduping
  try {
    inflightLivePricesPromise = fetchFreshLivePrices();
    liveData = await inflightLivePricesPromise;
  } catch (apiError) {
    console.warn('⚠️ Binance / Exchange API warning:', apiError.message);
  } finally {
    inflightLivePricesPromise = null;
  }

  // 4. If live fetch succeeded, persist to Oracle DB asynchronously/safely
  if (liveData && liveData.length > 0) {
    (async () => {
      let connection;
      try {
        connection = await oracledb.getConnection();
        for (const item of liveData) {
          await connection.execute(
            `MERGE INTO MARKET_CACHE m
             USING (SELECT :symbol AS symbol FROM dual) src
             ON (m.symbol = src.symbol)
             WHEN MATCHED THEN
               UPDATE SET m.price_usd = :priceUSD, m.price_lkr = :priceLKR, m.last_updated = CURRENT_TIMESTAMP
             WHEN NOT MATCHED THEN
               INSERT (SYMBOL, PRICE_USD, PRICE_LKR, LAST_UPDATED) VALUES (:symbol, :priceUSD, :priceLKR, CURRENT_TIMESTAMP)`,
            { symbol: item.symbol, priceUSD: item.priceUSD, priceLKR: item.priceLKR }
          );
        }
        await connection.commit();
      } catch (dbErr) {
        console.warn('⚠️ MARKET_CACHE DB persist warning:', dbErr.message);
      } finally {
        if (connection) {
          try { await connection.close(); } catch (e) {}
        }
      }
    })();

    return liveData;
  }

  // 4. Fallback: If external APIs failed, read from DB MARKET_CACHE
  let connection;
  try {
    connection = await oracledb.getConnection();
    const cacheResult = await connection.execute(
      `SELECT SYMBOL, PRICE_USD, PRICE_LKR FROM MARKET_CACHE`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (cacheResult.rows && cacheResult.rows.length > 0) {
      return cacheResult.rows.map(r => ({
        coin: r.SYMBOL.replace('USDT', ''),
        symbol: r.SYMBOL,
        priceUSD: parseFloat(r.PRICE_USD || 0),
        priceLKR: parseFloat(r.PRICE_LKR || 0),
        change24h: 0.0,
        volume: 0.0
      }));
    }
  } catch (dbErr) {
    console.error('DB Cache fallback failed:', dbErr.message);
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }

  // 5. Ultimate Fallback: Return in-memory or default rates
  if (global.marketCacheMemory) return global.marketCacheMemory;

  return symbols.map(symbol => ({
    coin: symbol.replace('USDT', ''),
    symbol,
    priceUSD: 100.0,
    priceLKR: 32820.0,
    change24h: 0.0,
    volume: 0.0
  }));
}

module.exports = {
  ALLOWED_SYMBOLS,
  normalizeSymbol,
  getPriceInLKR,
  getMultiplePricesInLKR,
  getAllPricesInLKR,
  getLivePrices,
  getUSDToLKR,
  getUSDToLKRDetails,
  getCryptoTicker
};
