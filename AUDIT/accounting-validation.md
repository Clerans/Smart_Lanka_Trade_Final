# Accounting & Financial Integrity Validation

---

## 1. Mathematical Formulas & Precision Specifications

### 1.1 Available Cash & Balance
$$\text{Available Cash} = \text{Initial Deposit} + \sum(\text{Sell Proceeds}) - \sum(\text{Buy Purchases}) - \sum(\text{Withdrawals})$$

### 1.2 Holdings Valuation & Cost Basis
$$\text{Total Invested} = \sum(\text{Holding}_i.\text{Quantity} \times \text{Holding}_i.\text{AverageBuyPrice})$$
$$\text{Current Market Valuation} = \sum(\text{Holding}_i.\text{Quantity} \times \text{LivePrice}_i)$$

### 1.3 Profit & Loss (P/L) Metrics
$$\text{Unrealized P/L} = \text{Current Market Valuation} - \text{Total Invested}$$
$$\text{Total Net Worth} = \text{Available Cash} + \text{Current Market Valuation}$$
$$\text{Daily P/L} = \sum\Big(\text{Holding}_i.\text{Quantity} \times (\text{LivePrice}_i - \text{PreviousClosePrice}_i)\Big)$$
$$\text{Return Percentage} = \left(\frac{\text{Unrealized P/L}}{\text{Total Invested}}\right) \times 100\%$$

---

## 2. Transactional Test Scenarios & Results

| Test Scenario | Initial State | Action | Expected Result | Actual Result | Integrity Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Standard Stock Purchase** | LKR 1,000,000 Cash, 0 JKH | Buy 100 JKH @ Rs 205.50 (Rs 20,550) | Cash: LKR 979,450, Holdings: 100 JKH | Cash: LKR 979,450, Holdings: 100 JKH | ✅ PASSED |
| **Insufficient Cash Rejection** | LKR 10,000 Cash | Attempt to buy 100 JKH (Rs 20,550) | HTTP 400 Insufficient Funds | HTTP 400 Insufficient Funds | ✅ PASSED |
| **Fractional Share Rejection** | LKR 1,000,000 Cash | Attempt to buy 2.5 shares | HTTP 400 Integer Shares Required | HTTP 400 Integer Shares Required | ✅ PASSED |
| **Stock Sale & Cash Credit** | 100 JKH, LKR 979,450 Cash | Sell 50 JKH @ Rs 210.00 (Rs 10,500) | Cash: LKR 989,950, Holdings: 50 JKH | Cash: LKR 989,950, Holdings: 50 JKH | ✅ PASSED |
| **Overselling Rejection** | 50 JKH Owned | Attempt to sell 100 JKH | HTTP 400 Insufficient Holdings | HTTP 400 Insufficient Holdings | ✅ PASSED |
| **Currency Conversion** | LKR 310,500, USD 0 | Convert LKR 310,500 @ rate 310.50 | LKR Cash -310,500, USD Balance +1,000.00 | LKR Cash -310,500, USD Balance +1,000.00 | ✅ PASSED |
