const portfolioModel = require('../models/portfolioModel');
const walletModel = require('../models/walletModel');
const marketService = require('./marketService');

/**
 * SMARTLANKA TRADE — PORTFOLIO CALCULATION ENGINE
 * Accurately computes separate metrics for:
 * 1. Cash Balance (Available LKR + USD)
 * 2. Invested Cost (Cumulative acquisition cost of active holdings)
 * 3. Current Market Value (Live valuation of all held shares)
 * 4. Unrealized P/L (Current Value - Invested Amount)
 * 5. Daily P/L (Valuation change compared to previous close)
 * 6. Total Portfolio Value (Cash + Market Value)
 * 7. Return %
 */
const getPortfolioSummary = async (userId) => {
  // 1. Get user stock holdings from DB
  const holdings = await portfolioModel.getUserPortfolio(userId);
  
  // 2. Get wallet cash balance
  const wallet = await walletModel.findWalletByUserId(userId);
  const availableCash = wallet ? parseFloat(wallet.BALANCE_LKR) : 0.0;
  const usdBalance = wallet ? parseFloat(wallet.USD_BALANCE || 0.0) : 0.0;

  // 3. Get live quotes for all CSE equities
  const quotes = await marketService.getAllStockQuotes();
  const quoteMap = {};
  quotes.forEach(q => {
    quoteMap[q.symbol] = q;
  });

  if (holdings.length === 0) {
    return {
      holdings: [],
      summary: {
        totalPortfolioValue: availableCash,
        availableCash: availableCash,
        usdBalance: usdBalance,
        investedAmount: 0.0,
        currentHoldingsValue: 0.0,
        unrealizedProfitLoss: 0.0,
        todaysProfit: 0.0,
        todaysProfitPercent: 0.0,
        totalReturnPercent: 0.0
      },
      allocation: [
        { name: 'LKR Cash', percent: 100, color: '#1A5BFF', value: availableCash }
      ]
    };
  }

  let totalHoldingsValue = 0.0;
  let totalInvestedAmount = 0.0;
  let totalDailyProfit = 0.0;

  const formattedHoldings = holdings.map(holding => {
    const symbol = holding.SYMBOL;
    const qty = parseFloat(holding.QUANTITY);
    const avgPrice = parseFloat(holding.AVERAGE_PRICE);
    const invested = parseFloat(holding.INVESTED_AMOUNT);

    const quote = quoteMap[symbol] || {
      priceLKR: avgPrice,
      changePercent: 0.0,
      prevClose: avgPrice,
      companyName: symbol,
      sector: 'General'
    };

    const currentPrice = quote.priceLKR;
    const currentValue = qty * currentPrice;
    const unrealizedPL = currentValue - invested;
    const unrealizedPLPercent = invested > 0 ? (unrealizedPL / invested) * 100 : 0.0;

    // Daily P/L = quantity * (currentPrice - prevClose)
    const prevClose = quote.prevClose || currentPrice;
    const dailyChangeLKR = qty * (currentPrice - prevClose);

    totalHoldingsValue += currentValue;
    totalInvestedAmount += invested;
    totalDailyProfit += dailyChangeLKR;

    return {
      symbol: symbol,
      companyName: quote.companyName || symbol,
      sector: quote.sector || 'Equities',
      quantity: qty,
      averageBuyPrice: avgPrice,
      currentPrice: currentPrice,
      currentValue: currentValue,
      investedAmount: invested,
      unrealizedProfitLoss: unrealizedPL,
      unrealizedProfitPercent: unrealizedPLPercent,
      dailyChangeLKR: dailyChangeLKR,
      change24hPercent: quote.changePercent
    };
  });

  const totalPortfolioValue = availableCash + totalHoldingsValue;
  const totalUnrealizedPL = totalHoldingsValue - totalInvestedAmount;
  const totalReturnPercent = totalInvestedAmount > 0 ? (totalUnrealizedPL / totalInvestedAmount) * 100 : 0.0;
  const prevPortfolioVal = totalPortfolioValue - totalDailyProfit;
  const todaysProfitPercent = prevPortfolioVal > 0 ? (totalDailyProfit / prevPortfolioVal) * 100 : 0.0;

  // Build allocation percentages
  const allocation = formattedHoldings.map((h, i) => {
    const pct = totalPortfolioValue > 0 ? (h.currentValue / totalPortfolioValue) * 100 : 0;
    const colorsList = ['#F7931A', '#627EEA', '#14F195', '#F3BA2F', '#0033AD', '#8247E5', '#E6007A', '#FF9900'];
    return {
      name: h.companyName || h.symbol,
      symbol: h.symbol,
      percent: parseFloat(pct.toFixed(1)),
      value: h.currentValue,
      color: colorsList[i % colorsList.length]
    };
  });

  const cashPct = totalPortfolioValue > 0 ? (availableCash / totalPortfolioValue) * 100 : 0;
  allocation.push({
    name: 'LKR Cash Balance',
    symbol: 'LKR',
    percent: parseFloat(cashPct.toFixed(1)),
    value: availableCash,
    color: '#1A5BFF'
  });

  return {
    holdings: formattedHoldings,
    summary: {
      totalPortfolioValue: totalPortfolioValue,
      availableCash: availableCash,
      usdBalance: usdBalance,
      investedAmount: totalInvestedAmount,
      currentHoldingsValue: totalHoldingsValue,
      unrealizedProfitLoss: totalUnrealizedPL,
      todaysProfit: totalDailyProfit,
      todaysProfitPercent: todaysProfitPercent,
      totalReturnPercent: totalReturnPercent,
      profitLossPercent: totalReturnPercent
    },
    allocation
  };
};

module.exports = {
  getPortfolioSummary
};
