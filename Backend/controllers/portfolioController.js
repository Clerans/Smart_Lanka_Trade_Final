const portfolioService = require('../services/portfolioService');

const getPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    const portfolio = await portfolioService.getPortfolioSummary(userId);
    res.json({
      success: true,
      data: portfolio
    });
  } catch (err) {
    console.error('Fetch Portfolio Error:', err.message);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message || 'An error occurred while fetching portfolio.'
    });
  }
};

module.exports = {
  getPortfolio
};
