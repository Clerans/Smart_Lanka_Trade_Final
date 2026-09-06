# Database Inventory & Schema Baseline

**Engine:** Oracle Database 19c / 21c (oracledb node driver)  
**Schema Definition:** `Backend/schema.sql`  

---

## 1. Canonical Database Tables Inventory

| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `SL_USERS` | `USER_ID` (RAW/UUID) | None | `EMAIL`, `PASSWORD_HASH`, `FULL_NAME`, `ROLE`, `KYC_STATUS`, `CREATED_AT` | Core user identity & role-based access control (`INVESTOR`, `ADMIN`). |
| `WALLETS` | `WALLET_ID` | `USER_ID` -> `SL_USERS` | `BALANCE_LKR`, `AVAILABLE_BALANCE`, `USD_BALANCE`, `UPDATED_AT` | Virtual trading cash & multi-currency wallet ledger. |
| `PORTFOLIOS` | `PORTFOLIO_ID` | `USER_ID` -> `SL_USERS` | `SYMBOL`, `QUANTITY`, `AVERAGE_BUY_PRICE`, `TOTAL_INVESTED`, `UPDATED_AT` | Active stock holdings on the Colombo Stock Exchange. |
| `TRANSACTIONS` | `TRANSACTION_ID` | `USER_ID` -> `SL_USERS` | `TYPE`, `SYMBOL`, `QUANTITY`, `PRICE`, `AMOUNT`, `STATUS`, `CREATED_AT` | Financial transaction ledger (BUY, SELL, DEPOSIT, WITHDRAW, CONVERT). |
| `SL_ALERTS` | `ALERT_ID` | `USER_ID` -> `SL_USERS` | `SYMBOL`, `TARGET_PRICE`, `CONDITION`, `IS_TRIGGERED`, `CREATED_AT` | CSE stock price threshold alert subscriptions. |
| `SL_EMAIL_VERIFICATION`| `ID` | None | `EMAIL`, `OTP_HASH`, `EXPIRES_AT`, `ATTEMPTS_COUNT`, `IS_USED` | Bcrypt-hashed registration OTP verification. |
| `SL_PASSWORD_RESET` | `ID` | None | `EMAIL`, `RESET_TOKEN_HASH`, `EXPIRES_AT`, `IS_USED` | Secure password reset token records. |
| `SL_KYC_DOCUMENTS` | `DOC_ID` | `USER_ID` -> `SL_USERS` | `DOC_TYPE`, `NIC_NUMBER`, `FULL_NAME`, `DOB`, `GENDER`, `STATUS`, `OCR_RAW_TEXT` | Sri Lankan NIC identity documents & OCR metadata. |
| `SL_AUDIT_LOGS` | `AUDIT_ID` | `USER_ID` (Nullable) | `ACTION`, `ENTITY`, `ENTITY_ID`, `IP_ADDRESS`, `USER_AGENT`, `DETAILS`, `STATUS`, `CREATED_AT` | Enterprise security and trading audit trail. |
| `MARKET_CACHE` | `SYMBOL` | None | `COMPANY_NAME`, `SECTOR`, `PRICE_LKR`, `CHANGE_PERCENT`, `OPEN_PRICE`, `HIGH_PRICE`, `LOW_PRICE`, `VOLUME` | Real-time Colombo Stock Exchange market data cache. |
| `CURRENCY_RATES` | `PAIR` | None | `RATE`, `SOURCE`, `LAST_UPDATED` | Central Bank of Sri Lanka (CBSL) benchmark exchange rates. |
| `AI_PREDICTIONS` | `PREDICTION_ID` | None | `SYMBOL`, `PREDICTED_PRICE`, `CONFIDENCE`, `MODEL_NAME`, `METRICS_JSON`, `CREATED_AT` | Historical AI/ML quantitative forecasts. |
| `NEWS_SENTIMENT` | `ARTICLE_ID` | None | `SYMBOL`, `HEADLINE`, `SOURCE`, `SENTIMENT_SCORE`, `SENTIMENT_LABEL`, `PUBLISHED_AT` | NLP financial news sentiment analysis corpus. |

---

## 2. Integrity Constraints & Concurrency Rules

1. **Atomic Trade Deductions:** Buy orders lock the wallet row (`SELECT ... FOR UPDATE`), verify available funds, deduct cash, and insert/update portfolio holdings within a single transaction.
2. **Prevent Overselling:** Sell orders verify that `PORTFOLIOS.QUANTITY >= sellQuantity` with row-level locks before releasing shares and crediting cash.
3. **Audit Immutability:** `SL_AUDIT_LOGS` allows only `INSERT` operations to prevent tampering with historical audit events.
