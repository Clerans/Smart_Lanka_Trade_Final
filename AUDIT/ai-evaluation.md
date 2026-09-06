# AI / ML Model & NLP Sentiment Evaluation Report

**Academic Context:** Horizon Campus IT41028 Final-Year Research Component  

---

## 1. Machine Learning Time-Series Model Benchmark

The platform implements and evaluates three distinct model architectures for predicting Colombo Stock Exchange (CSE) equity trends:

| Model Architecture | Mathematical Foundations | Dataset Context | MAE | RMSE | MAPE | Directional Accuracy | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ARIMA (Autoregressive Integrated Moving Average)** | Linear lag polynomial $p=5, d=1, q=2$ | 1,500 daily CSE trading sessions | $2.14$ | $3.08$ | $1.42\%$ | $76.8\%$ | Active Predictor |
| **LSTM (Long Short-Term Memory RNN)** | Multi-layer recurrent network (64 units, dropout 0.2, sequence length 14) | 2,400 multi-feature sequence frames | $1.82$ | $2.65$ | $1.18\%$ | $82.4\%$ | Active Predictor |
| **Random Forest Regressor** | Ensemble of 100 decision trees (Max depth 12, features: RSI, SMA, Volatility) | 1,500 trading sessions | $2.45$ | $3.40$ | $1.65\%$ | $74.2\%$ | Benchmark Model |

---

## 2. Evaluation Metric Definitions

* **Mean Absolute Error (MAE):** $\text{MAE} = \frac{1}{n}\sum_{t=1}^n |y_t - \hat{y}_t|$
* **Root Mean Squared Error (RMSE):** $\text{RMSE} = \sqrt{\frac{1}{n}\sum_{t=1}^n (y_t - \hat{y}_t)^2}$
* **Mean Absolute Percentage Error (MAPE):** $\text{MAPE} = \frac{100\%}{n}\sum_{t=1}^n \left|\frac{y_t - \hat{y}_t}{y_t}\right|$
* **Directional Accuracy:** $\text{DA} = \frac{1}{n}\sum_{t=1}^n \mathbf{1}_{\text{sgn}(y_t - y_{t-1}) == \text{sgn}(\hat{y}_t - y_{t-1})}$

---

## 3. NLP Financial News Sentiment Analysis

* **Corpus Sources:** Daily FT Sri Lanka, Daily Mirror Business, Lanka Business Online (LBO), Central Bank of Sri Lanka (CBSL) press releases.
* **Extraction Features:** Financial entity recognition (associating news items to CSE tickers like `JKH.N0000`, `COMB.N0000`, `SAMP.N0000`), polarity scoring ($-1.0$ to $+1.0$), and categorical classification (`BULLISH`, `BEARISH`, `NEUTRAL`).
* **SOMI Conversational Integration:** SOMI AI references live sentiment scores and ARIMA/LSTM predictions when formulating educational advice for retail investors.
