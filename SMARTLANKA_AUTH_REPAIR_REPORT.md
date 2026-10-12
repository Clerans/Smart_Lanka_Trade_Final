# SMARTLANKA TRADE — AUTHENTICATION & SECURITY REPAIR REPORT

**System Version:** SmartLanka Trade v2.4 (Enterprise Edition)  
**Date:** October 12, 2026  
**Auditor / Engineering Role:** Senior React Native/Expo Engineer, Node.js Backend Engineer, OAuth 2.0/OIDC Specialist, Oracle DB Engineer & Application Security Engineer  

---

## 1. Executive Summary

A comprehensive, zero-shortcut audit and repair of the authentication, biometric session restoration, and financial transaction security systems was executed across the **SmartLanka Trade** platform (`Frontend/` and `Backend/`). 

### Core Deficiencies Addressed:
1. **Google OAuth 2.0 Error 400 (`invalid_request` / `Access blocked`):** Fixed legacy implicit-grant misconfiguration (`Google.useIdTokenAuthRequest`) with non-standard scheme (`smartlankatrade:/`) by upgrading to RFC 7636 Authorization Code Flow with PKCE and the Google-compliant reverse client ID redirect scheme.
2. **Biometric Premature Prompt & Session Amnesia:** Corrected `SplashScreen.tsx` token purging bug and `LoginScreen.tsx` inverted biometric flow where the fingerprint sensor was engaged prior to verifying whether saved session credentials existed.
3. **Insecure PIN Fallbacks & Bypass Vulnerability:** Removed hardcoded `'1234'` fallback in `userModel.js`, upgraded low-entropy PIN storage to salted `bcrypt` with automatic legacy SHA-256 migration, implemented 5-attempt rate-limiting with 15-minute lockout, and fixed the truthy object bug in `walletFundingService.js` that previously allowed high-value transactions without PIN authorization.
4. **Hardware-Aware Biometrics & Server-Enforced Settings:** Enforced real device biometric capability detection (handling devices lacking facial recognition hardware) and wired `SecuritySettingsScreen.tsx` to authoritatively synchronize with the Oracle backend.

---

## 2. Root Cause Analysis

### 2.1 Google OAuth 2.0 Failure (`Error 400: invalid_request`)
* **Root Cause:** 
  The frontend was previously using `Google.useIdTokenAuthRequest` which requested `response_type=id_token` (Implicit Flow) targeting the Android OAuth Client ID (`614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15.apps.googleusercontent.com`) with redirect URI `smartlankatrade:/`.
* **Google Policy Violation:**
  Google Cloud OAuth 2.0 has deprecated the implicit grant flow for native mobile applications and strictly prohibits arbitrary custom URL schemes for Android client IDs. Google expects the reverse client ID scheme:
  ```
  com.googleusercontent.apps.614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15:/oauth2redirect
  ```
  Requesting an ID token directly over a browser redirect with an unrecognized scheme caused Google's authorization endpoint to return:
  `"Access blocked: Authorization Error"` and `"Error 400: invalid_request"`.

### 2.2 Biometric Session Restoration & "Sign In Once" Warning
* **Root Cause 1 (`SplashScreen.tsx`):**
  On application cold start, `SplashScreen.tsx` executed:
  ```typescript
  if (rememberMe !== 'true') {
    await authService.logout(); // Purged token from SecureStore!
  }
  ```
  Because `rememberMe` was not set to `'true'` during normal logins, every app launch silently cleared SecureStore credentials before the user ever reached the login screen.
* **Root Cause 2 (`LoginScreen.tsx`):**
  The Biometric button directly invoked `LocalAuthentication.authenticateAsync()` *before* checking if any token was saved in SecureStore. When the user successfully scanned their fingerprint, the code checked `storageService.getToken()` and, finding `null`, displayed:
  `"Biometrics verified! Sign in once with password to save your session."`
* **Root Cause 3 (Token Validation):**
  Restored sessions were navigating to `MainApp` without verifying the token against the backend (`/api/auth/validate-token`). Expired tokens resulted in broken dashboard screens.

### 2.3 PIN Security Vulnerabilities & Financial Bypass
* **Hardcoded Default PIN:**
  `userModel.js` contained:
  ```javascript
  if (!row || !row.PIN_HASH) return String(plainPin).trim() === '1234';
  ```
  Any user who had not configured a PIN could authorize high-value transactions with the default PIN `'1234'`.
* **Truthy Object Evaluation Bug:**
  `walletFundingService.js` executed:
  ```javascript
  const isPinValid = await userModel.verifyPin(userId, pin);
  if (!isPinValid) { ... }
  ```
  Because `verifyPin` returned an object `{ valid: false, message: '...' }`, JavaScript evaluated this object as truthy! Consequently, invalid PINs were accepted as valid for transactions exceeding LKR 100,000.
* **Low Entropy Hashing:**
  Plain SHA-256 without salting was used, making 4-digit PINs vulnerable to rainbow table precomputation.

---

## 3. Implemented Solutions

### 3.1 Google OAuth 2.0 (PKCE & Backend Validation)
* **Mobile Frontend (`LoginScreen.tsx`):**
  - Migrated from `Google.useIdTokenAuthRequest` to `Google.useAuthRequest` configured with PKCE (`code_challenge_method=S256`) and `response_type=code`.
  - Configured redirect URI:
    `com.googleusercontent.apps.614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15:/oauth2redirect`
  - Registered the reverse client ID custom scheme in `Frontend/app.json`.
* **Backend Validation (`authService.js`):**
  - Added support for PKCE authorization code exchange via Google's token endpoint:
    `https://oauth2.googleapis.com/token`.
  - Securely validates Google tokens using `google-auth-library` (`OAuth2Client.verifyIdToken`).
  - Verifies:
    1. Issuer: `https://accounts.google.com` or `accounts.google.com`.
    2. Audience: Verified against both Web Client ID (`614054153944-7figt10pghsbfsm7l30o76r98eou6pbb`) and Android Client ID (`614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15`).
    3. Expiry: Checked against current epoch time.
    4. Verified Email: Requires `payload.email_verified === true`.
  - Safely auto-provisions or links Oracle user accounts in `SL_USERS` and automatically initializes `WALLETS`.
  - Issues SmartLanka Trade's own signed JWT.

### 3.2 Biometric Session Restoration Lifecycle
* **Session Persistence (`storageService.ts`):**
  - Added dedicated hardware SecureStore methods: `saveBiometricSession`, `getBiometricSession`, `hasBiometricSession`, `clearBiometricSession`.
* **Clean Cold Boot (`SplashScreen.tsx`):**
  - Removed destructive `authService.logout()` call. Tokens persist across app launches.
* **Pre-Flight Hardware & Session Verification (`LoginScreen.tsx`):**
  - Checks `storageService.hasBiometricSession()`, `hasHardwareAsync()`, and `isEnrolledAsync()` *prior* to prompting the sensor.
  - If no session exists, instructs the user to sign in once with password/Google.
  - Once fingerprint/face is verified, retrieves token, authoritatively verifies it via `/api/auth/validate-token`, and navigates to `MainApp`.
* **Logout Clearance (`UserProfileScreen.tsx` & `storageService.ts`):**
  - Explicit logout wipes both active tokens and saved biometric credentials, preventing unauthorized biometric session restoration.

### 3.3 PIN Security Hardening & Authorization
* **Oracle Database Migration (`Backend/migrate-v7-security-pin.js` & `schema.sql`):**
  - Added `PIN_HASH VARCHAR2(255)`, `TWO_FACTOR_ENABLED NUMBER(1) DEFAULT 0`, `PIN_FAILED_ATTEMPTS NUMBER DEFAULT 0`, and `PIN_LOCKED_UNTIL TIMESTAMP` to `SL_USERS`.
* **Bcrypt & Legacy Migration (`userModel.js`):**
  - Stored PINs use salted `bcrypt` (work factor 10).
  - Automatically identifies 64-character hex strings (legacy SHA-256) upon first login and upgrades them transparently to bcrypt.
* **Progressive Lockout Rate-Limiting:**
  - 5 consecutive failed attempts lock PIN verification for 15 minutes.
* **Financial Threshold Enforcement (`walletFundingService.js`):**
  - Authoritatively checks `amount >= 100000` LKR for both `executeInternalTransfer` and `requestWithdrawal`.
  - Evaluates `!pinResult.valid` properly.
  - Rejects missing PIN with `HIGH_VALUE_PIN_REQUIRED` (422).
  - Rejects users without configured PIN with `PIN_SETUP_REQUIRED` (422).
  - Enforces lockout with HTTP 403.
* **PIN Change Authorization (`authController.js`):**
  - Requires `currentPin` validation before allowing existing PIN modification.

### 3.4 Hardware-Aware Security Settings (`SecuritySettingsScreen.tsx`)
* Detects hardware capabilities with `LocalAuthentication.supportedAuthenticationTypesAsync()`.
* Disables Facial Recognition toggle if hardware lacks `FACIAL_RECOGNITION`, preventing simulated Face ID.
* Synchronizes 2FA and transaction PIN status authoritatively with the backend.

---

## 4. Google Cloud Console Configuration Guide

To ensure zero runtime mismatch between Google Cloud Console and the SmartLanka Trade application, verify the following settings in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **OAuth Consent Screen:**
   - User Type: **External**
   - App Name: `SmartLanka Trade`
   - User Support Email: Developer/Support email
   - Authorized Domains: `smartlankatrade.com`, `onrender.com`
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - Publishing Status: **Testing** (Ensure tester Gmail accounts are added) or **In Production**

2. **Android OAuth Client ID:**
   - Client ID: `614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15.apps.googleusercontent.com`
   - Package Name: `com.smartlankatrade.app`
   - SHA-1 Certificate Fingerprint: 
     - Debug keystore SHA-1 (for local Expo development)
     - EAS Production SHA-1 (from `eas credentials`)

3. **Web Application OAuth Client ID:**
   - Client ID: `614054153944-7figt10pghsbfsm7l30o76r98eou6pbb.apps.googleusercontent.com`
   - Authorized Redirect URIs:
     - `https://smart-lanka-trade-final.onrender.com/api/auth/google/callback`
     - `com.googleusercontent.apps.614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15:/oauth2redirect`

---

## 5. Summary of Modified Files

| Component | File Path | Modifications |
|---|---|---|
| Frontend | `Frontend/app.json` | Registered reverse client ID custom scheme for Android browser redirects |
| Frontend | `Frontend/src/services/storageService.ts` | Added hardware-backed biometric session methods & complete logout clearing |
| Frontend | `Frontend/src/services/apiService.ts` | Updated `googleLogin` for PKCE code payload & `updateSecuritySettings` for `currentPin` |
| Frontend | `Frontend/src/screens/splash/SplashScreen.tsx` | Removed destructive `logout()` on app boot |
| Frontend | `Frontend/src/screens/auth/LoginScreen.tsx` | Migrated to `Google.useAuthRequest` (PKCE), pre-checks biometrics before prompt, validates token with backend |
| Frontend | `Frontend/src/screens/profile/SecuritySettingsScreen.tsx` | Added hardware detection, face recognition capability check, server 2FA sync, and bcrypt PIN change |
| Backend | `Backend/schema.sql` | Added `PIN_HASH`, `TWO_FACTOR_ENABLED`, `PIN_FAILED_ATTEMPTS`, `PIN_LOCKED_UNTIL` to `SL_USERS` |
| Backend | `Backend/migrate-v7-security-pin.js` | Database migration script for Oracle table column additions |
| Backend | `Backend/models/userModel.js` | Removed `'1234'` fallback, added bcrypt hashing, legacy SHA-256 upgrade, 5-attempt lockout |
| Backend | `Backend/controllers/authController.js` | Updated `googleLogin`, `updateSecuritySettings` (current PIN check), and `verifyPin` (401/403 responses) |
| Backend | `Backend/services/authService.js` | Added PKCE code exchange with Google, ID token verification, and Oracle user provisioning |
| Backend | `Backend/services/walletFundingService.js` | Fixed high-value transaction check (`amount >= 100000`), object truthy bug, and PIN requirements |
| Backend | `Backend/routes/authRoutes.js` | Added rate-limiting (`authLimiter`) to `/google-login`, `/login`, and `/verify-pin` |
| Backend | `Backend/test-security-lifecycle.js` | 25 automated unit tests for Phase 8 security verification |
| Backend | `Backend/test-google-oauth.js` | 19 automated tests for Google OAuth verification |
| Backend | `Backend/scripts/run-all-tests.js` | 50 comprehensive backend automated tests across 8 suites |

---

## 6. Remaining Risks & Operational Notes

1. **Google Cloud Publishing Status:**
   If the OAuth Consent Screen is in "Testing" mode, only Gmail accounts explicitly listed under "Test Users" in Google Cloud Console can sign in. Ensure live testers are added or the app is published.
2. **EAS Keystore SHA-1 Fingerprint:**
   When building a standalone APK/AAB via `eas build`, ensure the release keystore's SHA-1 fingerprint matches the Android Client ID in Google Cloud Console.
3. **Oracle Cloud Wallet:**
   Local testing uses graceful offline fallback because `/etc/secrets/tnsnames.ora` is specific to the Render production environment. In production, the Oracle connection pool operates with high availability.
