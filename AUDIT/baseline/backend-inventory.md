# Backend Inventory & Structural Baseline

**Project Name:** SmartLanka Trade Backend  
**Environment:** Node.js (CommonJS), Express.js, Oracle Database  
**Root Directory:** `Backend/`  

---

## 1. Directory Structure & File Inventory

```text
Backend/
├── config/
│   └── db.js                        # Oracle DB connection pool configuration
├── controllers/
│   ├── adminController.js           # Admin management, metrics & KYC review
│   ├── aiController.js              # Time-series forecasting, NLP sentiment & SOMI assistant
│   ├── authController.js            # User registration, secure login & OTP verification
│   ├── kycController.js             # Sri Lankan NIC verification & document submission
│   ├── marketController.js         # CSE stock prices, candle history & forex rates
│   ├── portfolioController.js       # Portfolio holdings, daily P/L & net worth
│   ├── tradeController.js           # Atomic buy/sell execution & share validation
│   ├── transactionController.js     # Transaction ledger & history
│   └── walletController.js          # Available balance, deposits, withdrawals & forex conversion
├── middleware/
│   └── authMiddleware.js            # JWT protection & RBAC role guards (protect, adminProtect)
├── models/
│   ├── alertModel.js                # Stock price alerts model
│   ├── userModel.js                 # User entity & role model
│   └── verificationModel.js         # Bcrypt-hashed OTP & password reset model
├── routes/
│   ├── adminRoutes.js               # /api/admin endpoints
│   ├── aiRoutes.js                  # /api/ai endpoints
│   ├── alertRoutes.js               # /api/alerts endpoints
│   ├── authRoutes.js                # /api/auth endpoints
│   ├── kycRoutes.js                 # /api/kyc endpoints
│   ├── marketRoutes.js              # /api/market endpoints
│   ├── portfolioRoutes.js           # /api/portfolio endpoints
│   ├── tradeRoutes.js               # /api/trade endpoints
│   ├── transactionRoutes.js         # /api/transactions endpoints
│   └── walletRoutes.js              # /api/wallet endpoints
├── services/
│   ├── aiService.js                 # ARIMA/LSTM/RF models, NLP sentiment & SOMI NLP assistant
│   ├── auditService.js              # SL_AUDIT_LOGS persistent security audit logger
│   ├── authService.js               # Secure registration, hashing & authentication logic
│   ├── emailService.js              # Verification email & OTP dispatcher
│   ├── kycService.js                # Sri Lankan NIC (9-digit+V / 12-digit) parser & OCR engine
│   ├── marketService.js             # Colombo Stock Exchange (CSE) data provider & CBSL forex engine
│   ├── portfolioService.js          # Exact financial math & P/L calculation engine
│   ├── priceMonitor.js              # Real-time price monitor & alert trigger worker
│   └── tradeService.js              # Atomic transaction & order execution engine
├── tests/
│   └── integration_test_suite.js    # Master 25-point integration & security test runner
├── .env.example                     # Environment template
├── package.json                     # Backend manifest
├── schema.sql                       # Canonical Oracle DDL schema
└── server.js                        # Express server entry point & route registration
```

---

## 2. API Route Surface Inventory

| Route Prefix | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth` | POST | `/register` | Register new investor with zero OTP leakage | No |
| `/api/auth` | POST | `/login` | Authenticate user & issue JWT with RBAC role | No |
| `/api/auth` | POST | `/google` | Verified Google OAuth token login | No |
| `/api/auth` | POST | `/verify-otp` | Verify 6-digit hashed OTP with attempt throttling | No |
| `/api/auth` | POST | `/resend-otp` | Resend verification OTP with rate limiting | No |
| `/api/auth` | POST | `/forgot-password` | Generate secure password reset token | No |
| `/api/auth` | POST | `/reset-password` | Reset password using verified token | No |
| `/api/auth` | GET | `/me` | Fetch authenticated user profile & KYC status | Yes |
| `/api/market` | GET | `/prices` | Get all live CSE stock quotes | No |
| `/api/market` | GET | `/quote/:symbol`| Get detailed quote for CSE equity | No |
| `/api/market` | GET | `/forex` | Get CBSL USD/LKR exchange rates | No |
| `/api/market` | GET | `/status` | Check Colombo Stock Exchange trading hours | No |
| `/api/trade` | POST | `/buy` | Execute atomic share lot buy order | Yes |
| `/api/trade` | POST | `/sell` | Execute atomic share sell order | Yes |
| `/api/portfolio` | GET | `/` | Fetch user portfolio, holdings & P/L breakdown | Yes |
| `/api/wallet` | GET | `/details` | Get cash balance & valuation | Yes |
| `/api/wallet` | POST | `/deposit` | Simulate virtual LKR cash deposit | Yes |
| `/api/wallet` | POST | `/withdraw` | Request bank withdrawal (SLIPS/CEFT) | Yes |
| `/api/wallet` | POST | `/convert` | Convert between LKR and USD at live rate | Yes |
| `/api/kyc` | POST | `/verify-nic` | Parse & verify Sri Lankan NIC via OCR | Yes |
| `/api/kyc` | GET | `/status` | Get regulatory KYC tier & status | Yes |
| `/api/ai` | GET | `/insights` | Fetch multi-stock AI forecasts & technicals | Yes |
| `/api/ai` | GET | `/prediction/:sym`| Get ARIMA/LSTM forecast for specific stock | Yes |
| `/api/ai` | GET | `/sentiment` | Fetch financial news NLP sentiment score | Yes |
| `/api/ai` | GET | `/evaluation` | Fetch model accuracy metrics (MAE/RMSE/MAPE) | Yes |
| `/api/ai` | POST | `/chat` | Interactive SOMI AI financial assistant query | Yes |
| `/api/admin` | GET | `/users` | Admin user directory & role management | Admin |
| `/api/admin` | GET | `/audit-logs` | Admin security & trading audit log trail | Admin |
| `/api/admin` | PUT | `/kyc/:id` | Review & approve KYC verification documents | Admin |
