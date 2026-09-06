const marketService = require('../services/marketService');

exports.getAllQuotes = async (req, res) => {
  try {
    const quotes = await marketService.getAllStockQuotes();
    const forex = await marketService.getForexRates();
    res.json({
      success: true,
      totalStocks: quotes.length,
      exchange: 'Colombo Stock Exchange (CSE)',
      usdToLkr: forex['USD/LKR'].rate,
      prices: quotes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'MARKET_DATA_ERROR',
      message: err.message || 'Error fetching stock market data.'
    });
  }
};

exports.getQuoteBySymbol = async (req, res) => {
  try {
    const symbol = req.query.symbol || req.params.symbol || 'JKH.N0000';
    const quote = await marketService.getStockQuoteBySymbol(symbol);
    const forex = await marketService.getForexRates();
    res.json({
      success: true,
      symbol: quote.symbol,
      priceLKR: quote.priceLKR,
      priceUSD: quote.priceUSD,
      changePercent: quote.changePercent,
      usdToLkr: forex['USD/LKR'].rate,
      quote
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'MARKET_DATA_ERROR',
      message: err.message || 'Error fetching quote.'
    });
  }
};

exports.getMultipleQuotes = async (req, res) => {
  try {
    const symbolsParam = req.query.symbols;
    const includeSparkline = req.query.sparkline === 'true';
    const allQuotes = await marketService.getAllStockQuotes();
    const forex = await marketService.getForexRates();

    let targetQuotes = allQuotes;
    if (symbolsParam) {
      const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
      targetQuotes = allQuotes.filter(q => 
        requestedSymbols.includes(q.symbol) || 
        requestedSymbols.some(r => q.symbol.startsWith(r))
      );
    }

    if (includeSparkline) {
      targetQuotes = targetQuotes.map(q => {
        const history = marketService.getHistoricalCandles(q.symbol, '1D');
        return {
          ...q,
          sparkline: history.sparkline
        };
      });
    }

    res.json({
      success: true,
      usdToLkr: forex['USD/LKR'].rate,
      prices: targetQuotes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'MARKET_DATA_ERROR',
      message: err.message || 'Error fetching quotes.'
    });
  }
};

exports.getCandles = async (req, res) => {
  try {
    const symbol = req.params.symbol || req.query.symbol || 'JKH.N0000';
    const period = req.query.period || '1D';
    const data = marketService.getHistoricalCandles(symbol, period);
    res.json({
      success: true,
      data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'MARKET_DATA_ERROR',
      message: err.message || 'Error fetching candlestick data.'
    });
  }
};

exports.getForex = async (req, res) => {
  try {
    const rates = await marketService.getForexRates();
    res.json({
      success: true,
      baseCurrency: 'LKR',
      rates
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'FOREX_ERROR',
      message: err.message || 'Error fetching forex rates.'
    });
  }
};

exports.getLive = async (req, res) => {
  try {
    const quotes = await marketService.getAllStockQuotes();
    res.json({
      success: true,
      data: quotes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'MARKET_DATA_ERROR',
      message: err.message || 'Error fetching live market data.'
    });
  }
};
