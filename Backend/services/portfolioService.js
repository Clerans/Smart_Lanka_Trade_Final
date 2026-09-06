const portfolioModel = require('../models/portfolioModel');
const walletModel = require('../models/walletModel');
const marketService = require('./marketService');

const getPortfolioSummary = async (userId) => {
  // 1. Get user holdings
  const holdings = await portfolioModel.getUserPortfolio(userId);
  
  // 2. Get wallet cash balance
  const wallet = await walletModel.findWalletByUserId(userId);
  const availableCash = wallet ? parseFloat(wallet.BALANCE_LKR) : 0.0;

  if (holdings.length === 0) {
    return {
      holdings: [],
      summary: {
        totalPortfolioValue: availableCash,
        todaysProfit: 0.0,
        profitLossPercent: 0.0,
        investedAmount: 0.0,
        availableCash: availableCash
      }
    };
  }

  // 3. Get live prices for value calculations
  let livePrices;
  try {
    liveData = await marketService.getLivePrices();
    // Map array to object for quick lookup
    livePrices = {};
    liveData.forEach(item => {
      livePrices[item.symbol] = item;
    });
  } catch (error) {
    console.error('Error fetching live prices for portfolio summary:', error.message);
    livePrices = {};
  }

  let totalHoldingsValue = 0.0;
  let totalInvestedAmount = 0.0;

  const formattedHoldings = holdings.map(holding => {
    const symbol = holding.SYMBOL;
    const qty = parseFloat(holding.QUANTITY);
    const avgPrice = parseFloat(holding.AVERAGE_PRICE);
    const invested = parseFloat(holding.INVESTED_AMOUNT);

    // Get current price from cache, fallback to avgPrice if API fails
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
  const totalPortfolioValue = totalHoldingsValue + availableCash;

  return {
    holdings: formattedHoldings,
    summary: {
      totalPortfolioValue: totalPortfolioValue,
      todaysProfit: todaysProfit,
      profitLossPercent: profitLossPercent,
      investedAmount: totalInvestedAmount,
      availableCash: availableCash
    }
  };
};

module.exports = {
  getPortfolioSummary
};
