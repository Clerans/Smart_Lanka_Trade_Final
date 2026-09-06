# Baseline Feature & Module Matrix

---

## 1. System Feature Matrix

| Feature Area | Sub-Module | Frontend Screen | Backend Route | Implementation Status | Scope Alignment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Registration | `RegisterScreen.tsx` | `POST /api/auth/register` | ✅ Production Ready | Standard Investor Onboarding |
| **Authentication** | OTP Verification | `OTPVerificationScreen.tsx` | `POST /api/auth/verify-otp` | ✅ Production Ready | Bcrypt Hashed, 5-Min Expiry |
| **Authentication** | Login & JWT | `LoginScreen.tsx` | `POST /api/auth/login` | ✅ Production Ready | RBAC (`INVESTOR`, `ADMIN`) |
| **Authentication** | Google OAuth | `LoginScreen.tsx` | `POST /api/auth/google` | ✅ Production Ready | Token Verifier Hook |
| **Authentication** | Password Reset | `ForgotPasswordScreen.tsx` | `POST /api/auth/forgot-password`| ✅ Production Ready | Time-limited reset token |
| **Identity / KYC** | Sri Lankan NIC OCR | `KYCVerificationScreen.tsx` | `POST /api/kyc/verify-nic` | ✅ Production Ready | Old 9V/X & New 12-Digit parser |
| **Identity / KYC** | KYC Tier Status | `KYCVerificationScreen.tsx` | `GET /api/kyc/status` | ✅ Production Ready | SEC Tier 1 / Tier 2 status |
| **Market Data** | CSE Equities Quotes | `MarketWatchScreen.tsx` | `GET /api/market/prices` | ✅ Production Ready | 12 Top CSE Blue-Chips in LKR |
| **Market Data** | Detailed Quote | `AssetDetailsScreen.tsx` | `GET /api/market/quote/:sym` | ✅ Production Ready | OHLCV, Volume, Sector |
| **Market Data** | Forex Rates | `CurrencyConversionScreen.tsx`| `GET /api/market/forex` | ✅ Production Ready | CBSL Benchmark Rate (USD/LKR) |
| **Trading Engine**| Buy Shares | `TradingTerminalScreen.tsx` | `POST /api/trade/buy` | ✅ Production Ready | Integer Share Lot Validation |
| **Trading Engine**| Sell Shares | `TradingTerminalScreen.tsx` | `POST /api/trade/sell` | ✅ Production Ready | Overselling Prevention |
| **Paper Trading** | Demo Simulator | `DemoTradingScreen.tsx` | `POST /api/trade/buy` | ✅ Production Ready | Virtual 1M LKR paper engine |
| **Portfolio** | Net Worth & Holdings| `HomeScreen.tsx` | `GET /api/portfolio` | ✅ Production Ready | Cash + Equities Valuation |
| **Portfolio** | Daily & Realized P/L| `WalletOverviewScreen.tsx` | `GET /api/portfolio` | ✅ Production Ready | Exact Financial Formulas |
| **Wallet** | Cash Overview | `WalletOverviewScreen.tsx` | `GET /api/wallet/details` | ✅ Production Ready | Available vs Invested Cash |
| **Wallet** | Deposit / Withdraw | `WalletOverviewScreen.tsx` | `POST /api/wallet/deposit` | ✅ Production Ready | SLIPS/CEFT Bank Withdrawal |
| **Wallet** | Forex Conversion | `CurrencyConversionScreen.tsx`| `POST /api/wallet/convert` | ✅ Production Ready | Zero-Fee LKR/USD Conversion |
| **AI / ML** | 7-Day Forecast | `AIAnalyticsScreen.tsx` | `GET /api/ai/prediction/:sym`| ✅ Production Ready | ARIMA/LSTM Time-Series Hybrid |
| **AI / ML** | Evaluation Metrics | `AIAnalyticsScreen.tsx` | `GET /api/ai/evaluation` | ✅ Production Ready | MAE, RMSE, MAPE, Accuracy |
| **NLP Sentiment** | News Sentiment | `AIAnalyticsScreen.tsx` | `GET /api/ai/sentiment` | ✅ Production Ready | Daily FT / Biz News NLP Score |
| **AI Copilot** | SOMI Helpdesk | `SOMIAIChatScreen.tsx` | `POST /api/ai/chat` | ✅ Production Ready | CSE Conversational Assistant |
| **Alerts** | Price Thresholds | `SetAlertModal.tsx` | `POST /api/alerts` | ✅ Production Ready | Price Monitoring Background Worker |
| **Admin System** | User & KYC Mgmt | Internal Dashboard | `GET /api/admin/users` | ✅ Production Ready | Protected by `adminProtect` |
| **Audit Trail** | Security Logging | Internal Service | `GET /api/admin/audit-logs` | ✅ Production Ready | `SL_AUDIT_LOGS` Persistent Trail |
