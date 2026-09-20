# DOCUMENT 02 — TECHNICAL REQUIREMENTS DOCUMENT (TRD)
## SmartLanka Trade – Technical Architecture, Stack & Specifications

---

### 1. Technology Stack Inventory

#### 1.1 Frontend (Mobile Client)
- **Framework**: Expo SDK `~55.0.31` / React Native `0.83.10` / React `19.2.0`
- **Language**: TypeScript `~5.9.2`
- **Navigation**: React Navigation `^7.1.33` (Native Stack `^7.8.4` & Bottom Tabs `^7.15.5`)
- **Graphics & Charts**: `react-native-svg 15.15.3` (Custom Candlestick and Sparkline vector renderers)
- **Local Storage**: `@react-native-async-storage/async-storage 2.2.0`, `expo-secure-store ~55.0.18`
- **Authentication Providers**: `expo-auth-session ~55.0.18`, `expo-local-authentication ~55.0.18`
- **Camera & Media**: `expo-image-picker ~55.0.24`
- **HTTP Client**: `axios ^1.15.2`

#### 1.2 Backend (API Service)
- **Runtime**: Node.js `v18+` / Express `^5.2.1` (CommonJS module architecture)
- **Database Driver**: `oracledb ^6.10.0` (Oracle Autonomous Database / Cloud DB)
- **Security & Cryptography**: `bcryptjs ^3.0.3`, `jsonwebtoken ^9.0.3`, `crypto` (HMAC-SHA256)
- **OCR Engine**: `tesseract.js ^7.0.0` with trained English/Sinhala dataset (`eng.traineddata`)
- **Email Service**: `resend ^6.27.0` & `nodemailer ^10.0.3`
- **Push Notification Service**: `expo-server-sdk ^6.1.0`
- **Task Scheduler**: `node-cron ^4.2.1` (Periodic market data caching & alert triggers)
- **Rate Limiting**: `express-rate-limit ^8.7.0`
- **File Uploads**: `multer ^2.3.0`

---

### 2. Architecture & Communication Flow

```
[ Mobile App (React Native / Expo) ]
               │
               │ HTTPS / JSON API
               ▼
[ Node.js / Express Backend Server ]
   ├── /api/auth       ──► User Auth & 6-Digit OTP Engine
   ├── /api/market     ──► Binance Live Market & CBSL LKR FX Adapter
   ├── /api/ai         ──► Algorithmic Momentum Indicator & SOMI Chat
   ├── /api/trade      ──► Trading Execution & Balance Settlement
   ├── /api/wallet     ──► Multi-Asset Balances & Transactions
   ├── /api/kyc        ──► Tesseract.js OCR Document Parsing
   └── /api/alerts     ──► Price Alert & Push Notification Triggers
               │
               │ Oracle Thin Client Connection Pool
               ▼
[ Oracle Autonomous Cloud Database ]
   ├── SL_USERS / EMAIL_OTPS / SL_PASSWORD_RESET
   ├── WALLETS / PORTFOLIOS / TRANSACTIONS / SL_WALLETS
   ├── AI_RECOMMENDATIONS / MARKET_CACHE
   └── KYC_DOCUMENTS / SL_ALERTS
```

---

### 3. Environment Configuration (Variables by Name Only)

#### Backend `.env` Required Variables
- `PORT`: HTTP Server listening port (default: `5000` / `5001`)
- `NODE_ENV`: Application environment (`development` / `production`)
- `DB_USER`: Oracle database username
- `DB_PASSWORD`: Oracle database password
- `DB_CONNECT_STRING`: Oracle database connection descriptor (TNS string / Easy Connect)
- `JWT_SECRET`: Secret key for signing and verifying JWT bearer tokens
- `JWT_EXPIRES_IN`: JWT token validity duration (e.g., `7d`)
- `RESEND_API_KEY`: API key for Resend email dispatch
- `EMAIL_FROM`: Verified sender address for transactional OTP emails
- `FIREBASE_SERVICE_ACCOUNT`: Firebase credentials path/payload for token verification
- `BINANCE_API_BASE_URL`: Binance public spot market API URL

#### Frontend Environment Variables
- `EXPO_PUBLIC_API_URL`: Backend API base URL
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth client ID for mobile authentication

---

### 4. Technical Constraints & Security Standards
1. **Secret Isolation**: No production database passwords, JWT secrets, or API keys are committed to Git.
2. **Password Security**: Passwords hashed using bcrypt with work factor salt.
3. **OTP Expiration**: One-time pins expire within 10 minutes; max 5 failed verification attempts before lockout.
4. **Idempotent Transactions**: Financial operations use unique transaction UUIDs to prevent double-charging or double-order execution.
5. **Safe Memory Management**: Chart subscriptions and interval timers cleanly cleared on component unmount (`useEffect` cleanup).
