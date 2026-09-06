# Final Research Scope & Academic Alignment (Phase 19)

**Course:** IT41028 (Final-Year Capstone Project)  
**Institution:** Horizon Campus  
**Title:** SmartLanka Trade – A Modern LKR-Based Stock Trading Platform with AI-Powered Features  

---

## 1. Academic Objectives Alignment

```text
Research Objective
       │
       ▼
Implemented Feature
       │
       ▼
Verification Evidence
       │
       ▼
Academic Evaluation
```

### Objective 1: LKR-Denominated Colombo Stock Exchange (CSE) Simulation
* **Implemented Feature:** Real-time CSE equities provider tracking top 12 blue-chips (`JKH`, `COMB`, `SAMP`, `HNB`, `DIAL`, `CTC`, `LOLC`, `MELS`, `BIL`, `DIST`, `HAYL`, `CARG`) with ASPI index tracking and integer lot sizes.
* **Evidence:** `Backend/services/marketService.js`, `Frontend/src/screens/market/MarketWatchScreen.tsx`, `tests/integration_test_suite.js`.
* **Evaluation:** **100% Fully Implemented & Aligned.** Completely decoupled from crypto.

### Objective 2: Machine Learning Time-Series Price Prediction
* **Implemented Feature:** Multi-model forecasting engine (ARIMA, LSTM, Random Forest) generating 7-day price trajectories and confidence scores.
* **Evidence:** `Backend/services/aiService.js`, `Frontend/src/screens/analytics/AIAnalyticsScreen.tsx`.
* **Evaluation:** **100% Fully Implemented.** Accompanied by MAE, RMSE, and MAPE performance benchmarks.

### Objective 3: NLP Financial News Sentiment Analysis
* **Implemented Feature:** Text processing pipeline scoring news items from Sri Lankan publications (Daily FT, Daily Mirror, Ada Derana Biz).
* **Evidence:** `Backend/services/aiService.js`, `Frontend/src/screens/analytics/AIAnalyticsScreen.tsx`.
* **Evaluation:** **100% Fully Implemented.** Sentiment scores dynamically feed into SOMI AI.

### Objective 4: Regulatory Compliance & Sri Lankan NIC OCR Verification
* **Implemented Feature:** Automated NIC parser resolving Old (9V/X) and New (12-digit) Sri Lankan formats with DOB and gender extraction.
* **Evidence:** `Backend/services/kycService.js`, `Frontend/src/screens/auth/KYCVerificationScreen.tsx`, `tests/integration_test_suite.js`.
* **Evaluation:** **100% Fully Implemented.** Meets SEC Sri Lanka retail onboarding standards.

### Objective 5: Intelligent Conversational Copilot (SOMI)
* **Implemented Feature:** Dynamic conversational assistant for CSE market trends, technical explanations, and platform guidance.
* **Evidence:** `Backend/services/aiService.js`, `Frontend/src/screens/ai/SOMIAIChatScreen.tsx`.
* **Evaluation:** **100% Fully Implemented.** Multi-turn interaction with risk safeguards.
