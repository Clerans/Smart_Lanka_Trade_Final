const aiRecommendationService = require('../services/aiRecommendationService');
const aiRecommendationModel = require('../models/aiRecommendationModel');
const marketDataService = require('../services/marketDataService');

/**
 * GET /api/ai/recommendation/:symbol
 * Get recommendation for a single cryptocurrency
 */
exports.getSingleRecommendation = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: 'Symbol parameter is required (e.g. BTCUSDT)'
      });
    }

    const recommendation = await aiRecommendationService.getRecommendation(symbol, interval || '1h');

    // Save to Oracle DB for audit/research logging
    const userId = req.user ? req.user.id : null;
    await aiRecommendationModel.saveRecommendation(recommendation, userId);

    return res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    console.error('Error generating AI recommendation:', error.message);
    return res.status(500).json({
      success: false,
      code: 'AI_CALCULATION_ERROR',
      message: error.message || 'Failed to generate AI recommendation'
    });
  }
};

/**
 * GET /api/ai/recommendations
 * Get recommendations for all supported cryptocurrencies
 */
exports.getAllRecommendations = async (req, res) => {
  try {
    const { interval } = req.query;
    const recommendations = await aiRecommendationService.getAllRecommendations(interval || '1h');

    return res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    console.error('Error generating all AI recommendations:', error.message);
    return res.status(500).json({
      success: false,
      code: 'AI_CALCULATION_ERROR',
      message: error.message || 'Failed to generate market recommendations'
    });
  }
};

/**
 * GET /api/ai/history/:symbol
 * Get historical recommendations from Oracle DB
 */
exports.getRecommendationHistory = async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit || '10', 10);
    const history = await aiRecommendationModel.getRecentRecommendations(symbol, limit);

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching recommendation history:', error.message);
    return res.status(500).json({
      success: false,
      code: 'HISTORY_FETCH_ERROR',
      message: error.message || 'Failed to retrieve recommendation history'
    });
  }
};

/**
 * POST /api/ai/chat
 * SOMI AI Conversational Assistant grounded in live market data
 */
exports.chatWithSOMI = async (req, res) => {
  try {
    const { message, symbolContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const lower = message.toLowerCase();
    
    // Detect mentioned cryptocurrency
    const symbolMap = {
      'btc': 'BTCUSDT',
      'bitcoin': 'BTCUSDT',
      'eth': 'ETHUSDT',
      'ethereum': 'ETHUSDT',
      'bnb': 'BNBUSDT',
      'binance': 'BNBUSDT',
      'sol': 'SOLUSDT',
      'solana': 'SOLUSDT',
      'xrp': 'XRPUSDT',
      'ripple': 'XRPUSDT',
      'ada': 'ADAUSDT',
      'cardano': 'ADAUSDT',
      'doge': 'DOGEUSDT',
      'dogecoin': 'DOGEUSDT'
    };

    let targetSymbol = null;
    for (const [key, sym] of Object.entries(symbolMap)) {
      if (lower.includes(key)) {
        targetSymbol = sym;
        break;
      }
    }

    if (!targetSymbol && symbolContext) {
      targetSymbol = marketDataService.validateSymbol(symbolContext);
    }

    // If query is about market/coin prediction or specific asset
    if (targetSymbol) {
      const rec = await aiRecommendationService.getRecommendation(targetSymbol, '1h');
      const coinName = rec.coin;
      const formattedLKR = (rec.priceLKR).toLocaleString();
      const reasonsList = rec.reasons.slice(0, 3).map(r => `• ${r}`).join('\n');

      let responseText = `Here is the latest AI analysis for **${coinName}** (${rec.symbol}):\n\n`;
      responseText += `📊 **Current Price**: LKR ${formattedLKR} ($${rec.priceUSD.toLocaleString()})\n`;
      responseText += `🎯 **AI Recommendation**: **${rec.recommendation}** (${rec.confidence}% Model Confidence)\n`;
      responseText += `📈 **Market Trend**: ${rec.trend} | **Risk Level**: ${rec.risk}\n\n`;
      responseText += `**Key Technical Signals**:\n${reasonsList}\n\n`;
      responseText += `*💡 Note: This is an AI-generated model analysis for research/demo purposes and does not constitute financial advice.*`;

      return res.status(200).json({
        success: true,
        data: {
          reply: responseText,
          recommendation: rec,
          disclaimer: 'AI-generated analysis for research and educational purposes only.'
        }
      });
    }

    // General portfolio or general trading queries
    if (lower.includes('portfolio') || lower.includes('balance') || lower.includes('performance')) {
      const btcRec = await aiRecommendationService.getRecommendation('BTCUSDT');
      const ethRec = await aiRecommendationService.getRecommendation('ETHUSDT');

      let reply = `Your demo trading portfolio is linked to real-time market feeds! Currently:\n\n`;
      reply += `• **Bitcoin (BTC)** is in a ${btcRec.trend} trend (${btcRec.recommendation}, ${btcRec.confidence}% confidence).\n`;
      reply += `• **Ethereum (ETH)** is in a ${ethRec.trend} trend (${ethRec.recommendation}, ${ethRec.confidence}% confidence).\n\n`;
      reply += `You can navigate to the **Trade** tab to test buy/sell demo strategies in LKR without risking capital!`;

      return res.status(200).json({
        success: true,
        data: {
          reply,
          disclaimer: 'AI-generated guidance for demo trading.'
        }
      });
    }

    // Generic helpful assistance
    let reply = `Hello! I'm SOMI, your SmartLanka Trade AI assistant. You can ask me:\n\n`;
    reply += `• *"What do you think about Bitcoin?"*\n`;
    reply += `• *"Is now a good time to buy Ethereum?"*\n`;
    reply += `• *"Give me an analysis on Solana or XRP."*\n`;
    reply += `• *"Explain the current market trend."*\n\n`;
    reply += `How can I assist your trading strategy today?`;

    return res.status(200).json({
      success: true,
      data: {
        reply,
        disclaimer: 'Educational trading assistance.'
      }
    });
  } catch (error) {
    console.error('SOMI AI chat error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process AI chat query: ' + error.message
    });
  }
};
