# DOCUMENT 05 — BACKEND SCHEMA & SECURITY REVIEW
## SmartLanka Trade – Database Architecture, Entity Relationships & Security Posture

---

### 1. Database Entity Overview (Oracle Database)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    SL_USERS     │1     1│     WALLETS     │1     *│   PORTFOLIOS    │
│─────────────────│───────│─────────────────│───────│─────────────────│
│ ID (PK)         │       │ WALLET_ID (PK)  │       │ PORTFOLIO_ID(PK)│
│ EMAIL (UQ)      │       │ USER_ID (FK)    │       │ USER_ID (FK)    │
│ PASSWORD (HASH) │       │ BALANCE_LKR     │       │ SYMBOL          │
│ KYC_STATUS      │       │ UPDATED_AT      │       │ QUANTITY        │
└────────┬────────┘       └─────────────────┘       │ AVERAGE_PRICE   │
         │                                          └─────────────────┘
         │1
         ├──────────────────────┬──────────────────────┬─────────────────┐
         │*                     │*                     │*                │*
┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐  ┌─────┴───────────┐
│   EMAIL_OTPS    │    │  TRANSACTIONS   │    │  KYC_DOCUMENTS  │  │    SL_ALERTS    │
│─────────────────│    │─────────────────│    │─────────────────│  │─────────────────│
│ ID (PK)         │    │ TRANSACTION_ID  │    │ ID (PK)         │  │ ID (PK)         │
│ EMAIL           │    │ USER_ID (FK)    │    │ USER_ID (FK)    │  │ USER_ID (FK)    │
│ OTP_HASH (SHA256│    │ SYMBOL          │    │ DOCUMENT_TYPE   │  │ SYMBOL          │
│ EXPIRES_AT      │    │ TRANSACTION_TYPE│    │ DOCUMENT_NUMBER │  │ TARGET_PRICE    │
│ ATTEMPTS        │    │ TOTAL_AMOUNT    │    │ OCR_CONFIDENCE  │  │ ALERT_TYPE      │
└─────────────────┘    └─────────────────┘    │ VERIFICATION_ST │  │ IS_ACTIVE       │
                                              └─────────────────┘  └─────────────────┘
```

---

### 2. Comprehensive Schema Dictionary

| Table Name | Primary Key | Foreign Keys | Purpose & Key Columns |
| :--- | :--- | :--- | :--- |
| `SL_USERS` | `ID` (Identity) | None | Core user account table (`EMAIL`, `PASSWORD`, `NAME`, `KYC_STATUS`, `ROLE`, `FAILED_ATTEMPTS`, `ACCOUNT_LOCKED_UNTIL`). |
| `EMAIL_OTPS` | `ID` (Identity) | None (Email lookup) | 6-digit registration & login OTP storage (`OTP_HASH`, `EXPIRES_AT`, `ATTEMPTS`). Indexed by `EMAIL`. |
| `WALLETS` | `WALLET_ID` | `USER_ID` -> `SL_USERS(ID)` | Virtual paper trading balance in LKR (`BALANCE_LKR` default: `1,000,000.00`). |
| `PORTFOLIOS` | `PORTFOLIO_ID` | `USER_ID` -> `SL_USERS(ID)` | Holding positions per asset (`SYMBOL`, `QUANTITY`, `AVERAGE_PRICE`, `INVESTED_AMOUNT`). Unique on `(USER_ID, SYMBOL)`. |
| `TRANSACTIONS` | `TRANSACTION_ID`| `USER_ID` -> `SL_USERS(ID)` | Trade execution audit ledger (`SYMBOL`, `TRANSACTION_TYPE`, `QUANTITY`, `PRICE`, `TOTAL_AMOUNT`, `STATUS`). |
| `KYC_DOCUMENTS` | `ID` (Identity) | `USER_ID` -> `SL_USERS(ID)` | Sri Lankan NIC OCR data (`DOCUMENT_NUMBER`, `EXTRACTED_NAME`, `EXTRACTED_DOB`, `OCR_CONFIDENCE`, `VERIFICATION_STATUS`). |
| `AI_RECOMMENDATIONS`| `ID` (Identity) | `USER_ID` (Optional) | Backtested algorithmic signals (`SYMBOL`, `TIMEFRAME`, `RECOMMENDATION`, `CONFIDENCE`, `RSI`, `MACD`, `EMA20`). |
| `SL_ALERTS` | `ID` (Identity) | `USER_ID` -> `SL_USERS(ID)` | Price alerts (`SYMBOL`, `TARGET_PRICE`, `ALERT_TYPE`, `IS_ACTIVE`). |
| `MARKET_CACHE` | `SYMBOL` | None | High-throughput price cache (`PRICE_USD`, `PRICE_LKR`, `LAST_UPDATED`). |

---

### 3. Security Review & Threat Mitigation Audit

| Security Domain | Risk Evaluated | Codebase Mitigation & Verification | Status |
| :--- | :--- | :--- | :--- |
| **Authentication** | Brute force login | `FAILED_ATTEMPTS` counter + `ACCOUNT_LOCKED_UNTIL` lockout after 5 consecutive failures. | **SECURED** |
| **Password Storage** | Plaintext exposure | `bcryptjs` hashing with salt rounds before database insertion. | **SECURED** |
| **OTP Transmission** | Replay & Interception | OTP stored as HMAC-SHA256 hash (`migrate-v6-otp-hash.js`); 10-minute validity; max 5 verify attempts. | **SECURED** |
| **SQL Injection** | Dynamic SQL attacks | Oracle parameterized queries (`:param` binds) across all database operations in services/models. | **SECURED** |
| **API Authorization** | Broken Object Level Auth | `authMiddleware` validates JWT bearer token and extracts `req.user.id` for all private routes. | **SECURED** |
| **File Upload Security** | Malicious file payload | `multer` file filter restricted to JPEG/PNG image MIME types with size limits. | **SECURED** |
| **Secret Management** | Credentials in Git | All sensitive credentials kept in `.env` (omitted via `.gitignore`). | **SECURED** |
| **Financial Concurrency**| Double spending | Database transactions wrap trade execution, locking rows and deducting cash atomically. | **SECURED** |
