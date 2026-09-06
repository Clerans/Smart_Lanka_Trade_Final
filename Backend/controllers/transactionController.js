const transactionModel = require('../models/transactionModel');

const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await transactionModel.getTransactionsByUserId(userId);
    
    const formatted = transactions.map(tx => ({
      id: tx.TRANSACTION_ID,
      symbol: tx.SYMBOL || 'LKR',
      asset: tx.SYMBOL || 'LKR',
      action: tx.TRANSACTION_TYPE,
      type: tx.TRANSACTION_TYPE,
      quantity: parseFloat(tx.QUANTITY || 0.0),
      price: parseFloat(tx.PRICE || 0.0),
      total: parseFloat(tx.TOTAL_AMOUNT || 0.0),
      amount: parseFloat(tx.TOTAL_AMOUNT || 0.0),
      date: tx.CREATED_AT,
      status: tx.STATUS
    }));

    res.json({
      success: true,
      total: formatted.length,
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
