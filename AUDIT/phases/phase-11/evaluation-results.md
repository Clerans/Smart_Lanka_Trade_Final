# Phase 11 Model Evaluation Benchmark

## 1. Multi-Model Benchmark Metrics

| Model | Target Dataset | MAE | RMSE | MAPE | Directional Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ARIMA (p=5, d=1, q=2)** | 1,500 daily CSE trading sessions | 2.14 | 3.08 | 1.42% | 76.8% |
| **LSTM Recurrent Neural Net** | 2,400 multi-feature sequences | 1.82 | 2.65 | 1.18% | 82.4% |
| **Random Forest Regressor** | 1,500 sessions (Volume + RSI) | 2.45 | 3.40 | 1.65% | 74.2% |
