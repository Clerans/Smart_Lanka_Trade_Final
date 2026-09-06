# Security Audit & Hardening Report

---

## 1. Security Architecture Verification

| Security Control | Implementation Mechanism | Verification Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Password Storage** | Bcrypt hashing (10 salt rounds) | Direct database dump inspection confirms salted hashes | ✅ SECURE |
| **OTP Generation & Storage** | Cryptographically secure random 6-digit integers; stored as bcrypt hashes | `tests/integration_test_suite.js` (Bcrypt OTP verification) | ✅ SECURE |
| **OTP Leakage Prevention** | Controller payloads sanitized; zero OTP returned in response body or stdout logs | Response schema validation tests | ✅ SECURE |
| **Brute Force Protection** | OTP attempt limit (max 5 attempts), 5-minute expiry, rate limiting | OTP throttling unit tests | ✅ SECURE |
| **Role-Based Access Control** | JWT signed with role (`INVESTOR` / `ADMIN`), guarded by `protect` and `adminProtect` | `tests/integration_test_suite.js` (Admin RBAC claims) | ✅ SECURE |
| **OAuth Identity Hardening** | Google login verifies token authenticity against OAuth providers rather than trusting client-provided email | Google authentication security review | ✅ SECURE |
| **Audit Logging** | Centralized `SL_AUDIT_LOGS` table capturing login, trading, KYC, and admin events | `tests/integration_test_suite.js` (Audit log recording) | ✅ SECURE |
| **SQL Injection Defense** | Parameterized bind variables used across all Oracle queries (`:userId`, `:symbol`) | Source code review across all models and repositories | ✅ SECURE |
| **CORS & Headers** | Configured CORS whitelist; security headers enabled | API gateway middleware check | ✅ SECURE |
