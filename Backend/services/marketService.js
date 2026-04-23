const axios = require("axios");

// 1. Get crypto ticker from Binance (Price + 24h Change)
async function getCryptoTicker(symbol = "BTCUSDT") {
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
        // Fetch last 24 1-hour candles
        const klines = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
        sparkline = klines.data.map(k => parseFloat(k[4])); // Closing prices
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

module.exports = {
  getPriceInLKR,
  getMultiplePricesInLKR,
  getAllPricesInLKR
};
