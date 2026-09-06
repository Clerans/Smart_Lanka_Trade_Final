const oracledb = require('oracledb');
const marketService = require('./marketService');
const walletModel = require('../models/walletModel');
const { logAuditEvent } = require('./auditService');

const createError = (code, message, status = 400) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

/**
 * Execute a Simulated Stock BUY Order on the Colombo Stock Exchange
 * Supports order by total LKR amount or share quantity.
 */
const executeBuyOrder = async (userId, symbol, amountLKR, shareQuantity = null, clientMeta = {}) => {
  const normalizedSymbol = symbol ? symbol.trim().toUpperCase() : '';
  const quote = await marketService.getStockQuoteBySymbol(normalizedSymbol);
  
  if (!quote) {
    throw createError('INVALID_SYMBOL', `The trading symbol ${symbol} is not a valid CSE stock.`, 422);
  }

  const priceLKR = quote.priceLKR;
  let totalLKR = 0;
  let quantity = 0;

  if (shareQuantity && !isNaN(shareQuantity) && parseFloat(shareQuantity) > 0) {
    quantity = parseFloat(shareQuantity);
    totalLKR = quantity * priceLKR;
  } else if (amountLKR && !isNaN(amountLKR) && parseFloat(amountLKR) > 0) {
    totalLKR = parseFloat(amountLKR);
    quantity = totalLKR / priceLKR;
  } else {
    throw createError('INVALID_AMOUNT', 'Purchase amount or share quantity must be greater than zero.', 422);
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Query wallet balance with row-level lock
    const walletRes = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId FOR UPDATE`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (walletRes.rows.length === 0) {
      throw createError('WALLET_NOT_FOUND', 'Virtual trading wallet not found for user.', 404);
    }

    const availableBalance = parseFloat(walletRes.rows[0].BALANCE_LKR);
    if (availableBalance < totalLKR) {
      throw createError(
        'INSUFFICIENT_BALANCE',
        `Insufficient simulated funds. Available: LKR ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Required: LKR ${totalLKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
        400
      );
    }

    // 2. Deduct wallet balance
    await connection.execute(
      `UPDATE WALLETS 
       SET BALANCE_LKR = BALANCE_LKR - :totalLKR, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE USER_ID = :userId`,
      { totalLKR, userId }
    );

    // 3. Query existing portfolio record with row-level lock
    const portfolioRes = await connection.execute(
      `SELECT QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :symbol FOR UPDATE`,
      { userId, symbol: quote.symbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let newQty = quantity;
    let newInvested = totalLKR;
    let newAveragePrice = priceLKR;

    if (portfolioRes.rows.length > 0) {
      const existingQty = parseFloat(portfolioRes.rows[0].QUANTITY);
      const existingInvested = parseFloat(portfolioRes.rows[0].INVESTED_AMOUNT);
      
      newQty = existingQty + quantity;
      newInvested = existingInvested + totalLKR;
      newAveragePrice = newInvested / newQty;
    }

    // 4. Upsert portfolio holdings
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
      { userId, symbol: quote.symbol, newQty, newAveragePrice, newInvested }
    );

    // 5. Insert transaction record
    await connection.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
       VALUES (:userId, :symbol, 'BUY', :quantity, :priceLKR, :totalLKR, 'COMPLETED')`,
      { userId, symbol: quote.symbol, quantity, priceLKR, totalLKR }
    );

    await connection.commit();

    // Audit event
    await logAuditEvent({
      userId,
      action: 'STOCK_BUY_EXECUTED',
      entity: 'TRADE',
      entityId: quote.symbol,
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `Bought ${quantity.toFixed(2)} shares of ${quote.symbol} @ LKR ${priceLKR.toFixed(2)} for LKR ${totalLKR.toFixed(2)}`
    });

    const updatedWallet = await walletModel.findWalletByUserId(userId);
    return {
      success: true,
      message: `Successfully executed demo BUY of ${quantity.toFixed(2)} shares in ${quote.companyName} (${quote.symbol})`,
      order: {
        symbol: quote.symbol,
        companyName: quote.companyName,
        action: 'BUY',
        shares: quantity,
        pricePerShare: priceLKR,
        totalAmountLKR: totalLKR
      },
      wallet: {
        balanceLKR: updatedWallet ? parseFloat(updatedWallet.BALANCE_LKR) : availableBalance - totalLKR,
        availableBalance: updatedWallet ? parseFloat(updatedWallet.BALANCE_LKR) : availableBalance - totalLKR
      }
    };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

/**
 * Execute a Simulated Stock SELL Order on the Colombo Stock Exchange
 */
const executeSellOrder = async (userId, symbol, quantity, clientMeta = {}) => {
  if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
    throw createError('INVALID_QUANTITY', 'Sell share quantity must be greater than zero.', 422);
  }

  const numQty = parseFloat(quantity);
  const normalizedSymbol = symbol ? symbol.trim().toUpperCase() : '';
  const quote = await marketService.getStockQuoteBySymbol(normalizedSymbol);

  if (!quote) {
    throw createError('INVALID_SYMBOL', `The trading symbol ${symbol} is not a valid CSE stock.`, 422);
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Query portfolio holding with row-level lock
    const portfolioRes = await connection.execute(
      `SELECT QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :symbol FOR UPDATE`,
      { userId, symbol: quote.symbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (portfolioRes.rows.length === 0 || parseFloat(portfolioRes.rows[0].QUANTITY) <= 0) {
      throw createError('ASSET_NOT_FOUND', `You do not hold any shares of ${quote.symbol} to sell.`, 404);
    }

    const existingQty = parseFloat(portfolioRes.rows[0].QUANTITY);
    const averagePrice = parseFloat(portfolioRes.rows[0].AVERAGE_PRICE);

    if (existingQty < numQty) {
      throw createError(
        'INSUFFICIENT_HOLDINGS',
        `Insufficient stock holdings. You currently own ${existingQty.toFixed(2)} shares of ${quote.symbol}.`,
        400
      );
    }

    const priceLKR = quote.priceLKR;
    const sellValue = numQty * priceLKR;
    const newQty = existingQty - numQty;
    const newInvested = newQty * averagePrice;

    // 2. Update holdings or delete if 0 shares remaining
    if (newQty <= 0.0001) {
      await connection.execute(
        `DELETE FROM PORTFOLIOS WHERE USER_ID = :userId AND SYMBOL = :symbol`,
        { userId, symbol: quote.symbol }
      );
    } else {
      await connection.execute(
        `UPDATE PORTFOLIOS 
         SET QUANTITY = :newQty, INVESTED_AMOUNT = :newInvested, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :userId AND SYMBOL = :symbol`,
        { newQty, newInvested, userId, symbol: quote.symbol }
      );
    }

    // 3. Credit wallet balance
    await connection.execute(
      `UPDATE WALLETS 
       SET BALANCE_LKR = BALANCE_LKR + :sellValue, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE USER_ID = :userId`,
      { sellValue, userId }
    );

    // 4. Insert transaction log
    await connection.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
       VALUES (:userId, :symbol, 'SELL', :numQty, :priceLKR, :sellValue, 'COMPLETED')`,
      { userId, symbol: quote.symbol, numQty, priceLKR, sellValue }
    );

    await connection.commit();

    // Audit event
    await logAuditEvent({
      userId,
      action: 'STOCK_SELL_EXECUTED',
      entity: 'TRADE',
      entityId: quote.symbol,
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `Sold ${numQty.toFixed(2)} shares of ${quote.symbol} @ LKR ${priceLKR.toFixed(2)} for LKR ${sellValue.toFixed(2)}`
    });

    const updatedWallet = await walletModel.findWalletByUserId(userId);
    return {
      success: true,
      message: `Successfully executed demo SELL of ${numQty.toFixed(2)} shares in ${quote.companyName} (${quote.symbol})`,
      order: {
        symbol: quote.symbol,
        companyName: quote.companyName,
        action: 'SELL',
        shares: numQty,
        pricePerShare: priceLKR,
        totalAmountLKR: sellValue
      },
      wallet: {
        balanceLKR: updatedWallet ? parseFloat(updatedWallet.BALANCE_LKR) : 0,
        availableBalance: updatedWallet ? parseFloat(updatedWallet.BALANCE_LKR) : 0
      }
    };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

module.exports = {
  executeBuyOrder,
  executeSellOrder
};
