# Empirical Evaluation and Backtesting of the SmartLanka Trade AI Recommendation Engine

## Abstract
This document provides the formal research methodology, empirical evaluation metrics, and backtesting performance analysis for the **SmartLanka Trade AI-Assisted Multi-Factor Technical Indicator Recommendation Engine**. The evaluation was executed on historical hourly ($1\text{h}$) OHLCV candlestick data across seven major digital asset pairs quoted against USDT on the Binance exchange, adhering strictly to a **walk-forward, zero-data-leakage** simulation protocol.

---

## 1. System Architecture & Methodology

### 1.1 Algorithmic Classification
The SmartLanka Trade recommendation engine is an **AI-assisted, multi-factor rule-and-statistical scoring engine**. It combines momentum, trend-following, mean-reversion, and volatility indicators into an aggregate weighted score $S \in \mathbb{R}$:

$$S = \sum_{i=1}^{K} w_i \cdot I_i$$

where each indicator signal $I_i \in \{-1.5, -1.0, -0.5, 0.0, +0.5, +1.0, +1.5\}$ and $w_i$ denotes its assigned structural weight.

### 1.2 Multi-Factor Technical Components
1. **Trend Moving Average Alignment**:
   - $\text{SMA}_{20} > \text{SMA}_{50}$: Confirms medium-term upward trend ($w = +1.5$).
   - $\text{Price} > \text{SMA}_{20}$: Confirms short-term bullish bias ($w = +1.0$).
   - $\text{EMA}_{20} > \text{SMA}_{20}$: Short-term momentum acceleration ($w = +1.0$).
2. **Relative Strength Index (RSI 14)**:
   - $50 \le \text{RSI} \le 70$: Steady bullish momentum ($w = +1.5$).
   - $\text{RSI} < 30$: Deeply oversold accumulation zone ($w = +1.0$).
   - $\text{RSI} > 70$: Overbought warning ($w = -0.5$).
   - $\text{RSI} < 50$: Bearish momentum ($w = -1.5$).
3. **Moving Average Convergence Divergence (MACD 12, 26, 9)**:
   - $\text{MACD Histogram} > 0$: Positive momentum expansion ($w = +1.5$).
   - $\text{MACD Histogram} \le 0$: Negative momentum contraction ($w = -1.5$).
4. **Bollinger Bands ($20, 2\sigma$)**:
   - $\text{Price} < \text{Lower Band}$: Mean-reversion support bounce ($w = +0.5$).
   - $\text{Price} > \text{Upper Band}$: Overextension resistance caution ($w = -0.5$).
5. **Volume Conviction Ratio**:
   - $\text{Volume} > 1.2 \times \text{SMA}_{20}(\text{Volume})$ with positive $24\text{h}$ delta ($w = +1.0$).

### 1.3 Decision Mapping & Model Confidence
- **Action Thresholds**:
  - $\text{BUY}$ if $S \ge +3.0$
  - $\text{SELL}$ if $S \le -3.0$
  - $\text{HOLD}$ otherwise
- **Model Confidence Calculation**:
  $$\text{Confidence} = \text{clamp}\left(45 + \left(\frac{\max(N_{\text{bull}}, N_{\text{bear}})}{N_{\text{total}}} \times 45\right) + \min\left(\frac{|S|}{8}, 1\right) \times 10, 35, 96\right)$$

---

## 2. Zero-Data-Leakage Backtesting Protocol

### 2.1 Chronological Walk-Forward Pipeline
To guarantee complete scientific rigor and eliminate lookahead bias:
1. At timestamp $T$, the engine is passed only the sub-array of historical candles $[C_0, C_1, \dots, C_T]$.
2. All technical indicators, statistical parameters, and signals are computed strictly using data available at or before $T$.
3. The recommendation $\hat{y}_T \in \{\text{BUY}, \text{HOLD}, \text{SELL}\}$ is recorded.
4. Future price returns are inspected only after $\hat{y}_T$ is locked:
   - **$1\text{h}$ Horizon**: Candle $T+1$ closing price.
   - **$4\text{h}$ Horizon**: Candle $T+4$ closing price.
   - **$24\text{h}$ Horizon**: Candle $T+24$ closing price.

### 2.2 Future Return & Directional Classification
The future percentage return is defined as:
$$R_{T, h} = \frac{P_{T+h} - P_T}{P_T} \times 100\%$$

The true market movement $y_{T, h}$ is categorized according to volatility-adjusted thresholds:
- $y_{T, h} = \text{UP}$ if $R_{T, h} > +\theta_h$
- $y_{T, h} = \text{DOWN}$ if $R_{T, h} < -\theta_h$
- $y_{T, h} = \text{NEUTRAL}$ if $|R_{T, h}| \le \theta_h$

Where $\theta_{1\text{h}} = 0.35\%$, $\theta_{4\text{h}} = 0.75\%$, and $\theta_{24\text{h}} = 1.50\%$.

---

## 3. Empirical Results Across 7 Cryptocurrency Assets

Evaluated on $500$ hourly candles ($426$ walk-forward evaluation points per asset):

| Asset | Samples | Accuracy ($1\text{h}$) | Precision | Recall | Macro F1 | Avg BUY Return ($1\text{h}$) | Avg BUY Return ($24\text{h}$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 426 | **31.92%** | 0.3229 | 1.0000 | **0.4882** | +0.08% | **+0.97%** |
| **ETHUSDT** | 426 | **31.22%** | 0.3174 | 1.0000 | **0.4819** | +0.07% | **+0.84%** |
| **BNBUSDT** | 426 | **29.81%** | 0.3130 | 1.0000 | **0.4767** | +0.06% | **+0.79%** |
| **SOLUSDT** | 426 | **34.27%** | 0.3369 | 1.0000 | **0.5040** | +0.12% | **+1.18%** |
| **XRPUSDT** | 426 | **33.57%** | 0.3565 | 1.0000 | **0.5257** | +0.12% | **+1.05%** |
| **ADAUSDT** | 426 | **33.33%** | 0.3358 | 1.0000 | **0.5027** | +0.14% | **+1.22%** |
| **DOGEUSDT** | 426 | **32.16%** | 0.3276 | 1.0000 | **0.4935** | +0.11% | **+1.10%** |

---

## 4. Multi-Horizon Predictive Analysis (BTCUSDT)

| Horizon | Sample Size | Directional Accuracy | Macro Precision | Macro F1 | Avg BUY Return | Avg SELL Return | Avg HOLD Return |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **$1\text{h}$** | 426 | 31.92% | 0.3229 | 0.4882 | **+0.08%** | +0.02% | +0.04% |
| **$4\text{h}$** | 426 | 31.92% | 0.3185 | 0.4831 | **+0.22%** | +0.06% | +0.32% |
| **$24\text{h}$** | 426 | 31.69% | 0.3059 | 0.4685 | **+0.97%** | +0.51% | +1.69% |

### 4.1 Confusion Matrix ($1\text{h}$ Horizon, BTCUSDT)
| Predicted \ Actual | Actual UP | Actual NEUTRAL | Actual DOWN |
| :--- | :---: | :---: | :---: |
| **BUY** | **28** | 122 | 26 |
| **HOLD** | 25 | **97** | 14 |
| **SELL** | 17 | 86 | **11** |

---

## 5. Confidence & Risk Stratification

### 5.1 Model Confidence Stratification
| Confidence Band | Sample Count | Directional Accuracy | Average Horizon Return |
| :--- | :---: | :---: | :---: |
| **$90 - 100\%$** | 118 | **38.14%** | **+0.12%** |
| **$80 - 89\%$** | 142 | 32.39% | +0.06% |
| **$70 - 79\%$** | 96 | 29.17% | +0.04% |
| **$50 - 69\%$** | 70 | 25.71% | +0.01% |

### 5.2 Risk Tier Stratification
| Risk Tier | Sample Count | Directional Accuracy | Volatility Profile |
| :--- | :---: | :---: | :---: |
| **LOW** | 148 | **36.49%** | Controlled, tight ATR |
| **MEDIUM** | 212 | 30.19% | Normal market noise |
| **HIGH** | 66 | 25.76% | Elevated momentum divergence |

---

## 6. Offline Paper Trading Simulation

- **Initial Capital**: $\text{LKR } 1,000,000.00$ (Offline Virtual Capital)
- **Simulated Taker Fee**: $0.10\%$ per executed leg
- **Simulated Asset**: $\text{BTC/LKR}$ over 426 hours
- **Total Executed Trades**: 28
- **Simulated Win Rate**: $57.14\%$
- **Maximum Drawdown**: $4.82\%$
- **Net Simulated Equity**: $\text{LKR } 1,038,420.50$ ($+3.84\%$)

> [!NOTE]
> Paper trading simulation is strictly an offline research model and does not reflect live market execution slippage or guaranteed returns.

---

## 7. Research Limitations & Future Directions
1. **Regime Dependence**: Technical indicator scoring performs with higher accuracy in trending directional regimes than prolonged sideways market compression.
2. **Execution Slippage**: Live high-frequency trading would incur exchange order book spread and taker fee friction.
3. **Future Extension**: Hybridizing the current multi-factor scoring engine with machine learning models (e.g., Random Forest or LSTM recurrent neural networks) trained on multi-timeframe order book features.

---

## 8. Reproducibility
To reproduce the full empirical evaluation:
```bash
cd backend
node scripts/run-backtest.js
node test-backtest.js
```
The raw evaluations are output to `backend/backtest-results.json` and `backend/backtest-results.csv`.
