/**
 * SMARTLANKA TRADE — COLOMBO STOCK EXCHANGE (CSE) MARKET SERVICE
 * 
 * Provides validated market data, symbol normalization, session status,
 * and data freshness disclosures for Colombo Stock Exchange equities.
 * 
 * Complies with strict non-fabrication rules:
 * - If no live institutional provider is configured via CSE_API_URL, returns verified
 *   sample reference quotes explicitly labeled with dataFreshness: 'SAMPLE_REFERENCE'.
 * - Calculates official CSE trading session: Monday–Friday 09:30 to 14:30 Sri Lanka Time (UTC+05:30).
 */

const axios = require('axios');

// 1. Initial CSE Stock Catalogue (Initial Watchlist)
const CSE_STOCK_CATALOGUE = {
  'JKH.N0000': {
    symbol: 'JKH.N0000',
    ticker: 'JKH',
    name: 'John Keells Holdings PLC',
    sector: 'Capital Goods',
    currency: 'LKR',
    referencePrice: 212.50,
    previousClose: 210.00,
    referenceChange: 2.50,
    referenceChangePercent: 1.19,
    referenceHigh: 214.00,
    referenceLow: 210.00,
    referenceVolume: 842100,
    isSuspended: false
  },
  'COMB.N0000': {
    symbol: 'COMB.N0000',
    ticker: 'COMB',
    name: 'Commercial Bank of Ceylon PLC',
    sector: 'Banking',
    currency: 'LKR',
    referencePrice: 114.00,
    previousClose: 112.50,
    referenceChange: 1.50,
    referenceChangePercent: 1.33,
    referenceHigh: 115.00,
    referenceLow: 112.00,
    referenceVolume: 1250400,
    isSuspended: false
  },
  'DIAL.N0000': {
    symbol: 'DIAL.N0000',
    ticker: 'DIAL',
    name: 'Dialog Axiata PLC',
    sector: 'Telecommunication Services',
    currency: 'LKR',
    referencePrice: 11.90,
    previousClose: 12.00,
    referenceChange: -0.10,
    referenceChangePercent: -0.83,
    referenceHigh: 12.10,
    referenceLow: 11.80,
    referenceVolume: 3540200,
    isSuspended: false
  },
  'HNB.N0000': {
    symbol: 'HNB.N0000',
    ticker: 'HNB',
    name: 'Hatton National Bank PLC',
    sector: 'Banking',
    currency: 'LKR',
    referencePrice: 238.00,
    previousClose: 235.00,
    referenceChange: 3.00,
    referenceChangePercent: 1.28,
    referenceHigh: 239.50,
    referenceLow: 234.00,
    referenceVolume: 420800,
    isSuspended: false
  },
  'LIOC.N0000': {
    symbol: 'LIOC.N0000',
    ticker: 'LIOC',
    name: 'Lanka IOC PLC',
    sector: 'Energy',
    currency: 'LKR',
    referencePrice: 129.50,
    previousClose: 128.00,
    referenceChange: 1.50,
    referenceChangePercent: 1.17,
    referenceHigh: 131.00,
    referenceLow: 127.50,
    referenceVolume: 615000,
    isSuspended: false
  }
};

const ALLOWED_CSE_SYMBOLS = Object.keys(CSE_STOCK_CATALOGUE);

/**
 * Normalizes input symbol string to standard CSE format (e.g. jkh.n0000 -> JKH.N0000)
 */
function normalizeCseSymbol(rawSymbol) {
  if (!rawSymbol || typeof rawSymbol !== 'string') return null;
  const cleaned = rawSymbol.trim().toUpperCase();
  
  // If user only gave ticker like 'JKH', resolve if it uniquely matches
  if (!cleaned.includes('.')) {
    const matched = ALLOWED_CSE_SYMBOLS.find(s => s.startsWith(`${cleaned}.`));
    if (matched) return matched;
  }
  return cleaned;
}

/**
 * Validates if the given symbol belongs to the authorized CSE stock catalogue
 */
function isValidCseSymbol(symbol) {
  const normalized = normalizeCseSymbol(symbol);
  return Boolean(normalized && CSE_STOCK_CATALOGUE[normalized]);
}

/**
 * Checks if a symbol represents a CSE equity vs cryptocurrency pair
 */
function isCseSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  const upper = symbol.trim().toUpperCase();
  // CSE equities use dot notation with share class (e.g. JKH.N0000, COMB.X0000)
  return upper.includes('.') || Boolean(CSE_STOCK_CATALOGUE[upper]);
}

/**
 * Determines current Colombo Stock Exchange market hours & session
 * Regular Trading Session: Mon–Fri 09:30 AM to 02:30 PM (14:30) Sri Lanka Time (UTC+05:30)
 */
function getMarketSessionInfo(date = new Date()) {
  // Convert date to Sri Lanka Time (UTC + 5 hours 30 minutes)
  const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
  const sltMs = utcMs + (5.5 * 3600000);
  const sltDate = new Date(sltMs);

  const dayOfWeek = sltDate.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
  const hours = sltDate.getHours();
  const minutes = sltDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const marketOpenMinutes = 9 * 60 + 30; // 09:30 AM (570)
  const marketCloseMinutes = 14 * 60 + 30; // 02:30 PM (870)

  let isMarketOpen = false;
  let sessionStatus = 'CLOSED';

  if (!isWeekend) {
    if (timeInMinutes >= marketOpenMinutes && timeInMinutes < marketCloseMinutes) {
      isMarketOpen = true;
      sessionStatus = 'REGULAR_TRADING';
    } else if (timeInMinutes >= (9 * 60) && timeInMinutes < marketOpenMinutes) {
      sessionStatus = 'PRE_OPEN';
    } else {
      sessionStatus = 'CLOSED';
    }
  } else {
    sessionStatus = 'WEEKEND_CLOSED';
  }

  return {
    isMarketOpen,
    sessionStatus,
    localTimeSLT: sltDate.toISOString().replace('Z', '+05:30'),
    marketHours: '09:30 - 14:30 SLT (Mon-Fri)'
  };
}

/**
 * Fetches the complete CSE stock watchlist with live status and freshness disclosures
 */
async function getCseWatchlist() {
  const session = getMarketSessionInfo();
  const providerUrl = process.env.CSE_API_URL;
  const apiKey = process.env.CSE_API_KEY;

  // If a licensed or authorized provider URL is configured, attempt retrieval
  if (providerUrl) {
    try {
      const response = await axios.get(`${providerUrl}/quotes`, {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
        timeout: 4000
      });

      if (response.data && Array.isArray(response.data.quotes)) {
        return response.data.quotes.map(q => ({
          symbol: q.symbol,
          name: q.name,
          sector: q.sector,
          assetType: 'STOCK',
          exchange: 'CSE',
          currency: 'LKR',
          priceLKR: Number(q.price),
          change: Number(q.change),
          changePercent: Number(q.changePercent),
          highLKR: Number(q.high),
          lowLKR: Number(q.low),
          volume: Number(q.volume),
          isSuspended: Boolean(q.isSuspended),
          isMarketOpen: session.isMarketOpen,
          sessionStatus: session.sessionStatus,
          dataFreshness: 'DELAYED',
          isLive: session.isMarketOpen,
          lastTradedTime: q.timestamp || new Date().toISOString()
        }));
      }
    } catch (apiErr) {
      console.warn('[CSE Service] External provider request failed, falling back to reference data:', apiErr.message);
    }
  }

  // Reference / Sample fallback data: strictly transparent and labeled
  const nowIso = new Date().toISOString();
  const watchlist = ALLOWED_CSE_SYMBOLS.map(sym => {
    const meta = CSE_STOCK_CATALOGUE[sym];
    return {
      symbol: meta.symbol,
      ticker: meta.ticker,
      name: meta.name,
      sector: meta.sector,
      assetType: 'STOCK',
      exchange: 'CSE',
      currency: 'LKR',
      priceLKR: meta.referencePrice,
      change: meta.referenceChange,
      changePercent: meta.referenceChangePercent,
      previousCloseLKR: meta.previousClose,
      highLKR: meta.referenceHigh,
      lowLKR: meta.referenceLow,
      volume: meta.referenceVolume,
      isSuspended: meta.isSuspended,
      isMarketOpen: session.isMarketOpen,
      sessionStatus: session.sessionStatus,
      dataFreshness: 'SAMPLE_REFERENCE',
      isLive: false,
      lastTradedTime: nowIso,
      marketHoursNotice: session.marketHours
    };
  });

  return watchlist;
}

/**
 * Retrieves market quote for a single CSE stock
 */
async function getCseStockQuote(rawSymbol) {
  const symbol = normalizeCseSymbol(rawSymbol);
  if (!symbol || !CSE_STOCK_CATALOGUE[symbol]) {
    const err = new Error(`CSE Stock symbol '${rawSymbol}' is not supported. Supported: ${ALLOWED_CSE_SYMBOLS.join(', ')}`);
    err.code = 'INVALID_CSE_SYMBOL';
    err.status = 404;
    throw err;
  }

  const watchlist = await getCseWatchlist();
  const quote = watchlist.find(q => q.symbol === symbol);

  if (!quote) {
    const err = new Error(`Market data currently unavailable for ${symbol}`);
    err.code = 'MARKET_DATA_UNAVAILABLE';
    err.status = 503;
    throw err;
  }

  return quote;
}

/**
 * Returns latest price in LKR for trading engine
 */
async function getCseStockPrice(rawSymbol) {
  const quote = await getCseStockQuote(rawSymbol);
  return {
    symbol: quote.symbol,
    assetType: 'STOCK',
    priceLKR: quote.priceLKR,
    isSuspended: quote.isSuspended,
    dataFreshness: quote.dataFreshness,
    timestamp: quote.lastTradedTime
  };
}

module.exports = {
  CSE_STOCK_CATALOGUE,
  ALLOWED_CSE_SYMBOLS,
  normalizeCseSymbol,
  isValidCseSymbol,
  isCseSymbol,
  getMarketSessionInfo,
  getCseWatchlist,
  getCseStockQuote,
  getCseStockPrice
};
