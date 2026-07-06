const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.get('/api/test-market', (req, res) => res.json({ message: "Market route test works" }));

// Start Price Monitor
const { startPriceMonitor } = require('./services/priceMonitor');
startPriceMonitor();

// Health Check
app.get('/', (req, res) => res.send('SmartLanka Backend API Running...'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
