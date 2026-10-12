# SMARTLANKA TRADE — AUTHENTICATION & SECURITY REPAIR REPORT

**System Version:** SmartLanka Trade v2.4 (Enterprise Edition)  
**Date:** October 12, 2026  
**Auditor / Engineering Role:** Senior React Native/Expo Engineer, Node.js Backend Engineer, OAuth 2.0/OIDC Specialist, Oracle DB Engineer & Application Security Engineer  

---

## 1. Executive Summary

A comprehensive, zero-shortcut audit and repair of Google OAuth 2.0, biometric session restoration, transaction PIN security, and complete removal of obsolete Firebase remnants was executed across the **SmartLanka Trade** platform (`Frontend/` and `Backend/`).

### Core Deficiencies Addressed:
1. **Google OAuth 2.0 Error 400 (`invalid_request` / `Access blocked: Authorization Error`):** 
   - Root Cause: The mobile application was passing an **Android OAuth Client ID** (`614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15`) to Google's web-based authorization endpoint (`https://accounts.google.com/o/oauth2/v2/auth`). Google Cloud's web OAuth endpoint explicitly rejects Android client IDs with `Error 400: invalid_request`, as Android client IDs are strictly reserved for native Google Play Services APIs.
   - Solution: For the Expo browser-based authorization code flow with PKCE, configured `LoginScreen.tsx` to use the **Web Client ID** (`614054153944-7figt10pghsb14tg764jj3hfnktkqnbt.apps.googleusercontent.com`) for the authorization request and code exchange, while keeping the Android Client ID registered for audience validation and native capabilities.
2. **Biometric Premature Prompt & Session Amnesia:**
   - Root Cause: `SplashScreen.tsx` was calling `authService.logout()` on cold boots when `rememberMe !== 'true'`, wiping SecureStore credentials. Furthermore, `storageService.ts` was catching and swallowing errors in `setToken()`, `setUserData()`, and `saveBiometricSession()`, masking persistence failures.
   - Solution: Removed destructive boot logout; made storage writes propagate failures; verified that credentials can be retrieved immediately after saving; and pre-checked hardware and saved session before prompting the biometric sensor.
3. **Insecure Transaction PIN Storage & Bypasses:**
   - Root Cause: `storageService.ts` was storing raw PINs locally in SecureStore (`userSecurityPin`), and `userModel.js` allowed default `'1234'`.
   - Solution: Completely removed raw PIN storage and retrieval from the frontend. Transaction PIN is now strictly transient in input state, sent over TLS to the backend, hashed with salted `bcrypt`, rate-limited (5 attempts, 15-minute lockout), and authoritatively enforced on the backend for transactions $\ge$ LKR 100,000.
4. **Complete Elimination of Obsolete Firebase Remnants:**
   - Removed obsolete Firebase UID linking (`linkLegacyAccount`, `linkFirebaseUid`, `findByFirebaseUid`, and `firebaseUid` from middleware). Updated test suites (`test-release-gate.js`, `test-otp-flow.js`) to validate native JWT, Google OAuth, and Brevo email OTP.

---

## 2. Root Cause Analysis & Deep Dive

### 2.1 Google OAuth 2.0 Failure (`Error 400: invalid_request`)
* **Verified Technical Cause:**
  When using `expo-auth-session` / `Google.useAuthRequest`, the app launches an in-app browser (Chrome Custom Tabs) to Google's authorization endpoint:
  ```
  https://accounts.google.com/o/oauth2/v2/auth
  ```
  In `LoginScreen.tsx`, passing `androidClientId: googleAndroidClientId` caused `expo-auth-session`'s platform resolver to select the Android Client ID (`614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15`) as the `client_id` parameter.
* **Google Cloud OAuth Policy Constraint:**
  Google Cloud Console defines Android Client IDs by package name (`com.michael_clerans.SmartLankaTrade`) and SHA-1 certificate fingerprint. Android Client IDs do **not** have redirect URIs and cannot be processed by the browser authorization endpoint (`/o/oauth2/v2/auth`).
  When Google's authorization server receives an authorization request specifying an Android client ID over the web endpoint, it halts with:
  ```
  Access blocked: Authorization Error
  Error 400: invalid_request
  ```
* **Implemented Architectural Resolution:**
  1. The browser-based authorization request in `LoginScreen.tsx` uses the **Google Web Client ID** (`614054153944-7figt10pghsb14tg764jj3hfnktkqnbt.apps.googleusercontent.com`).
  2. The PKCE authorization code exchange at `https://oauth2.googleapis.com/token` uses the matching Web Client ID and redirect URI.
  3. The backend ID-token validation accepts both the Web Client ID and the Android Client ID in `acceptedAudiences`.
  4. Added non-sensitive stage diagnostics tracing: `BROWSER_PROMPT`, `REDIRECT_CALLBACK`, `CODE_EXCHANGE`, `TOKEN_VALIDATION`, `ORACLE_USER_LOOKUP`, and `JWT_ISSUANCE`.

### 2.2 Biometric Session Restoration & Silent Storage Failures
* **Failure Modes Identified:**
  1. Silent Error Swallowing: `storageService.ts` wrapped `SecureStore.setItemAsync` in a try/catch block that merely logged to `console.error` and returned `undefined`. The caller believed the session was securely saved even when SecureStore threw an exception (e.g. key-store initialization failure or locked keychain).
  2. Cold Launch Purge: `SplashScreen.tsx` called `authService.logout()` if `rememberMe !== 'true'`, wiping valid tokens.
  3. Premature Sensor Prompt: `LoginScreen.tsx` triggered the biometric sensor before verifying whether a session existed, resulting in the message: *"Biometrics verified! Sign in once with password to save your session."*
* **Implemented Architectural Resolution:**
  1. `storageService.setToken`, `setUserData`, and `saveBiometricSession` now throw if writing fails, and perform a read-back verification before returning.
  2. `LoginScreen.tsx` checks `storageService.hasBiometricSession()`, `hasHardwareAsync()`, and `isEnrolledAsync()` before opening the sensor. If no session is saved, it informs the user to log in once with password or Google.
  3. Restored tokens are validated live via `/api/auth/validate-token` before routing to `MainApp`.
  4. User logout (`UserProfileScreen.tsx`) purges both active tokens and biometric session credentials.

### 2.3 Transaction PIN Hardening & Removal of Local PIN Storage
* **Vulnerabilities Resolved:**
  1. Frontend PIN Persistence: Previously, `storageService.ts` persisted `userSecurityPin` in SecureStore, exposing low-entropy PINs to local storage attacks.
  2. Hardcoded Default: `userModel.js` previously accepted `'1234'` for accounts without a PIN.
  3. Truthy Object Bug: `walletFundingService.js` evaluated `!pinResult.valid` incorrectly.
* **Implemented Architectural Resolution:**
  1. Completely deleted `getPin()`, `setPin()`, and `deletePin()` from `storageService.ts`.
  2. Removed `savedPin` from `SecuritySettingsScreen.tsx`. PIN input state is transient only during modal interaction, sent over TLS, and wiped immediately.
  3. Backend hashes PINs using salted `bcrypt` (work factor 10) with automatic legacy SHA-256 upgrade.
  4. 5-attempt progressive lockout enforced for 15 minutes (`PIN_FAILED_ATTEMPTS`, `PIN_LOCKED_UNTIL`).
  5. Transactions $\ge$ LKR 100,000 authoritatively require a verified PIN.

### 2.4 Removal of Obsolete Firebase Remnants
* Deleted obsolete executable methods:
  - `authService.linkLegacyAccount`
  - `userModel.findByFirebaseUid`
  - `userModel.linkFirebaseUid`
  - `firebaseUid` from `req.user` in `authMiddleware.js`
  - `firebaseUid` parameter from `authService.verifyOtp`
* Updated `test-release-gate.js` and `test-otp-flow.js` to eliminate dependencies on deleted Firebase configuration files.

---

## 3. Google Cloud Console Configuration Guide

To ensure zero mismatch in Google Cloud Console, verify the following configuration:

1. **OAuth Consent Screen:**
   - User Type: **External**
   - Application Name: `SmartLanka Trade`
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - Publishing Status: **Testing** (Add tester Gmail accounts under Test Users) or **In Production**

2. **Web Application OAuth Client ID:**
   - Client ID: `614054153944-7figt10pghsb14tg764jj3hfnktkqnbt.apps.googleusercontent.com`
   - Authorized Redirect URIs:
     - `https://smart-lanka-trade-final.onrender.com/api/auth/google/callback`
     - `https://auth.expo.io/@michael_clerans/SmartLankaTrade` (if using Expo Proxy)

3. **Android OAuth Client ID:**
   - Client ID: `614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15.apps.googleusercontent.com`
   - Package Name: `com.michael_clerans.SmartLankaTrade`
   - SHA-1 Fingerprint: Debug and Production keystore fingerprints (from `eas credentials`).

---

## 4. Summary of Modified Files

| Component | File Path | Summary of Modifications |
|---|---|---|
| Frontend | `Frontend/src/services/storageService.ts` | Propagates write failures, verifies session write integrity, and deletes raw PIN persistence |
| Frontend | `Frontend/src/screens/profile/SecuritySettingsScreen.tsx` | Removed local PIN storage; PIN input is strictly transient; facial hardware check enforced |
| Frontend | `Frontend/src/screens/auth/LoginScreen.tsx` | Uses Web Client ID for browser PKCE; adds stage diagnostics; pre-checks session before biometrics |
| Backend | `Backend/services/authService.js` | Removed `linkLegacyAccount`; updated `googleLoginUser` diagnostics and client ID selection |
| Backend | `Backend/controllers/authController.js` | Passes `clientId` to auth service; adds stage error logging without leaking secrets |
| Backend | `Backend/models/userModel.js` | Removed obsolete `findByFirebaseUid` and `linkFirebaseUid`; salted bcrypt PIN verification |
| Backend | `Backend/middleware/authMiddleware.js` | Removed `firebaseUid` from `req.user` payload |
| Backend | `Backend/test-release-gate.js` | Updated release gate tests to validate JWT, Google OAuth, and RBAC without Firebase |
| Backend | `Backend/test-otp-flow.js` | Removed check for deleted `firebase.ts`; validates Brevo email OTP |

---

## 5. Remaining Risks & Operational Notes

1. **Google Cloud Publishing Status:** If in "Testing" mode, only Gmail accounts explicitly listed under "Test Users" can sign in.
2. **EAS Keystore SHA-1:** The release keystore fingerprint must match the Android Client ID in Google Cloud Console.
3. **Oracle Wallet:** Local testing uses offline mocks for Autonomous DB; production runs on high-availability Oracle Cloud connection pooling.
