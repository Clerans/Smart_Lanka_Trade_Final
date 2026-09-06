# Phase 8 Trading Engine Test Results

## 1. Trade Execution Test Cases

```text
1. Buy Order: 100 shares JKH.N0000 -> Validated Cash Balance -> Deducted LKR 19,850.00 -> Success [ORDER EXECUTED]
2. Buy Order: 0 shares -> Invalid quantity -> [ORDER REJECTED]
3. Buy Order: Negative LKR amount -> Invalid amount -> [ORDER REJECTED]
4. Buy Order: Value > Available Cash -> Insufficient virtual funds -> [ORDER REJECTED]
5. Sell Order: 50 shares JKH.N0000 (Owned: 100) -> Validated Holdings -> Credited LKR 9,925.00 -> Success [ORDER EXECUTED]
6. Sell Order: 200 shares JKH.N0000 (Owned: 50) -> Insufficient share holdings -> [ORDER REJECTED]
```
