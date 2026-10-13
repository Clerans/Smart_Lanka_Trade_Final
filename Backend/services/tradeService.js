const oracledb = require('oracledb');
const { getPriceInLKR } = require('./marketService');
const cseMarketService = require('./cseMarketService');
const walletModel = require('../models/walletModel');
const portfolioModel = require('../models/portfolioModel');
const transactionModel = require('../models/transactionModel');

const createError = (code, message, status) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const TRADEABLE_CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'USDT', 'USDTUSDT'];

/**
 * Resolves symbol, asset type ('CRYPTO' | 'STOCK'), and current execution price in LKR
 */
async function resolveAssetPrice(symbol) {
  if (symbol === 'USDT' || symbol === 'USDTUSDT') {
    const { getUSDToLKRDetails } = require('./marketService');
    const fx = await getUSDToLKRDetails();
    return {
      symbol: 'USDT',
      assetType: 'CRYPTO',
      priceLKR: fx.rate,
      displayName: 'USDT'
    };
  }

  if (cseMarketService.isCseSymbol(symbol)) {
    const normCse = cseMarketService.normalizeCseSymbol(symbol);
    if (!normCse || !cseMarketService.isValidCseSymbol(normCse)) {
      throw createError('INVALID_SYMBOL', `CSE equity '${symbol}' is not supported. Supported: ${cseMarketService.ALLOWED_CSE_SYMBOLS.join(', ')}`, 422);
    }
    const quote = await cseMarketService.getCseStockPrice(normCse);
    if (quote.isSuspended) {
      throw createError('SECURITY_SUSPENDED', `CSE security '${normCse}' is currently suspended from trading.`, 422);
    }
    return {
      symbol: normCse,
      assetType: 'STOCK',
      priceLKR: quote.priceLKR,
      displayName: normCse
    };
  }

  // Otherwise treat as Crypto
  if (!TRADEABLE_CRYPTO_SYMBOLS.includes(symbol)) {
    throw createError('INVALID_SYMBOL', `Cryptocurrency symbol '${symbol}' is not supported. Supported: ${TRADEABLE_CRYPTO_SYMBOLS.join(', ')}`, 422);
  }

  try {
    const marketData = await getPriceInLKR(symbol);
    return {
      symbol,
      assetType: 'CRYPTO',
      priceLKR: marketData.priceLKR,
      displayName: symbol.replace('USDT', '')
    };
  } catch (error) {
    throw createError('SERVER_ERROR', 'Failed to retrieve live cryptocurrency price.', 500);
  }
}

const executeBuyOrder = async (userId, symbol, amountLKR) => {
  // Input validations
  if (!amountLKR || isNaN(amountLKR) || parseFloat(amountLKR) <= 0) {
    throw createError('INVALID_AMOUNT', 'Purchase amount must be greater than zero.', 422);
  }
  
  const numAmount = parseFloat(amountLKR);
  const asset = await resolveAssetPrice(symbol);
  const { assetType, priceLKR, displayName } = asset;
  const canonicalSymbol = asset.symbol;

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
       WHERE USER_ID = :userId AND SYMBOL = :canonicalSymbol FOR UPDATE`,
      { userId, canonicalSymbol },
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

    // 5. Update portfolio record with ASSET_TYPE
    await connection.execute(
      `MERGE INTO PORTFOLIOS p
       USING (SELECT :userId AS user_id, :canonicalSymbol AS symbol FROM dual) src
       ON (p.user_id = src.user_id AND p.symbol = src.symbol)
       WHEN MATCHED THEN
         UPDATE SET p.quantity = :newQty,
                    p.average_price = :newAveragePrice,
                    p.invested_amount = :newInvested,
                    p.asset_type = :assetType,
                    p.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (USER_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT, ASSET_TYPE)
         VALUES (:userId, :canonicalSymbol, :newQty, :newAveragePrice, :newInvested, :assetType)`,
      { userId, canonicalSymbol, newQty, newAveragePrice, newInvested, assetType }
    );

    // 6. Log transaction
    const txId = await transactionModel.createTransaction(
      connection,
      userId,
      canonicalSymbol,
      'BUY',
      quantity,
      priceLKR,
      numAmount,
      'COMPLETED',
      assetType
    );

    await connection.commit();

    // Fetch updated wallet details
    const updatedWallet = await walletModel.findWalletByUserId(userId);
    const orderId = `ORD-BUY-${txId}`;

    return {
      success: true,
      message: `Successfully purchased ${quantity.toFixed(assetType === 'STOCK' ? 4 : 6)} ${displayName}`,
      order: {
        orderId,
        transactionId: txId,
        symbol: canonicalSymbol,
        assetType,
        side: 'BUY',
        orderType: 'MARKET',
        executionVenue: assetType === 'STOCK' ? 'INTERNAL_DEMO_CSE' : 'INTERNAL_PORTFOLIO',
        executedPriceLKR: priceLKR,
        executedQuantity: quantity,
        totalAmountLKR: numAmount,
        status: 'FILLED',
        timestamp: new Date().toISOString()
      },
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
  const asset = await resolveAssetPrice(symbol);
  const { assetType, priceLKR, displayName } = asset;
  const canonicalSymbol = asset.symbol;

  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Query portfolio holding with lock
    const portfolioRes = await connection.execute(
      `SELECT QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :canonicalSymbol FOR UPDATE`,
      { userId, canonicalSymbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (portfolioRes.rows.length === 0 || parseFloat(portfolioRes.rows[0].QUANTITY) <= 0) {
      throw createError('ASSET_NOT_FOUND', `You do not hold any ${displayName} to sell.`, 404);
    }

    const existingQty = parseFloat(portfolioRes.rows[0].QUANTITY);
    const averagePrice = parseFloat(portfolioRes.rows[0].AVERAGE_PRICE);

    if (existingQty < numQty) {
      throw createError('INVALID_AMOUNT', `Insufficient assets. You only hold ${existingQty} ${displayName}.`, 400);
    }

    const sellValue = numQty * priceLKR;
    const newQty = existingQty - numQty;
    const newInvested = newQty * averagePrice;

    // 3. Update holdings or delete if fully sold
    if (newQty <= 0.00000001) {
      await connection.execute(
        `DELETE FROM PORTFOLIOS WHERE USER_ID = :userId AND SYMBOL = :canonicalSymbol`,
        { userId, canonicalSymbol }
      );
    } else {
      await connection.execute(
        `UPDATE PORTFOLIOS 
         SET QUANTITY = :newQty, INVESTED_AMOUNT = :newInvested, ASSET_TYPE = :assetType, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :userId AND SYMBOL = :canonicalSymbol`,
        { newQty, newInvested, assetType, userId, canonicalSymbol }
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
    const txId = await transactionModel.createTransaction(
      connection,
      userId,
      canonicalSymbol,
      'SELL',
      numQty,
      priceLKR,
      sellValue,
      'COMPLETED',
      assetType
    );

    await connection.commit();

    // Fetch updated wallet details
    const updatedWallet = await walletModel.findWalletByUserId(userId);
    const orderId = `ORD-SELL-${txId}`;

    return {
      success: true,
      message: `Successfully sold ${numQty} ${displayName}`,
      order: {
        orderId,
        transactionId: txId,
        symbol: canonicalSymbol,
        assetType,
        side: 'SELL',
        orderType: 'MARKET',
        executionVenue: assetType === 'STOCK' ? 'INTERNAL_DEMO_CSE' : 'INTERNAL_PORTFOLIO',
        executedPriceLKR: priceLKR,
        executedQuantity: numQty,
        totalAmountLKR: sellValue,
        status: 'FILLED',
        timestamp: new Date().toISOString()
      },
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
  executeSellOrder,
  resolveAssetPrice,
  TRADEABLE_CRYPTO_SYMBOLS
};
