# Deep Code Audit & Vulnerability Report

---

## 1. Critical Finding ID Matrix

### SEC-01: Plaintext OTP Leakage in Registration Payload
* **Severity:** P0 / Critical
* **File:** `Backend/services/authService.js`, `Backend/controllers/authController.js`
* **Problem:** Registration response payload included the plaintext 6-digit OTP in the JSON return object and printed it to stdout.
* **Impact:** An attacker intercepting HTTP responses or inspecting logs could instantly bypass email verification.
* **Root Cause:** Developers included the raw generated OTP in the controller return statement for debugging purposes.
* **Remediation:** Removed OTP from return object; hashed OTP with bcrypt prior to database storage; suppressed stdout logs in production.
* **Verification:** `tests/integration_test_suite.js` (Bcrypt OTP hashing & zero leakage verification).

---

### SEC-02: Missing Role-Based Authorization Guard on Admin Endpoints
* **Severity:** P0 / Critical
* **File:** `Backend/middleware/authMiddleware.js`, `Backend/routes/adminRoutes.js`
* **Problem:** Admin routes lacked role verification checks, allowing any authenticated investor token to access administrative functions.
* **Impact:** Unauthorized investors could access system audit logs, review KYC submissions, and modify platform settings.
* **Root Cause:** Only standard `protect` middleware was applied without verifying `req.user.role === 'ADMIN'`.
* **Remediation:** Created `adminProtect` middleware that validates JWT claims and enforces `role === 'ADMIN'`.
* **Verification:** `tests/integration_test_suite.js` (JWT RBAC validation).

---

### FIN-01: Crypto Asset Confusion & Scope Mismatch
* **Severity:** P0 / Architectural
* **File:** `Backend/services/marketService.js`, `Frontend/src/screens/market/MarketWatchScreen.tsx`
* **Problem:** System called Binance crypto APIs and displayed BTC, ETH, SOL while labeling the platform as a Sri Lankan stock exchange.
* **Impact:** Violated Horizon Campus IT41028 research scope and misrepresented Colombo Stock Exchange mechanics.
* **Root Cause:** Initial prototype copied cryptocurrency market templates without building a CSE equities data provider.
* **Remediation:** Built `CSEMarketDataProvider` with top 12 blue-chip stocks, official tickers (`JKH.N0000`, `COMB.N0000`, etc.), and CBSL forex rates.
* **Verification:** `tests/integration_test_suite.js` (CSE Equities Catalog resolution).

---

### FIN-02: Non-Atomic Order Execution & Concurrency Vulnerability
* **Severity:** P0 / Financial Integrity
* **File:** `Backend/services/tradeService.js`
* **Problem:** Trade buy/sell operations performed balance check and deduction in separate uncommitted steps without row locks.
* **Impact:** Concurrent trade requests could lead to double-spending or negative balances.
* **Root Cause:** Missing `SELECT ... FOR UPDATE` row locks and multi-statement Oracle transaction blocks.
* **Remediation:** Implemented atomic transaction handling with explicit row locks, balance verification, and immediate rollback on failure.
* **Verification:** Validated via automated trade tests.

---

### UI-01: Dead Buttons and Empty Event Handlers
* **Severity:** P1 / Functional
* **File:** `Frontend/src/screens/wallet/CurrencyConversionScreen.tsx`, `Frontend/src/screens/ai/SOMIAIChatScreen.tsx`, `Frontend/src/screens/auth/KYCVerificationScreen.tsx`, `Frontend/src/screens/assets/AssetDetailsScreen.tsx`
* **Problem:** Multiple buttons had empty `onPress={() => {}}` handlers or static non-interactive state.
* **Impact:** Core user journeys (currency conversion, chatbot interaction, KYC verification, asset detail trading) were blocked.
* **Root Cause:** Frontend UI mockup files were not wired to backend service APIs.
* **Remediation:** Wired all buttons to live `apiService` methods with loading spinners, error alerts, and state synchronization.
* **Verification:** All screens compiled and verified with functional API integrations.
