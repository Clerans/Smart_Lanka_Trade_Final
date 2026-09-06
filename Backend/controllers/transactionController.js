const transactionModel = require('../models/transactionModel');

const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await transactionModel.getTransactionsByUserId(userId);
    
    const formatted = transactions.map(tx => ({
      id: tx.TRANSACTION_ID,
      coin: tx.SYMBOL ? tx.SYMBOL.replace('USDT', '') : 'LKR',
      action: tx.TRANSACTION_TYPE,
      quantity: parseFloat(tx.QUANTITY),
      price: parseFloat(tx.PRICE),
      total: parseFloat(tx.TOTAL_AMOUNT),
      date: tx.CREATED_AT,
      status: tx.STATUS
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error('Fetch Transactions Error:', err.message);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message || 'An error occurred while fetching transactions.'
    });
  }
};

module.exports = {
  getTransactions
};
