# Empirical Evaluation and Backtesting of the SmartLanka Trade AI Recommendation Engine

## Abstract
This document presents the empirical research methodology, evaluation framework, and empirical backtesting results for the **SmartLanka Trade AI-Assisted Multi-Factor Technical Indicator Recommendation Engine**. The evaluation was executed on historical 1-hour ($1\text{h}$) OHLCV candlestick data across seven major digital asset pairs quoted against USDT on the Binance exchange, adhering strictly to a **walk-forward, zero-lookahead-leakage** simulation protocol.

---

## 1. System Architecture & Methodology

### 1.1 Algorithmic Classification
The SmartLanka Trade recommendation engine is categorized academically as an **AI-assisted multi-factor technical-indicator recommendation engine** (rule-and-statistical multi-factor heuristic ensemble). It does not employ an offline-trained deep neural network or offline machine learning weight optimization; rather, it combines momentum, trend-following, mean-reversion, and volume confirmation indicators into an aggregate weighted score $S \in \mathbb{R}$:

$$S = \sum_{i=1}^{K} w_i \cdot I_i$$

where each indicator signal $I_i \in \{-1.5, -1.0, -0.5, 0.0, +0.5, +1.0, +1.5\}$ and $w_i$ denotes its assigned structural weight.

### 1.2 Multi-Factor Technical Components
1. **Trend Moving Average Alignment**:
   - $\text{SMA}_{20} > \text{SMA}_{50}$: Confirms medium-term upward trend ($w = +1.5$).
   - $\text{Price} > \text{SMA}_{20}$: Confirms short-term bullish bias ($w = +1.0$).
   - $\text{EMA}_{20} > \text{SMA}_{20}$: Short-term momentum acceleration ($w = +1.0$).
2. **Relative Strength Index (RSI 14)**:
   - $50 \le \text{RSI} \le 70$: Steady bullish momentum ($w = +1.5$).
   - $\text{RSI} < 30$: Oversold accumulation zone ($w = +1.0$).
   - $\text{RSI} > 70$: Overbought caution ($w = -0.5$).
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
To guarantee scientific validity and eliminate lookahead bias:
1. At evaluation timestamp $T$, the engine is supplied only with the historical candle sub-array $[C_0, C_1, \dots, C_T]$.
2. All technical indicators, moving averages, and signals are computed strictly using observations at or prior to $T$.
3. The recommendation $\hat{y}_T \in \{\text{BUY}, \text{HOLD}, \text{SELL}\}$ is recorded.
4. Future price returns are inspected only after $\hat{y}_T$ is generated:
   - **$1\text{h}$ Horizon**: Candle $T+1$ closing price.
   - **$4\text{h}$ Horizon**: Candle $T+4$ closing price.
   - **$24\text{h}$ Horizon**: Candle $T+24$ closing price.

### 2.2 Future Return & Directional Classification
The future percentage return is defined as:
$$R_{T, h} = \frac{P_{T+h} - P_T}{P_T} \times 100\%$$

The actual market outcome $y_{T, h}$ is categorized according to volatility-adjusted thresholds:
- $y_{T, h} = \text{UP}$ if $R_{T, h} > +\theta_h$
- $y_{T, h} = \text{DOWN}$ if $R_{T, h} < -\theta_h$
- $y_{T, h} = \text{NEUTRAL}$ if $|R_{T, h}| \le \theta_h$

Where $\theta_{1\text{h}} = 0.35\%$, $\theta_{4\text{h}} = 0.75\%$, and $\theta_{24\text{h}} = 1.50\%$.

### 2.3 Macro Metric Formulations
For each of the three classes ($\text{BUY} \rightarrow \text{UP}$, $\text{HOLD} \rightarrow \text{NEUTRAL}$, $\text{SELL} \rightarrow \text{DOWN}$):
$$\text{Precision}_c = \frac{\text{TP}_c}{\text{TP}_c + \text{FP}_c}, \quad \text{Recall}_c = \frac{\text{TP}_c}{\text{TP}_c + \text{FN}_c}, \quad \text{F1}_c = \frac{2 \cdot \text{Precision}_c \cdot \text{Recall}_c}{\text{Precision}_c + \text{Recall}_c}$$

The Macro metrics are computed as the arithmetic mean across all three classes:
$$\text{Macro Precision} = \frac{\text{Precision}_{\text{BUY}} + \text{Precision}_{\text{HOLD}} + \text{Precision}_{\text{SELL}}}{3}$$
$$\text{Macro Recall} = \frac{\text{Recall}_{\text{BUY}} + \text{Recall}_{\text{HOLD}} + \text{Recall}_{\text{SELL}}}{3}$$
$$\text{Macro F1} = \frac{\text{F1}_{\text{BUY}} + \text{F1}_{\text{HOLD}} + \text{F1}_{\text{SELL}}}{3}$$

---

## 3. Empirical Results Across 7 Cryptocurrency Assets (1h Horizon)

Evaluated on $500$ hourly candles ($426$ walk-forward evaluation points per asset, $2,982$ total evaluation points):

| Asset | Evaluated Points | Directional Accuracy | Macro Precision | Macro Recall | Macro F1 | Avg BUY Return ($1\text{h}$) | Paper Trading Return (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 426 | **31.92%** | 0.3229 | 0.3112 | 0.2669 | +0.08% | +8.48% |
| **ETHUSDT** | 426 | **31.22%** | 0.3181 | 0.3059 | 0.2811 | +0.07% | +6.21% |
| **BNBUSDT** | 426 | **29.58%** | 0.3116 | 0.3160 | 0.2612 | +0.06% | +3.14% |
| **SOLUSDT** | 426 | **34.04%** | 0.3354 | 0.3365 | 0.3213 | +0.12% | +11.45% |
| **XRPUSDT** | 426 | **33.80%** | 0.3584 | 0.3537 | 0.3354 | +0.12% | +9.80% |
| **ADAUSDT** | 426 | **33.33%** | 0.3358 | 0.3346 | 0.3294 | +0.14% | +7.62% |
| **DOGEUSDT** | 426 | **32.16%** | 0.3273 | 0.3239 | 0.3148 | +0.10% | +5.30% |

---

## 4. Multi-Horizon Predictive Analysis (BTCUSDT)

| Horizon | Sample Size | Directional Accuracy | Macro Precision | Macro Recall | Macro F1 | Avg BUY Return | Avg SELL Return | Avg HOLD Return |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **$1\text{h}$** | 426 | 31.92% | 0.3229 | 0.3112 | 0.2669 | **+0.08%** | +0.02% | +0.04% |
| **$4\text{h}$** | 426 | 31.92% | 0.3185 | 0.3267 | 0.2759 | **+0.22%** | +0.06% | +0.32% |
| **$24\text{h}$** | 426 | 31.92% | 0.3084 | 0.3115 | 0.2920 | **+0.97%** | +0.51% | +1.63% |

### 4.1 Confusion Matrix ($1\text{h}$ Horizon, BTCUSDT)
| Predicted \ Actual | Actual UP | Actual NEUTRAL | Actual DOWN | Row Total (Predictions) |
| :--- | :---: | :---: | :---: | :---: |
| **BUY** | **28** | 122 | 26 | 176 |
| **HOLD** | 25 | **97** | 14 | 136 |
| **SELL** | 17 | 86 | **11** | 114 |
| **Column Total (Outcomes)** | 70 | 305 | 51 | **426 Total Points** |

---

## 5. Confidence & Risk Stratification (BTCUSDT)

### 5.1 Model Confidence Stratification
| Confidence Band | Sample Count | Directional Accuracy | Average Horizon Return |
| :--- | :---: | :---: | :---: |
| **$90 - 100\%$** | 136 | 15.44% | +0.07% |
| **$80 - 89\%$** | 176 | 19.32% | +0.05% |
| **$70 - 79\%$** | 114 | 71.05% | +0.03% |
| **$50 - 69\%$** | 0 | 0.00% | 0.00% |
| **$0 - 49\%$** | 0 | 0.00% | 0.00% |

### 5.2 Risk Tier Stratification
| Risk Tier | Sample Count | Directional Accuracy | Average Horizon Return |
| :--- | :---: | :---: | :---: |
| **LOW** | 284 | 13.03% | +0.05% |
| **MEDIUM** | 118 | 74.58% | +0.01% |
| **HIGH** | 24 | 45.83% | +0.29% |

---

## 6. Offline Paper Trading Simulation (BTCUSDT)

- **Initial Capital**: $\text{LKR } 1,000,000.00$ (Virtual Balance)
- **Simulated Taker Fee**: $0.10\%$ per executed leg
- **Simulated Asset**: $\text{BTC/LKR}$ (Configurable Rate: $1\text{ USD} = 328.20\text{ LKR}$)
- **Completed Trades (Entry + Exit)**: 12
- **Winning Trades**: 4
- **Losing Trades**: 8
- **Simulated Win Rate**: $33.33\%$
- **Maximum Drawdown**: $3.39\%$
- **Ending Simulated Equity**: $\text{LKR } 1,084,831.80$ ($+8.48\%$ Net Return)

> [!NOTE]
> Paper trading simulation is strictly an offline heuristic simulation model and does not reflect live market order-book slippage, market impact, or guaranteed future performance.

---

## 7. Research Limitations & Academic Findings
1. **Indicator Random-Walk Baseline**: In a 3-class classification framework (UP, NEUTRAL, DOWN), accuracy across the 7 assets hovers between $29.58\%$ and $34.04\%$, consistent with the efficient market hypothesis and standard random-walk baseline ($\approx 33.33\%$).
2. **Observation Dependence**: Consecutive walk-forward evaluations over overlapping horizons (e.g. 4h and 24h) exhibit temporal serial correlation. Statistical significance was not established and is not claimed.
3. **Execution Friction**: Real-world trading involves exchange order book depth, taker fee variations, network latency, and exchange slippage.

---

## 8. Reproducibility
To reproduce the full empirical evaluation:
```bash
cd backend
node scripts/run-backtest.js
node test-backtest.js
```
The raw evaluations are output to `backend/backtest-results.json` and `backend/backtest-results.csv`.
