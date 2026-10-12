const portfolioModel = require('../models/portfolioModel');
const walletModel = require('../models/walletModel');
const marketService = require('./marketService');
const cseMarketService = require('./cseMarketService');

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
        cryptoHoldingsValue: 0.0,
        stockHoldingsValue: 0.0,
        todaysProfit: 0.0,
        profitLossPercent: 0.0,
        investedAmount: 0.0,
        availableCash: availableCash
      }
    };
  }

  // 3. Get live prices for value calculations
  let liveCryptoPrices = {};
  try {
    const liveCrypto = await marketService.getLivePrices();
    (liveCrypto || []).forEach(item => {
      liveCryptoPrices[item.symbol] = item;
    });
  } catch (error) {
    console.error('Error fetching crypto prices for portfolio summary:', error.message);
  }

  let cseStockPrices = {};
  try {
    const cseWatchlist = await cseMarketService.getCseWatchlist();
    (cseWatchlist || []).forEach(stock => {
      cseStockPrices[stock.symbol] = stock;
    });
  } catch (error) {
    console.error('Error fetching CSE stock prices for portfolio summary:', error.message);
  }

  let totalHoldingsValue = 0.0;
  let cryptoHoldingsValue = 0.0;
  let stockHoldingsValue = 0.0;
  let totalInvestedAmount = 0.0;

  const formattedHoldings = holdings.map(holding => {
    const symbol = holding.SYMBOL;
    const isStock = holding.ASSET_TYPE === 'STOCK' || cseMarketService.isCseSymbol(symbol);
    const qty = parseFloat(holding.QUANTITY);
    const avgPrice = parseFloat(holding.AVERAGE_PRICE);
    const invested = parseFloat(holding.INVESTED_AMOUNT);

    let currentPrice = avgPrice;
    let ticker = null;
    let coinName = symbol;
    let displayName = symbol;
    let dataFreshness = 'DELAYED';

    if (isStock) {
      ticker = cseStockPrices[symbol];
      if (ticker) {
        currentPrice = ticker.priceLKR;
        coinName = ticker.ticker || symbol.split('.')[0];
        displayName = ticker.name;
        dataFreshness = ticker.dataFreshness;
      } else {
        coinName = symbol.split('.')[0];
      }
    } else {
      ticker = liveCryptoPrices[symbol];
      if (ticker) {
        currentPrice = ticker.priceLKR;
        coinName = symbol.replace('USDT', '');
        displayName = symbol.replace('USDT', '');
        dataFreshness = ticker.isFallback ? 'DELAYED' : 'LIVE';
      } else {
        coinName = symbol.replace('USDT', '');
      }
    }

    const currentValue = qty * currentPrice;
    const profitLoss = currentValue - invested;
    const profitPercent = invested > 0 ? (profitLoss / invested) * 100 : 0.0;

    totalHoldingsValue += currentValue;
    totalInvestedAmount += invested;

    if (isStock) {
      stockHoldingsValue += currentValue;
    } else {
      cryptoHoldingsValue += currentValue;
    }

    return {
      coin: coinName,
      name: displayName,
      symbol: symbol,
      assetType: isStock ? 'STOCK' : 'CRYPTO',
      quantity: qty,
      averageBuyPrice: avgPrice,
      currentPrice: currentPrice,
      currentValue: currentValue,
      profitLoss: profitLoss,
      profitPercent: profitPercent,
      dataFreshness
    };
  });

  const todaysProfit = totalHoldingsValue - totalInvestedAmount;
  const profitLossPercent = totalInvestedAmount > 0 ? (todaysProfit / totalInvestedAmount) * 100 : 0.0;
  const totalPortfolioValue = totalHoldingsValue + availableCash;

  return {
    holdings: formattedHoldings,
    summary: {
      totalPortfolioValue: totalPortfolioValue,
      cryptoHoldingsValue: cryptoHoldingsValue,
      stockHoldingsValue: stockHoldingsValue,
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
