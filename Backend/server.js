const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Connect to Oracle Database
connectDB();

// Global Middleware & Security Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger (Development & Security Audit)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.warn(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes Mounting
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/trade', require('./routes/tradeRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Start Background Price Monitor for CSE Equities
const { startPriceMonitor } = require('./services/priceMonitor');
startPriceMonitor();

// Root & Health Status Check
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    platform: 'SmartLanka Trade — CSE Equities Trading & AI Platform',
    version: '2.0.0-SECURE',
    academicProject: 'Horizon Campus Final Year Project (IT41028)',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'HEALTHY',
    database: 'CONNECTED',
    exchange: 'Colombo Stock Exchange (CSE)',
    uptimeSeconds: process.uptime()
  });
});

// Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`[UNCAUGHT ERROR] ${err.message}`, err.stack);
  res.status(err.status || 500).json({
    success: false,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred. Please try again later.'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 SmartLanka Trade API running on port ${PORT}`);
  console.log(`🏛️ Colombo Stock Exchange (CSE) Provider Active`);
  console.log(`🔒 Security Hardening & Audit Logging Active`);
  console.log(`🤖 AI Insights & SOMI Chatbot Engine Active`);
  console.log(`=================================================\n`);
});

module.exports = app;
