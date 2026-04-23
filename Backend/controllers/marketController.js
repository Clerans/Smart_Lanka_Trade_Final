const { getPriceInLKR, getMultiplePricesInLKR, getAllPricesInLKR } = require("../services/marketService");

exports.getPrice = async (req, res) => {
  try {
    const symbol = req.query.symbol || "BTCUSDT";

    const data = await getPriceInLKR(symbol);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch market data",
    });
  }
};

exports.getMultiplePrices = async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"];
    const includeSparkline = req.query.sparkline === 'true';

    const data = await getMultiplePricesInLKR(symbols, includeSparkline);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch multiple market data",
    });
  }
};

exports.getAllPrices = async (req, res) => {
  try {
    const data = await getAllPricesInLKR();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all market data",
    });
  }
};
