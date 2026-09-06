# Target API Architecture Specification

---

## 1. REST API Contract & Endpoints

### 1.1 Authentication & Profile (`/api/auth`)
* `POST /api/auth/register` — Body: `{ name, email, password }` -> Returns: `{ success, message, userId }` (No OTP in body)
* `POST /api/auth/verify-otp` — Body: `{ email, otp }` -> Returns: `{ success, message, token, user }`
* `POST /api/auth/login` — Body: `{ email, password }` -> Returns: `{ success, token, user: { id, email, role, kyc_status } }`
* `POST /api/auth/google` — Body: `{ idToken }` -> Returns: `{ success, token, user }`
* `POST /api/auth/forgot-password` — Body: `{ email }` -> Returns: `{ success, message }`
* `POST /api/auth/reset-password` — Body: `{ token, newPassword }` -> Returns: `{ success, message }`
* `GET /api/auth/me` — Headers: `Authorization: Bearer <token>` -> Returns: `{ success, user }`

### 1.2 Market Data (`/api/market`)
* `GET /api/market/prices` — Returns: `{ success, data: { prices: [...] } }`
* `GET /api/market/quote/:symbol` — Returns: `{ success, data: { symbol, priceLKR, changePercent, ... } }`
* `GET /api/market/forex` — Returns: `{ success, data: { rates: { USD_LKR: 310.50 } } }`
* `GET /api/market/status` — Returns: `{ success, data: { exchange: "CSE", isOpen: boolean } }`
* `GET /api/market/candles/:symbol?period=1D` — Returns: `{ success, data: { candles: [...], sparkline: [...] } }`

### 1.3 Trading & Orders (`/api/trade`)
* `POST /api/trade/buy` — Headers: `Bearer <token>`, Body: `{ symbol, amountLKR }` -> Returns: `{ success, order: { orderId, quantity, price, amount } }`
* `POST /api/trade/sell` — Headers: `Bearer <token>`, Body: `{ symbol, quantity }` -> Returns: `{ success, order: { orderId, quantity, price, amount } }`

### 1.4 Portfolio & Wallet (`/api/portfolio`, `/api/wallet`)
* `GET /api/portfolio` — Returns: `{ success, data: { summary: { availableCash, totalPortfolioValue, unrealizedProfitLoss, todaysProfit, profitLossPercent }, holdings: [...] } }`
* `GET /api/wallet/details` — Returns: `{ success, data: { availableBalance, balanceLKR, usdBalance } }`
* `POST /api/wallet/deposit` — Body: `{ amount }` -> Returns: `{ success, newBalance }`
* `POST /api/wallet/withdraw` — Body: `{ amount, bankName, accountNumber }` -> Returns: `{ success, message }`
* `POST /api/wallet/convert` — Body: `{ fromCurrency, toCurrency, amount }` -> Returns: `{ success, data: { convertedAmount, exchangeRate } }`

### 1.5 AI & NLP Analytics (`/api/ai`)
* `GET /api/ai/insights` — Returns: `{ success, data: [...] }`
* `GET /api/ai/prediction/:symbol` — Returns: `{ success, data: { symbol, predictedPrice, confidenceScore, model, metrics: { mae, rmse, mape } } }`
* `GET /api/ai/sentiment` — Returns: `{ success, data: { overallSentiment, bullishPercent, articlesCount, articles: [...] } }`
* `GET /api/ai/evaluation` — Returns: `{ success, models: { ARIMA_TIME_SERIES, LSTM_NEURAL_NET, RANDOM_FOREST } }`
* `POST /api/ai/chat` — Body: `{ message, conversationHistory }` -> Returns: `{ success, data: { reply, suggestions } }`

### 1.6 KYC & Identity Verification (`/api/kyc`)
* `POST /api/kyc/verify-nic` — Body: `{ nicNumber, fullName, address }` -> Returns: `{ success, data: { status: 'VERIFIED', extractedDetails: { format, birthYear, dayOfYear, gender } } }`
* `GET /api/kyc/status` — Returns: `{ success, data: { status, tier, document } }`

### 1.7 Admin & Audit (`/api/admin`)
* `GET /api/admin/users` — Headers: `Bearer <admin_token>` -> Returns: `{ success, users: [...] }`
* `GET /api/admin/audit-logs` — Headers: `Bearer <admin_token>` -> Returns: `{ success, logs: [...] }`
* `PUT /api/admin/kyc/:id` — Headers: `Bearer <admin_token>`, Body: `{ status }` -> Returns: `{ success, message }`
