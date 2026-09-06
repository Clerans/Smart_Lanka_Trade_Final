# Target Architecture Specification

---

## 1. High-Level System Architecture

```text
+-------------------------------------------------------------------------+
|                  SmartLanka Trade Mobile Client                         |
|             (React Native / Expo SDK 55 / TypeScript)                   |
+-------------------------------------------------------------------------+
       |                           |                          |
 (Auth & Profile)            (Market & Trade)          (AI & Analytics)
       |                           |                          |
       v                           v                          v
+-------------------------------------------------------------------------+
|                  Express.js Enterprise API Gateway                      |
|            (CORS, Helmet, Rate Limiter, JWT RBAC Guard)                 |
+-------------------------------------------------------------------------+
       |                           |                          |
       v                           v                          v
+------------------+     +-------------------+     +----------------------+
| Core Services    |     | Financial Engine  |     | AI & Data Pipeline   |
| - AuthService    |     | - TradeService    |     | - AIService          |
| - KYCService     |     | - PortfolioService|     | - MarketService      |
| - AuditService   |     | - WalletService   |     | - PriceMonitor       |
+------------------+     +-------------------+     +----------------------+
       |                           |                          |
       +---------------------------+--------------------------+
                                   |
                                   v
             +-------------------------------------------+
             |        Oracle Database Engine             |
             |  - SL_USERS         - WALLETS             |
             |  - PORTFOLIOS       - TRANSACTIONS        |
             |  - SL_AUDIT_LOGS    - SL_KYC_DOCUMENTS    |
             |  - MARKET_CACHE     - AI_PREDICTIONS      |
             +-------------------------------------------+
```

---

## 2. Canonical Module Structure

1. **Authentication Module:** Registration, bcrypt-hashed OTP verification, login with RBAC (`INVESTOR`, `ADMIN`), Google OAuth verification, password recovery.
2. **KYC & Regulatory Compliance Module:** Sri Lankan National Identity Card parser (Old 9V/X and New 12-digit format), gender determination, birth year extraction, document verification.
3. **Market Data Module:** Colombo Stock Exchange (CSE) equities provider, live OHLCV price generation, ASPI and S&P SL20 tracking, CBSL forex rates.
4. **Trading & Execution Module:** High-integrity paper trading engine enforcing integer share lot sizing, available cash validation, and atomic Oracle transactions.
5. **Portfolio & Accounting Module:** Mathematically exact accounting: Available Cash, Market Value, Cost Basis, Unrealized P/L, Realized P/L, Daily P/L.
6. **AI / ML Quantitative Module:** Time-series forecasting (ARIMA, LSTM, Random Forest) with evaluation metrics (MAE, RMSE, MAPE) and technical indicators (RSI, SMA, Volatility).
7. **NLP Sentiment Module:** Financial news scraper and sentiment analyzer processing Sri Lankan business publications with confidence ratings.
8. **Conversational Copilot (SOMI):** AI trading assistant offering market trend insights, risk disclaimers, and platform guidance.
9. **Audit & Governance Module:** Comprehensive immutable audit logging in `SL_AUDIT_LOGS` capturing all security and financial operations.
