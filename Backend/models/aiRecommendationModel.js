const oracledb = require('oracledb');

/**
 * Saves an AI recommendation record to Oracle DB
 * @param {object} recData 
 * @param {number|null} userId 
 */
async function saveRecommendation(recData, userId = null) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      INSERT INTO AI_RECOMMENDATIONS (
        USER_ID,
        SYMBOL,
        TIMEFRAME,
        PRICE_USD,
        PRICE_LKR,
        RECOMMENDATION,
        CONFIDENCE,
        RISK_LEVEL,
        TREND,
        RSI,
        SMA20,
        SMA50,
        EMA20,
        MACD,
        MACD_SIGNAL,
        MACD_HISTOGRAM,
        VOLATILITY,
        REASONS
      ) VALUES (
        :userId,
        :symbol,
        :timeframe,
        :priceUSD,
        :priceLKR,
        :recommendation,
        :confidence,
        :riskLevel,
        :trend,
        :rsi,
        :sma20,
        :sma50,
        :ema20,
        :macd,
        :macdSignal,
        :macdHistogram,
        :volatility,
        :reasons
      )
    `;

    const binds = {
      userId: userId || null,
      symbol: recData.symbol,
      timeframe: recData.interval || '1h',
      priceUSD: recData.priceUSD || 0,
      priceLKR: recData.priceLKR || 0,
      recommendation: recData.recommendation,
      confidence: recData.confidence,
      riskLevel: recData.risk,
      trend: recData.trend,
      rsi: recData.indicators?.rsi || null,
      sma20: recData.indicators?.sma20 || null,
      sma50: recData.indicators?.sma50 || null,
      ema20: recData.indicators?.ema20 || null,
      macd: recData.indicators?.macd || null,
      macdSignal: recData.indicators?.macdSignal || null,
      macdHistogram: recData.indicators?.macdHistogram || null,
      volatility: recData.indicators?.volatility || null,
      reasons: JSON.stringify(recData.reasons || []).substring(0, 3999)
    };

    await connection.execute(sql, binds);
    await connection.commit();
  } catch (error) {
    console.error('⚠️ Failed to persist AI recommendation to Oracle DB:', error.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {}
    }
  }
}

/**
 * Retrieves the latest historical recommendations for a symbol
 * @param {string} symbol 
 * @param {number} limit 
 */
async function getRecentRecommendations(symbol, limit = 10) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      SELECT 
        ID, USER_ID, SYMBOL, TIMEFRAME, PRICE_USD, PRICE_LKR,
        RECOMMENDATION, CONFIDENCE, RISK_LEVEL, TREND,
        RSI, SMA20, SMA50, EMA20, MACD, MACD_SIGNAL, MACD_HISTOGRAM,
        VOLATILITY, REASONS, CREATED_AT
      FROM AI_RECOMMENDATIONS
      WHERE SYMBOL = :symbol
      ORDER BY CREATED_AT DESC
      FETCH FIRST :limit ROWS ONLY
    `;

    const result = await connection.execute(
      sql,
      { symbol: symbol.toUpperCase(), limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.map(row => ({
      id: row.ID,
      userId: row.USER_ID,
      symbol: row.SYMBOL,
      interval: row.TIMEFRAME,
      priceUSD: parseFloat(row.PRICE_USD),
      priceLKR: parseFloat(row.PRICE_LKR),
      recommendation: row.RECOMMENDATION,
      confidence: parseFloat(row.CONFIDENCE),
      risk: row.RISK_LEVEL,
      trend: row.TREND,
      indicators: {
        rsi: row.RSI !== null ? parseFloat(row.RSI) : null,
        sma20: row.SMA20 !== null ? parseFloat(row.SMA20) : null,
        sma50: row.SMA50 !== null ? parseFloat(row.SMA50) : null,
        ema20: row.EMA20 !== null ? parseFloat(row.EMA20) : null,
        macd: row.MACD !== null ? parseFloat(row.MACD) : null,
        macdSignal: row.MACD_SIGNAL !== null ? parseFloat(row.MACD_SIGNAL) : null,
        macdHistogram: row.MACD_HISTOGRAM !== null ? parseFloat(row.MACD_HISTOGRAM) : null,
        volatility: row.VOLATILITY !== null ? parseFloat(row.VOLATILITY) : null,
      },
      reasons: row.REASONS ? JSON.parse(row.REASONS) : [],
      createdAt: row.CREATED_AT
    }));
  } catch (error) {
    console.error('Error fetching recent recommendations from DB:', error.message);
    return [];
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {}
    }
  }
}

module.exports = {
  saveRecommendation,
  getRecentRecommendations
};
