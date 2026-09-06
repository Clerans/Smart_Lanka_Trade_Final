# Phase 8 Trading Engine Evidence Package

## 1. Trade Controller Verification
* Implementation in `Backend/services/tradeService.js`:
  ```javascript
  // Whole share lot sizing validation for CSE equities
  const sharePrice = quote.priceLKR;
  const shareQuantity = Math.floor(amountLKR / sharePrice);
  if (shareQuantity <= 0) {
    const err = new Error('Amount is insufficient to purchase a single share lot.');
    err.status = 400;
    throw err;
  }
  ```
