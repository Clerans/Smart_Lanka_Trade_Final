const axios = require("axios");

// 1. Get crypto ticker from Binance (Price + 24h Change)
async function getCryptoTicker(symbol = "BTCUSDT") {
  // Special case for USDT/USDT (used for LKR/USDT rate alerts)
  if (symbol === "USDTUSDT" || symbol === "USDT") {
    return {
      price: 1.0,
      changePercent: 0
    };
  }

  const response = await axios.get(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
  );

  return {
    price: parseFloat(response.data.lastPrice),
    changePercent: parseFloat(response.data.priceChangePercent)
  };
}

// 2. Get USD → LKR rate
async function getUSDToLKR() {
  const response = await axios.get(
    "https://api.exchangerate-api.com/v4/latest/USD"
  );

  return response.data.rates.LKR;
}

// 3. Final conversion
async function getPriceInLKR(symbol) {
  const ticker = await getCryptoTicker(symbol);
  const usdToLkr = await getUSDToLKR();

  return {
    symbol,
    priceUSDT: ticker.price,
    changePercent: ticker.changePercent,
    usdToLkr,
    priceLKR: ticker.price * usdToLkr,
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
          const klines = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
          sparkline = klines.data.map(k => parseFloat(k[4])); // Closing prices
        }
      }

      return {
        symbol,
        priceUSDT: ticker.price,
        changePercent: ticker.changePercent,
        priceLKR: ticker.price * usdToLkr,
        sparkline
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error.message);
      return null;
    }
  }));

  return {
    usdToLkr,
    prices: results.filter(r => r !== null)
  };
}

// 5. Get ALL USDT prices from Binance
async function getAllPricesInLKR() {
  const usdToLkr = await getUSDToLKR();
  
  // Call 24hr ticker without symbol to get ALL symbols
  const response = await axios.get("https://api.binance.com/api/v3/ticker/24hr");
  
  const results = response.data
    .filter(ticker => ticker.symbol.endsWith("USDT"))
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

async function getLivePrices() {
  const oracledb = require('oracledb');
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  
  // 1. Return in-memory cache if fresh (within 5 seconds)
  if (global.marketCacheMemory && (Date.now() - (global.marketCacheMemoryTime || 0)) < 5000) {
    return global.marketCacheMemory;
  }

  let liveData = null;

  // 2. Fetch live data from Binance & Exchange Rates
  try {
    const response = await axios.get("https://api.binance.com/api/v3/ticker/24hr", { timeout: 10000 });
    const usdToLkr = await getUSDToLKR().catch(() => 328.2); // Fallback USD/LKR rate if currency API is down
    
    const tickerMap = {};
    if (Array.isArray(response.data)) {
      response.data.forEach(t => {
        if (symbols.includes(t.symbol)) {
          tickerMap[t.symbol] = t;
        }
      });
    }

    liveData = symbols.map(symbol => {
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
  } catch (apiError) {
    console.warn('⚠️ Binance / Exchange API warning:', apiError.message);
  }

  // 3. If live fetch succeeded, persist to Oracle DB asynchronously/safely
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
               UPDATE SET m.price_usd = :priceUSD, m.price_lkr = :priceLKR, m.change_percent = :change24h, m.volume = :volume, m.last_updated = CURRENT_TIMESTAMP
             WHEN NOT MATCHED THEN
               INSERT (SYMBOL, PRICE_USD, PRICE_LKR, CHANGE_PERCENT, VOLUME) VALUES (:symbol, :priceUSD, :priceLKR, :change24h, :volume)`,
            { symbol: item.symbol, priceUSD: item.priceUSD, priceLKR: item.priceLKR, change24h: item.change24h, volume: item.volume }
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
      `SELECT SYMBOL, PRICE_USD, PRICE_LKR, CHANGE_PERCENT, VOLUME FROM MARKET_CACHE`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (cacheResult.rows && cacheResult.rows.length > 0) {
      return cacheResult.rows.map(r => ({
        coin: r.SYMBOL.replace('USDT', ''),
        symbol: r.SYMBOL,
        priceUSD: parseFloat(r.PRICE_USD || 0),
        priceLKR: parseFloat(r.PRICE_LKR || 0),
        change24h: parseFloat(r.CHANGE_PERCENT || 0),
        volume: parseFloat(r.VOLUME || 0)
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
  getPriceInLKR,
  getMultiplePricesInLKR,
  getAllPricesInLKR,
  getLivePrices
};
