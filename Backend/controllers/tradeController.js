const tradeService = require('../services/tradeService');

const buyOrder = async (req, res) => {
  try {
    const { symbol, amountLKR } = req.body;
    const userId = req.user.id;

    if (!symbol) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: 'Trading symbol is required.'
      });
    }

    if (amountLKR === undefined || amountLKR === null || parseFloat(amountLKR) <= 0) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_AMOUNT',
        message: 'Purchase amount must be greater than zero.'
      });
    }

    const result = await tradeService.executeBuyOrder(userId, symbol, amountLKR);
    res.json(result);
  } catch (err) {
    console.error('Buy Order Error:', err.message);
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
        code: 'INVALID_AMOUNT',
        message: 'Sell quantity must be greater than zero.'
      });
    }

    const result = await tradeService.executeSellOrder(userId, symbol, quantity);
    res.json(result);
  } catch (err) {
    console.error('Sell Order Error:', err.message);
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
