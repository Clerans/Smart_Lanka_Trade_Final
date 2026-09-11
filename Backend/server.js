const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Configure trust proxy for reverse-proxy deployments (Render single hop)
// This MUST be set before express-rate-limit to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  }
});

const marketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many market requests from this IP, please try again later.'
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Incoming request logger
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/market', marketLimiter, require('./routes/marketRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/trade', require('./routes/tradeRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/ai/backtest', require('./routes/backtestRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/admin/kyc', require('./routes/adminKycRoutes'));
app.get('/api/test-market', (req, res) => res.json({ message: "Market route test works" }));

// Health & System Status Endpoint
app.get(['/', '/health', '/api/health'], async (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();
  let dbStatus = 'disconnected';
  let poolStats = null;

  try {
    const oracledb = require('oracledb');
    const pool = oracledb.getPool();
    if (pool) {
      dbStatus = 'connected';
      poolStats = {
        connectionsOpen: pool.connectionsOpen,
        connectionsInUse: pool.connectionsInUse,
        poolMin: pool.poolMin,
        poolMax: pool.poolMax
      };
    }
  } catch (e) {
    dbStatus = 'uninitialized';
  }

  res.json({
    status: 'UP',
    service: 'SmartLanka Trade Backend API',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    database: {
      engine: 'Oracle Database 21c / Express',
      status: dbStatus,
      pool: poolStats
    },
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100
    },
    version: '1.0.0-final'
  });
});

const PORT = process.env.PORT || 5000;

// Start background services and server listener when not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  const { verifyTransporter } = require('./services/emailService');
  verifyTransporter();
  const { startPriceMonitor } = require('./services/priceMonitor');
  startPriceMonitor();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} (0.0.0.0)`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      const { closePool } = require('./config/db');
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

module.exports = app;
