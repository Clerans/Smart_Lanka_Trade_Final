const oracledb = require('oracledb');
const { getPriceInLKR } = require('./marketService');
const walletModel = require('../models/walletModel');
const portfolioModel = require('../models/portfolioModel');
const transactionModel = require('../models/transactionModel');

const createError = (code, message, status) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const executeBuyOrder = async (userId, symbol, amountLKR) => {
  // Input validations
  if (!amountLKR || isNaN(amountLKR) || parseFloat(amountLKR) <= 0) {
    throw createError('INVALID_AMOUNT', 'Purchase amount must be greater than zero.', 422);
  }
  
  const numAmount = parseFloat(amountLKR);
  const tradeableSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  if (!tradeableSymbols.includes(symbol)) {
    throw createError('INVALID_SYMBOL', `Trading symbol ${symbol} is not supported.`, 422);
  }

  // 1. Retrieve current LKR price
  let priceLKR;
  try {
    const marketData = await getPriceInLKR(symbol);
    priceLKR = marketData.priceLKR;
  } catch (error) {
    throw createError('SERVER_ERROR', 'Failed to retrieve live coin price from Binance.', 500);
  }

  const quantity = numAmount / priceLKR;

  let connection;
  try {
    connection = await oracledb.getConnection();

    // 2. Query wallet balance with lock
    const walletRes = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId FOR UPDATE`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (walletRes.rows.length === 0) {
      throw createError('SERVER_ERROR', 'Virtual wallet not found for user.', 500);
    }

    const availableBalance = parseFloat(walletRes.rows[0].BALANCE_LKR);
    if (availableBalance < numAmount) {
      throw createError('INSUFFICIENT_BALANCE', 'Your virtual wallet balance is insufficient.', 400);
    }

    // 3. Deduct available balance
    await connection.execute(
      `UPDATE WALLETS 
       SET BALANCE_LKR = BALANCE_LKR - :numAmount, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE USER_ID = :userId`,
      { numAmount, userId }
    );

    // 4. Query current portfolio record
    const portfolioRes = await connection.execute(
      `SELECT QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :symbol FOR UPDATE`,
      { userId, symbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let newQty = quantity;
    let newInvested = numAmount;
    let newAveragePrice = priceLKR;

    if (portfolioRes.rows.length > 0) {
      const existingQty = parseFloat(portfolioRes.rows[0].QUANTITY);
      const existingInvested = parseFloat(portfolioRes.rows[0].INVESTED_AMOUNT);
      
      newQty = existingQty + quantity;
      newInvested = existingInvested + numAmount;
      newAveragePrice = newInvested / newQty;
    }

    // 5. Update portfolio record
    await connection.execute(
      `MERGE INTO PORTFOLIOS p
       USING (SELECT :userId AS user_id, :symbol AS symbol FROM dual) src
       ON (p.user_id = src.user_id AND p.symbol = src.symbol)
       WHEN MATCHED THEN
         UPDATE SET p.quantity = :newQty,
                    p.average_price = :newAveragePrice,
                    p.invested_amount = :newInvested,
                    p.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (USER_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT)
         VALUES (:userId, :symbol, :newQty, :newAveragePrice, :newInvested)`,
      { userId, symbol, newQty, newAveragePrice, newInvested }
    );

    // 6. Log transaction
    await transactionModel.createTransaction(
      connection,
      userId,
      symbol,
      'BUY',
      quantity,
      priceLKR,
      numAmount
    );

    await connection.commit();

    // Fetch updated wallet details
    const updatedWallet = await walletModel.findWalletByUserId(userId);
    return {
      success: true,
      message: `Successfully purchased ${quantity.toFixed(6)} ${symbol.replace('USDT', '')}`,
      wallet: {
        balanceLKR: updatedWallet.BALANCE_LKR,
        availableBalance: updatedWallet.BALANCE_LKR
      }
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.close();
  }
};

const executeSellOrder = async (userId, symbol, quantity) => {
  // Input validation
  if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
    throw createError('INVALID_AMOUNT', 'Sell quantity must be greater than zero.', 422);
  }

  const numQty = parseFloat(quantity);
  const tradeableSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  if (!tradeableSymbols.includes(symbol)) {
    throw createError('INVALID_SYMBOL', `Trading symbol ${symbol} is not supported.`, 422);
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Query portfolio holding with lock
    const portfolioRes = await connection.execute(
      `SELECT QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :symbol FOR UPDATE`,
      { userId, symbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (portfolioRes.rows.length === 0 || parseFloat(portfolioRes.rows[0].QUANTITY) <= 0) {
      throw createError('ASSET_NOT_FOUND', `You do not hold any ${symbol.replace('USDT', '')} to sell.`, 404);
    }

    const existingQty = parseFloat(portfolioRes.rows[0].QUANTITY);
    const averagePrice = parseFloat(portfolioRes.rows[0].AVERAGE_PRICE);

    if (existingQty < numQty) {
      throw createError('INVALID_AMOUNT', `Insufficient assets. You only hold ${existingQty} ${symbol.replace('USDT', '')}.`, 400);
    }

    // 2. Retrieve live coin price
    let priceLKR;
    try {
      const marketData = await getPriceInLKR(symbol);
      priceLKR = marketData.priceLKR;
    } catch (error) {
      throw createError('SERVER_ERROR', 'Failed to retrieve live coin price from Binance.', 500);
    }

    const sellValue = numQty * priceLKR;
    const newQty = existingQty - numQty;
    const newInvested = newQty * averagePrice;

    // 3. Update holdings or delete if fully sold
    if (newQty <= 0.00000001) {
      await connection.execute(
        `DELETE FROM PORTFOLIOS WHERE USER_ID = :userId AND SYMBOL = :symbol`,
        { userId, symbol }
      );
    } else {
      await connection.execute(
        `UPDATE PORTFOLIOS 
         SET QUANTITY = :newQty, INVESTED_AMOUNT = :newInvested, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :userId AND SYMBOL = :symbol`,
        { newQty, newInvested, userId, symbol }
      );
    }

    // 4. Update wallet balance
    await connection.execute(
      `UPDATE WALLETS 
       SET BALANCE_LKR = BALANCE_LKR + :sellValue, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE USER_ID = :userId`,
      { sellValue, userId }
    );

    // 5. Create transaction log
    await transactionModel.createTransaction(
      connection,
      userId,
      symbol,
      'SELL',
      numQty,
      priceLKR,
      sellValue
    );

    await connection.commit();

    // Fetch updated wallet details
    const updatedWallet = await walletModel.findWalletByUserId(userId);
    return {
      success: true,
      message: `Successfully sold ${numQty} ${symbol.replace('USDT', '')}`,
      wallet: {
        balanceLKR: updatedWallet.BALANCE_LKR,
        availableBalance: updatedWallet.BALANCE_LKR
      }
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  executeBuyOrder,
  executeSellOrder
};
