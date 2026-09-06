const aiService = require('../services/aiService');

exports.getInsights = async (req, res) => {
  try {
    const insights = await aiService.getStockAIInsights();
    res.json({
      success: true,
      totalInsights: insights.length,
      insights
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'AI_ERROR',
      message: err.message || 'Error generating AI insights.'
    });
  }
};

exports.getSentiment = async (req, res) => {
  try {
    const sentiment = aiService.getNewsSentiment();
    res.json({
      success: true,
      newsSentiment: sentiment
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'AI_ERROR',
      message: err.message || 'Error fetching sentiment.'
    });
  }
};

exports.getEvaluation = async (req, res) => {
  try {
    const evaluation = aiService.getModelEvaluation();
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'AI_ERROR',
      message: err.message || 'Error fetching evaluation report.'
    });
  }
};

exports.chatWithSomi = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_MESSAGE',
        message: 'Please provide a message for SOMI AI.'
      });
    }

    const response = await aiService.processChatMessage(message, req.user || {});
    res.json({
      success: true,
      ...response
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'AI_CHAT_ERROR',
      message: err.message || 'Error processing chat message.'
    });
  }
};
