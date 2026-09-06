# Final Test Report & Verification Evidence

**Suite:** `Backend/tests/integration_test_suite.js`  
**Execution Timestamp:** 2026-09-06T13:45:15+05:30  
**Test Runner:** Node.js v24.18.0  

---

## 1. Automated Integration Test Results (25 / 25 Passed)

| Test ID | Test Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Old 9-Digit+V NIC format validation | Returns `isValid: true` | `isValid: true` | ✅ **PASS** |
| **TEST-02** | Old NIC birth year extraction (1992) | Returns `birthYear: 1992` | `birthYear: 1992` | ✅ **PASS** |
| **TEST-03** | Old NIC gender determination (Male) | Returns `gender: 'MALE'` | `gender: 'MALE'` | ✅ **PASS** |
| **TEST-04** | Old NIC Female format validation | Returns `isValid: true` | `isValid: true` | ✅ **PASS** |
| **TEST-05** | Old NIC female gender determination | Returns `gender: 'FEMALE'` | `gender: 'FEMALE'` | ✅ **PASS** |
| **TEST-06** | New 12-Digit NIC format validation | Returns `isValid: true` | `isValid: true` | ✅ **PASS** |
| **TEST-07** | New NIC birth year extraction (1992) | Returns `birthYear: 1992` | `birthYear: 1992` | ✅ **PASS** |
| **TEST-08** | Invalid NIC format rejection | Returns `isValid: false` | `isValid: false` | ✅ **PASS** |
| **TEST-09** | CSE JKH.N0000 real-time LKR price resolution | Returns price > 0 | Price: 205.50 LKR | ✅ **PASS** |
| **TEST-10** | Asset symbol canonicalized as CSE stock ticker| Symbol is `JKH.N0000` | Symbol: `JKH.N0000` | ✅ **PASS** |
| **TEST-11** | Exchange identified as CSE | Exchange is 'CSE' | Exchange: 'CSE' | ✅ **PASS** |
| **TEST-12** | CSE Equities Catalog contains >= 10 stocks | Array length >= 10 | 12 Equities | ✅ **PASS** |
| **TEST-13** | Catalog contains Commercial Bank (COMB.N0000) | Found in catalog | Found | ✅ **PASS** |
| **TEST-14** | CBSL Forex Rates resolution (USD/LKR) | Rate >= 280 LKR | Rate: 310.50 LKR | ✅ **PASS** |
| **TEST-15** | Historical OHLCV 1D candlestick data | 24 candle data points | 24 data points | ✅ **PASS** |
| **TEST-16** | Bcrypt OTP hash and comparison verification | Hashes compare true | Matches | ✅ **PASS** |
| **TEST-17** | JWT contains RBAC role (INVESTOR) | Role decoded as INVESTOR | `role: 'INVESTOR'` | ✅ **PASS** |
| **TEST-18** | JWT contains RBAC role (ADMIN) | Role decoded as ADMIN | `role: 'ADMIN'` | ✅ **PASS** |
| **TEST-19** | AI Forecast generated for JKH.N0000 | Forecast > 0 | Forecast: 211.25 LKR | ✅ **PASS** |
| **TEST-20** | Model architecture specifies ARIMA + LSTM | Contains model name | 'ARIMA + LSTM' | ✅ **PASS** |
| **TEST-21** | NLP Financial News Sentiment dataset | Non-empty array | Array with articles | ✅ **PASS** |
| **TEST-22** | Comprehensive Model Evaluation report | 3 models benchmarked | 3 models present | ✅ **PASS** |
| **TEST-23** | Scientific evaluation metrics present | MAE, RMSE, MAPE > 0 | Valid metrics | ✅ **PASS** |
| **TEST-24** | SOMI AI Copilot contextual response | Non-empty response | Valid guidance | ✅ **PASS** |
| **TEST-25** | Audit log event recorded with fallback safety | Event dispatched safely | Dispatched | ✅ **PASS** |

---

## 2. Summary Statistics

* **Total Tests Executed:** 25
* **Passed:** 25 (100.0%)
* **Failed:** 0 (0.0%)
* **Regression Errors:** 0
