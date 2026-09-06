const tradeService = require('../services/tradeService');

function getClientMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'SmartLanka-App'
  };
}

const buyOrder = async (req, res) => {
  try {
    const { symbol, amountLKR, quantity } = req.body;
    const userId = req.user.id;

    if (!symbol) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: 'Trading symbol is required.'
      });
    }

    if ((amountLKR === undefined || amountLKR === null || parseFloat(amountLKR) <= 0) &&
        (quantity === undefined || quantity === null || parseFloat(quantity) <= 0)) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_AMOUNT',
        message: 'Please provide a valid purchase amount in LKR or share quantity.'
      });
    }

    const result = await tradeService.executeBuyOrder(userId, symbol, amountLKR, quantity, getClientMeta(req));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An error occurred while executing buy order.'
    });
  }
};

const sellOrder = async (req, res) => {
  try {
    const { symbol, quantity } = req.body;
    const userId = req.user.id;

    if (!symbol) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: 'Trading symbol is required.'
      });
    }

    if (quantity === undefined || quantity === null || parseFloat(quantity) <= 0) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_QUANTITY',
        message: 'Sell quantity must be greater than zero.'
      });
    }

    const result = await tradeService.executeSellOrder(userId, symbol, quantity, getClientMeta(req));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An error occurred while executing sell order.'
    });
  }
};

module.exports = {
  buyOrder,
  sellOrder
};
