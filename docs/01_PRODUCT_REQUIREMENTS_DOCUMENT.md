# DOCUMENT 01 — PRODUCT REQUIREMENTS DOCUMENT (PRD)
## SmartLanka Trade – Modern LKR-Based Stock & Crypto Trading Platform with AI Features

---

### 1. Product Overview
- **Product Name**: SmartLanka Trade
- **Tagline**: Trade Smarter. Securely. In Sri Lankan Rupees (LKR).
- **Core Value Proposition**: Sri Lanka's premier localized digital trading platform bridging global crypto/stock financial markets with real-time Central Bank of Sri Lanka (CBSL) USD/LKR exchange rates, automated multi-indicator algorithmic AI signals (SOMI AI), demo virtual portfolios, and Sri Lankan National Identity Card (NIC) OCR verification.

---

### 2. Problem Statement
1. **Currency Barrier**: Sri Lankan retail traders face steep friction converting foreign market valuations to Sri Lankan Rupees (LKR).
2. **Analysis Paralysis**: Novice and intermediate investors lack accessible real-time technical analysis and algorithmic momentum indicators.
3. **High Financial Risk**: Absence of realistic, localized virtual paper trading simulation with live market data for skill development.
4. **Friction in Identity Compliance**: Cumbersome, manual KYC processes that delay onboarding for Sri Lankan users.

---

### 3. Target Users & User Personas
- **Persona A — "The Emerging Retail Trader" (Kavindu, 24, Colombo)**: University student/young professional wanting to learn trading with virtual LKR 1,000,000 demo capital before risking real money.
- **Persona B — "The Active Technical Trader" (Nadeesha, 32, Kandy)**: Crypto enthusiast looking for real-time LKR price quotes, Binance live order book feeds, and algorithmic AI momentum indicators (RSI, MACD, EMA).
- **Persona C — "The Diaspora & Remittance Investor" (Priyantha, 41, Dubai/Galle)**: User looking for seamless USD/LKR currency conversion rates, instant CEFTS bank transfer deposit simulations, and biometric-secured mobile access.

---

### 4. Feature Inventory & Implementation Status

| Feature Domain | Module / Feature | Status | Backend / Engine Support |
| :--- | :--- | :--- | :--- |
| **Auth & Security** | Email & Password Registration with Complexity Check | **Fully Implemented** | Express + bcrypt + Oracle DB (`SL_USERS`) |
| **Auth & Security** | 6-Digit Email OTP Verification (HMAC-SHA256) | **Fully Implemented** | Resend / Brevo API (`EMAIL_OTPS`) |
| **Auth & Security** | Google OAuth Single Sign-On | **Fully Implemented** | `expo-auth-session` + Firebase Admin |
| **Auth & Security** | Biometric Authentication (Fingerprint / Face ID) | **Fully Implemented** | `expo-local-authentication` + SecureStore |
| **Auth & Security** | Forgot & Reset Password via Email OTP | **Fully Implemented** | Oracle DB (`SL_PASSWORD_RESET`) |
| **Market Data** | Live Multi-Asset Ticker Feed (BTC, ETH, SOL, BNB, etc.) | **Fully Implemented** | Binance REST API + CBSL LKR live conversion |
| **Market Data** | Interactive Candlestick Charts (1m, 5m, 15m, 1h, 4h, 1d) | **Fully Implemented** | Binance Kline API + SVG Chart Engine + Overlays |
| **Market Data** | Search & Category Filtering (Crypto, Stocks, Indices) | **Fully Implemented** | Frontend Live Search & Filtering |
| **AI Engine** | Algorithmic Technical Indicators (RSI, MACD, SMA, EMA) | **Fully Implemented** | Oracle DB (`AI_RECOMMENDATIONS`) + Backtesting |
| **AI Engine** | SOMI AI Chat Assistant | **Fully Implemented** | Express `/api/ai/chat` Natural Language Engine |
| **Trading** | Real Trading Terminal with Limit/Market Orders | **Fully Implemented** | Express `/api/trade` + Oracle DB (`TRANSACTIONS`) |
| **Trading** | Demo Paper Trading with LKR 1,000,000 Virtual Capital | **Fully Implemented** | Oracle DB (`WALLETS`, `PORTFOLIOS`) |
| **Wallet & FX** | Multi-Asset Wallet Overview & CBSL Exchange Rate | **Fully Implemented** | Oracle DB (`SL_WALLETS`, `WALLETS`) |
| **Wallet & FX** | Deposit Modal (Card, Bank CEFTS, eZ Cash, JustPay) | **Fully Implemented** | Simulated settlement & idempotency keys |
| **Wallet & FX** | Currency Conversion Calculator (LKR <-> USD) | **Fully Implemented** | Real-time live exchange rate calculation |
| **KYC / Compliance**| Sri Lankan NIC OCR Verification (Old 9-digit & New 12-digit) | **Fully Implemented** | Tesseract.js OCR engine (`KYC_DOCUMENTS`) |
| **Alerts & Push** | Price Alert Engine (Above/Below Target Price) | **Fully Implemented** | Oracle DB (`SL_ALERTS`) + Expo Notifications |

---

### 5. Functional Requirements
1. **Authentication**: Users must verify email via 6-digit OTP before account activation.
2. **Real-Time Market Rates**: All prices must be quoted in LKR using CBSL FX rates.
3. **Execution Safety**: Trade execution must reject orders if available balance is insufficient or quantity is non-positive.
4. **KYC Verification**: NIC OCR extractor must validate format (9 digits + V/X or 12 numeric digits) and extract DOB and gender.
5. **Data Refresh**: Scrollable financial dashboards must support native pull-to-refresh.

---

### 6. Non-Functional Requirements
1. **Responsiveness**: Complete adaptive layout across 320dp to 430dp mobile screen widths.
2. **Performance**: Chart rendering under 60fps with zero layout thrashing.
3. **Security**: Zero credential leakage, hashed passwords (`bcryptjs`), hashed OTPs (`HMAC-SHA256`), and JWT authorization.
4. **Availability**: Offline fallback handling and clear network error state screens with retry triggers.

---

### 7. Explicit Out-of-Scope Items
- Direct connection to live Sri Lanka Stock Exchange (CSE) automated broker FIX protocol (due to CSE regulatory sandbox licensing restrictions; CSE indices are simulated/cached).
- Real fiat payment gateway bank debiting via live Central Bank RTGS (simulated via LankaPay JustPay / CEFTS idempotency API mock).
