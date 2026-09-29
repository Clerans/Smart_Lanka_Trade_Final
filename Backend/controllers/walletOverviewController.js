const oracledb = require('oracledb');
const marketService = require('../services/marketService');

/**
 * Dedicated high-performance aggregated Wallet Overview endpoint
 * Uses a SINGLE Oracle connection and in-memory caches to deliver blazing fast response times.
 */
const getWalletOverview = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required.'
    });
  }

  const userId = req.user.id;
  let connection;

  try {
    connection = await oracledb.getConnection();

    // 1. Fetch User UID & KYC Status
    const userRes = await connection.execute(
      `SELECT ACCOUNT_UID, NAME, KYC_STATUS, IS_VERIFIED FROM SL_USERS WHERE ID = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 2. Fetch Wallet Available Cash
    const walletRes = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 3. Fetch Active Holdings
    const holdingsRes = await connection.execute(
      `SELECT PORTFOLIO_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND QUANTITY > 0
       ORDER BY INVESTED_AMOUNT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 4. Fetch Recent 5 Transactions
    const txRes = await connection.execute(
      `SELECT 
        TRANSACTION_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, 
        TOTAL_AMOUNT, STATUS, PAYMENT_METHOD, PROVIDER_REF, SENDER_USER_ID, 
        RECIPIENT_USER_ID, RECIPIENT_UID, DESCRIPTION, CREATED_AT 
       FROM TRANSACTIONS 
       WHERE (USER_ID = :userId OR RECIPIENT_USER_ID = :userId)
       ORDER BY CREATED_AT DESC
       FETCH NEXT 5 ROWS ONLY`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const userRow = userRes.rows[0] || null;
    const walletRow = walletRes.rows[0] || null;
    const holdingsRows = holdingsRes.rows || [];
    const txRows = txRes.rows || [];

    const availableBalance = walletRow ? parseFloat(walletRow.BALANCE_LKR) : 0.0;
    const accountUid = userRow ? userRow.ACCOUNT_UID : null;

    // 5. Get fast cached live prices & USD->LKR conversion rate (non-blocking)
    let livePrices = {};
    let usdToLkr = 331.27;
    try {
      const [liveData, rate] = await Promise.all([
        marketService.getLivePrices(),
        marketService.getUSDToLKR()
      ]);
      if (rate) usdToLkr = Number(rate);
      if (Array.isArray(liveData)) {
        liveData.forEach(item => {
          livePrices[item.symbol] = item;
        });
      }
    } catch (marketErr) {
      console.warn('⚠️ Non-blocking market rate fetch warning in wallet overview:', marketErr.message);
    }

    // 6. Compute holdings valuations and profit/loss
    let totalHoldingsValue = 0.0;
    let totalInvestedAmount = 0.0;

    const formattedHoldings = holdingsRows.map(holding => {
      const symbol = holding.SYMBOL;
      const qty = parseFloat(holding.QUANTITY);
      const avgPrice = parseFloat(holding.AVERAGE_PRICE);
      const invested = parseFloat(holding.INVESTED_AMOUNT);

      const ticker = livePrices[symbol];
      const currentPrice = ticker ? ticker.priceLKR : avgPrice;
      const currentValue = qty * currentPrice;
      const profitLoss = currentValue - invested;
      const profitPercent = invested > 0 ? (profitLoss / invested) * 100 : 0.0;

      totalHoldingsValue += currentValue;
      totalInvestedAmount += invested;

      return {
        coin: symbol.replace('USDT', ''),
        symbol: symbol,
        quantity: qty,
        averageBuyPrice: avgPrice,
        currentPrice: currentPrice,
        currentValue: currentValue,
        profitLoss: profitLoss,
        profitPercent: profitPercent
      };
    });

    const todaysProfit = totalHoldingsValue - totalInvestedAmount;
    const profitLossPercent = totalInvestedAmount > 0 ? (todaysProfit / totalInvestedAmount) * 100 : 0.0;
    const totalAssetValue = totalHoldingsValue + availableBalance;

    // 7. Format recent transactions
    const formattedTransactions = txRows.map(row => ({
      id: row.TRANSACTION_ID,
      type: row.TRANSACTION_TYPE,
      amount: parseFloat(row.TOTAL_AMOUNT),
      symbol: row.SYMBOL || 'LKR',
      quantity: parseFloat(row.QUANTITY || 1),
      price: parseFloat(row.PRICE || row.TOTAL_AMOUNT),
      status: row.STATUS,
      paymentMethod: row.PAYMENT_METHOD || 'INTERNAL',
      reference: row.PROVIDER_REF || null,
      recipientUid: row.RECIPIENT_UID || null,
      description: row.DESCRIPTION || '',
      isIncoming: ['DEPOSIT', 'TRANSFER_RECEIVED', 'SELL'].includes(row.TRANSACTION_TYPE),
      createdAt: row.CREATED_AT
    }));

    res.json({
      success: true,
      data: {
        accountUid,
        userName: userRow ? userRow.NAME : null,
        availableBalance,
        investedAmount: totalInvestedAmount,
        totalHoldingsValue,
        totalAssetValue,
        todaysProfit,
        profitLossPercent,
        usdToLkr,
        holdings: formattedHoldings,
        recentTransactions: formattedTransactions
      }
    });
  } catch (error) {
    console.error('❌ Wallet Overview Error:', error.message);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Server error retrieving consolidated wallet overview.'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.warn('⚠️ Connection close warning:', closeErr.message);
      }
    }
  }
};

module.exports = {
  getWalletOverview
};
