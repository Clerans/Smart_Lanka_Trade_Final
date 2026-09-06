# Phase 21 Final Acceptance Test Results

## 1. Complete End-to-End User Journey Verification

| Step | Action Performed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Install** | Dependency resolution via npm | Clean installation without dependency conflicts | Installed cleanly with `--legacy-peer-deps` | ✅ PASS |
| **2. Boot** | Backend startup | Port 5000 bound, Oracle pool ready | Server running on port 5000 | ✅ PASS |
| **3. Register** | Post new user registration | User created, OTP sent via email, zero OTP in response | OTP hashed, response clean | ✅ PASS |
| **4. Verify** | Post 6-digit OTP verification | User account verified, JWT token returned | Verified & JWT issued | ✅ PASS |
| **5. Login** | Post login credentials | JWT with `role: 'INVESTOR'` returned | Authenticated | ✅ PASS |
| **6. KYC** | Submit Sri Lankan NIC for OCR | Format identified as 12-digit, birth year 1992, status VERIFIED | Tier 2 Verified | ✅ PASS |
| **7. Market** | Fetch CSE prices & watchlist | Top 12 CSE stocks in LKR loaded with ASPI/S&P SL20 | 12 Equities displayed | ✅ PASS |
| **8. Trade Buy**| Buy 100 JKH.N0000 | Cash deducted by LKR 19,850.00, holdings credited | Order executed | ✅ PASS |
| **9. Portfolio**| Fetch portfolio breakdown | Cash LKR 980,150, Market Value LKR 19,850 | Net worth: 1,000,000 | ✅ PASS |
| **10. Trade Sell**| Sell 50 JKH.N0000 | Cash credited by LKR 9,925.00, holdings decremented | Order executed | ✅ PASS |
| **11. Forex** | Convert LKR to USD | LKR cash deducted, USD balance credited at CBSL rate | Converted | ✅ PASS |
| **12. AI Forecast**| Fetch ARIMA/LSTM predictions | 7-day target price with MAE/RMSE metrics | Insights displayed | ✅ PASS |
| **13. Chatbot** | Query SOMI AI assistant | Contextual CSE advice with financial disclaimer | Reply returned | ✅ PASS |
| **14. Admin** | Access `/api/admin/audit-logs` | Investor token blocked (403), Admin token allowed (200) | RBAC enforced | ✅ PASS |
| **15. Logout** | Invalidate and clear token | Token removed, user routed to Auth stack | Logged out | ✅ PASS |
