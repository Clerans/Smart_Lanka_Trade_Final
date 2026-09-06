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
  let connection;
  try {
    connection = await oracledb.getConnection();
    
    // Check if cache is fresh in DB (within 10 seconds)
    const cacheResult = await connection.execute(
      `SELECT SYMBOL, PRICE_USD, PRICE_LKR, LAST_UPDATED 
       FROM MARKET_CACHE`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    let isCacheValid = false;
    if (cacheResult.rows.length === symbols.length) {
      const now = new Date();
      const oldestUpdate = Math.min(...cacheResult.rows.map(r => new Date(r.LAST_UPDATED)));
      if ((now - oldestUpdate) < 10000) {
        isCacheValid = true;
      }
    }

    if (isCacheValid) {
      if (global.marketCacheMemory && (Date.now() - global.marketCacheMemoryTime) < 10000) {
        return global.marketCacheMemory;
      }
    }

    // Fetch from Binance and Exchange Rate APIs
    const response = await axios.get("https://api.binance.com/api/v3/ticker/24hr");
    const usdToLkr = await getUSDToLKR();
    
    const tickerMap = {};
    response.data.forEach(t => {
      if (symbols.includes(t.symbol)) {
        tickerMap[t.symbol] = t;
      }
    });

    const liveData = symbols.map(symbol => {
      const ticker = tickerMap[symbol];
      const coin = symbol.replace('USDT', '');
      const priceUSD = parseFloat(ticker.lastPrice);
      const priceLKR = priceUSD * usdToLkr;
      const change24h = parseFloat(ticker.priceChangePercent);
      const volume = parseFloat(ticker.volume);

      return {
        coin,
        symbol,
        priceUSD,
        priceLKR,
        change24h,
        volume
      };
    });

    // Write to MARKET_CACHE
    for (const item of liveData) {
      await connection.execute(
        `MERGE INTO MARKET_CACHE m
         USING (SELECT :symbol AS symbol FROM dual) src
         ON (m.symbol = src.symbol)
         WHEN MATCHED THEN
           UPDATE SET m.price_usd = :priceUSD, m.price_lkr = :priceLKR, m.last_updated = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (SYMBOL, PRICE_USD, PRICE_LKR) VALUES (:symbol, :priceUSD, :priceLKR)`,
        { symbol: item.symbol, priceUSD: item.priceUSD, priceLKR: item.priceLKR }
      );
    }
    await connection.commit();

    global.marketCacheMemory = liveData;
    global.marketCacheMemoryTime = Date.now();

    return liveData;
  } catch (error) {
    console.error('Error fetching live market prices:', error.message);
    if (connection) {
      try {
        const cacheResult = await connection.execute(
          `SELECT SYMBOL, PRICE_USD, PRICE_LKR FROM MARKET_CACHE`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (cacheResult.rows.length > 0) {
          return cacheResult.rows.map(r => ({
            coin: r.SYMBOL.replace('USDT', ''),
            symbol: r.SYMBOL,
            priceUSD: parseFloat(r.PRICE_USD),
            priceLKR: parseFloat(r.PRICE_LKR),
            change24h: 0.0,
            volume: 0.0
          }));
        }
      } catch (dbErr) {
        console.error('DB Cache fallback failed:', dbErr.message);
      }
    }
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getPriceInLKR,
  getMultiplePricesInLKR,
  getAllPricesInLKR,
  getLivePrices
};
