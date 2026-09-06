const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/trade', require('./routes/tradeRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/admin/kyc', require('./routes/adminKycRoutes'));
app.get('/api/test-market', (req, res) => res.json({ message: "Market route test works" }));

// Health Check
app.get('/', (req, res) => res.send('SmartLanka Backend API Running...'));

const PORT = process.env.PORT || 5000;

// Start background services and server listener when not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  const { startPriceMonitor } = require('./services/priceMonitor');
  startPriceMonitor();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

module.exports = app;
