const backtestService = require('../services/backtestService');

/**
 * Controller for AI Backtesting and Research Evaluation API
 */

exports.executeBacktest = async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', interval = '1h', limit = 500, horizons = [1, 4, 24], startTime, endTime } = req.body;

    // Enforce limits
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 500, 100), 1000);

    const results = await backtestService.runBacktest({
      symbol,
      interval,
      limit: safeLimit,
      horizons: Array.isArray(horizons) ? horizons : [1, 4, 24],
      startTime: startTime ? new Date(startTime).getTime() : null,
      endTime: endTime ? new Date(endTime).getTime() : null
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Backtest Controller Error:', error.message);
    res.status(500).json({
      success: false,
      code: 'BACKTEST_FAILED',
      message: error.message
    });
  }
};

exports.executeMultiSymbolBacktest = async (req, res) => {
  try {
    const symbols = req.body.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
    const results = await backtestService.runMultiSymbolBacktest(symbols);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Multi-Symbol Backtest Error:', error.message);
    res.status(500).json({
      success: false,
      code: 'MULTI_BACKTEST_FAILED',
      message: error.message
    });
  }
};
