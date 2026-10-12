# SMARTLANKA TRADE — AUTOMATED TEST & VERIFICATION REPORT

**Date:** October 12, 2026  
**Environment:** Node.js v24.19.0, Expo SDK 55, React Native 0.83.10, React 19.2.0, Oracle DB  
**Status:** ✅ ALL AUTOMATED SUITES PASSED (133/133 Tests Passing, Zero TypeScript Errors)

---

## 1. Automated Test Execution Summary

| Test Suite File | Domain | Tests Run | Passed | Failed | Exit Code |
|---|---|:---:|:---:|:---:|:---:|
| `Backend/scripts/run-all-tests.js` | Core Security, Bcrypt, KYC, High-Value PIN, DB Health | 50 | 50 | 0 | 0 |
| `Backend/test-otp-flow.js` | Master OTP Lifecycle, Cryptographic Security & Brevo API | 27 | 27 | 0 | 0 |
| `Backend/test-security-lifecycle.js` | Phase 8 Security Lifecycle (OAuth, Biometrics, Lockout, Financial Rules) | 25 | 25 | 0 | 0 |
| `Backend/test-google-oauth.js` | Google OAuth 2.0 Token Contracts, Audiences, & JWT Issuance | 19 | 19 | 0 | 0 |
| `Backend/test-release-gate.js` | Production Release Gate (JWT, Tampering Guards, RBAC) | 12 | 12 | 0 | 0 |
| `Frontend/ (npx tsc --noEmit)` | Frontend TypeScript Type Safety & React Native Compilation | N/A | N/A | 0 | 0 |
| **Total Test Count** | | **133** | **133** | **0** | **0** |

---

## 2. Test Suite Breakdown

### 2.1 Backend Core Verification (`Backend/scripts/run-all-tests.js` — 50 Tests)
* **Suite 1: Cryptographic Security & OTP Lifecycle (9 Tests)**
  - CSPRNG high-entropy 6-digit numeric generation.
  - HMAC-SHA256 OTP hashing & verification.
  - 60-second resend cooldown enforcement.
  - 10-minute OTP expiration enforcement.
* **Suite 2: Password Security (Bcrypt) (4 Tests)**
  - Salted bcrypt hash generation with standard prefix `$2`.
  - Positive and negative password verification.
  - Zero plaintext password persistence.
* **Suite 3: JWT Lifecycle & Token Verification (5 Tests)**
  - 3-segment signed JWT issuance.
  - User ID and role authorization preservation.
  - Tampered signature rejection.
  - Expired token rejection.
* **Suite 4: KYC OCR Decision Engine (9 Tests)**
  - Thresholds: 70% approval, 30% readable minimum.
  - Parses old (9-digit + V) and new (12-digit) Sri Lankan National Identity Cards.
  - Calculates birth year and gender from NIC day number.
  - Approves high-confidence matching documents, rejects low OCR scores.
* **Suite 5: Market Data & Exchange Rate Transparency (9 Tests)**
  - Crypto symbol normalization (BTCUSDT, ETHUSDT).
  - Exchange rate source attribution (Central Bank of Sri Lanka / live forex).
  - Unlisted asset rejection.
* **Suite 6: High-Value Financial Security & PIN Hardening (7 Tests)**
  - Sub-100k transactions permitted without PIN.
  - Transactions $\ge$ LKR 100,000 without PIN blocked (`HIGH_VALUE_PIN_REQUIRED`).
  - Transactions $\ge$ LKR 100,000 for users without PIN blocked (`PIN_SETUP_REQUIRED`).
  - Incorrect PIN blocked with HTTP 401.
  - Correct bcrypt PIN authorized.
  - Legacy SHA-256 PIN upgraded to bcrypt transparently.
  - 5-attempt rate-limiting and 15-minute lockout enforced.
* **Suite 7: Trade Order Simulation (5 Tests)**
  - Validates balances, rejects excessive sell orders, rejects NaN/zero order quantities.
* **Suite 8: Oracle DB Health Probe Contract (2 Tests)**
  - Probes live database via `SELECT 1 FROM DUAL`, reports degraded status truthfully on failure.

### 2.2 Phase 8 Security Lifecycle (`Backend/test-security-lifecycle.js` — 25 Tests)
* **Google OAuth 2.0 (9 Tests)**
  - Empty/missing token rejection.
  - Invalid JWT format rejection.
  - Expired token recognition.
  - Audience mismatch rejection (accepts only Web and Android client IDs).
  - Issuer validation (`https://accounts.google.com`).
  - Unverified email rejection (`email_verified=false`).
  - Safe account linking matching on verified email.
  - Authoritative SmartLanka JWT issuance.
  - Complete verification that Firebase SDKs are absent.
* **Biometric Session Lifecycle (8 Tests)**
  - Hardware-lacking devices fall back cleanly to password.
  - Unenrolled devices notify user to configure system biometrics.
  - Missing saved session prompts for initial password authentication.
  - Biometric sensor user cancellation aborts cleanly without corrupting state.
  - Valid saved session restores verified JWT.
  - Expired tokens on restoration are rejected and routed to login.
  - Logout clears saved biometric session credentials.
  - Account switching requires re-authenticating new credentials.
* **Server Transaction PIN Hardening (8 Tests)**
  - Salted bcrypt hashing verified.
  - Legacy SHA-256 hash upgrade verified.
  - Sub-100k transfer bypass verified.
  - High-value transfer PIN requirement verified.
  - Invalid PIN rejected.
  - 5-attempt progressive lockout verified.
  - Modifying existing PIN requires current PIN authorization.
  - Direct API requests attempting to bypass frontend checks are blocked by the backend.

### 2.3 Master OTP & Brevo Delivery (`Backend/test-otp-flow.js` — 27 Tests)
- Cryptographic OTP generation and timing-safe comparisons.
- Oracle database storage in `SL_EMAIL_VERIFICATION` and `SL_PASSWORD_RESET`.
- Cooldown timers and rate-limit guards.
- Brevo transactional email delivery and safe error handling.
- Verification that deleted `firebase.ts` is not accessed and Firebase is eliminated.

### 2.4 Production Release Gate (`Backend/test-release-gate.js` — 12 Tests)
- JWT authorization on protected endpoints.
- Parameter tampering guards on transfer and wallet operations.
- Role-based access control (RBAC) on admin endpoints.

### 2.5 Google OAuth Contract Tests (`Backend/test-google-oauth.js` — 19 Tests)
- Google Web Client ID and Android Client ID verification.
- `OAuth2Client` token verification, audience matching, and user profile provisioning.

---

## 3. Boundary Distinctions: Unit Mocks vs. Live Integration

| Feature | Tested Locally (Automated) | Tested Against Live Service | Notes |
|---|---|---|---|
| **Google ID Token Payload** | Unit tests with signed mock Google JWTs | Mocked in unit test | Google Cloud requires real interactive browser session |
| **PKCE Code Exchange** | Contract tests & unit token parsing | Mocked in unit test | Google OAuth endpoint requires real authorization code |
| **Biometric Hardware** | State machine & mock `LocalAuthentication` | Mocked in unit test | Physical biometric sensor only exists on physical Android device |
| **SecureStore Persistence** | Unit tests & compilation check | Mocked in unit test | Native hardware secure storage runs inside Android Keystore |
| **Oracle Database** | Live connection test with mock fallback | Live in Render environment | Local environment lacks cloud wallet (`/etc/secrets/tnsnames.ora`) |
| **Bcrypt & Lockout Logic** | Real cryptographic execution | Real execution | Fully executed and validated live |
| **Financial Threshold Rules** | Real execution in `walletFundingService` | Real execution | Fully executed and validated live |
| **Brevo Transactional Email** | Live API dispatch via Brevo HTTP API | Live execution | Real message sent and validated |

---

## 4. Manual Android Physical Device Verification Checklist

To verify the installation on an actual Android device with hardware biometrics:

1. **Google OAuth 2.0 Sign-In:**
   - [ ] Tap "Continue with Google" on `LoginScreen`.
   - [ ] Confirm the browser/modal opens without `Error 400: invalid_request`.
   - [ ] Select a Google Account authorized in Google Cloud Console.
   - [ ] Confirm Google redirects back to the app.
   - [ ] Confirm the user reaches the SmartLanka Trade dashboard with an authoritative session.

2. **First Authenticated Password Login & Biometric Prompt:**
   - [ ] On a fresh installation, tap the Biometric button on `LoginScreen`.
   - [ ] Verify it does NOT scan fingerprint; it displays: *"Please sign in once with your password or Google account so your session credentials can be securely registered on this device."*
   - [ ] Log in with email and password.
   - [ ] Confirm the modal prompts: *"Would you like to enable Fingerprint for faster sign-ins?"*
   - [ ] Tap "Enable". Confirm fingerprint is registered.

3. **Biometric Session Restoration:**
   - [ ] Fully close the SmartLanka Trade app (swipe away from recent apps).
   - [ ] Relaunch the app.
   - [ ] On `LoginScreen`, tap the Biometric button.
   - [ ] Scan registered fingerprint.
   - [ ] Confirm the app validates the token with the backend and transitions directly into `MainApp`.

4. **Biometric Session Clearance on Logout:**
   - [ ] Navigate to `ProfileScreen` $\rightarrow$ tap "Logout".
   - [ ] Confirm redirected to `LoginScreen`.
   - [ ] Tap the Biometric button.
   - [ ] Confirm the previous session is gone and the app prompts for password login.

5. **Security Settings & Facial Recognition Detection:**
   - [ ] Navigate to `Security Settings`.
   - [ ] On an Android device without IR/3D facial hardware, confirm the "Facial Recognition" toggle displays: *"Hardware sensor not available on this device"* and cannot be enabled.
   - [ ] On a device with Fingerprint hardware, confirm "Biometric Login" can be toggled on/off after fingerprint verification.

6. **Transaction PIN & High-Value Transfer Enforcement:**
   - [ ] In `Security Settings`, tap "Set Transaction PIN".
   - [ ] Configure a 4-digit PIN (e.g. `4567`).
   - [ ] Tap "Save". Verify success toast.
   - [ ] Tap "Change Transaction PIN". Confirm the modal now requires "Current Security PIN".
   - [ ] Enter an incorrect current PIN. Confirm server rejects with: *"Current security PIN is incorrect."*
   - [ ] Attempt an internal transfer of LKR 50,000 $\rightarrow$ Confirm executes without PIN.
   - [ ] Attempt an internal transfer of LKR 100,000 without PIN $\rightarrow$ Confirm rejected.
   - [ ] Enter wrong PIN 5 times $\rightarrow$ Confirm account locked for 15 minutes.
   - [ ] Enter correct PIN $\rightarrow$ Confirm transfer is authorized and processed.
