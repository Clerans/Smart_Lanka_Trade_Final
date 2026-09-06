# Phase 16 UI-to-API Matrix

| Screen Component | API Service Call | Loading State | Error State | Success Navigation |
| :--- | :--- | :--- | :--- | :--- |
| `CurrencyConversionScreen.tsx` | `walletService.convertCurrency` | ActivityIndicator | Alert Dialog | Balance refreshed |
| `TradingTerminalScreen.tsx` | `tradeService.buy`, `tradeService.sell` | Confirm Modal Spinner | Toast / Network Error | Order recorded |
| `SOMIAIChatScreen.tsx` | `aiService.sendChatMessage` | Typing Indicator | Fallback message | Chat updated |
| `KYCVerificationScreen.tsx` | `kycService.verifyNic` | Button Spinner | Validation Alert | `MainApp` Routing |
| `MarketWatchScreen.tsx` | `marketService.getAllPricesLKR` | Pull-to-Refresh | Empty state | `TradingTerminal` Routing |
| `HomeScreen.tsx` | `portfolioService.getPortfolio` | Skeleton / Spinner | Retry state | Deep links active |
| `WalletOverviewScreen.tsx` | `walletService.withdrawMoney` | Modal Button Spinner | Alert Dialog | Ledger refreshed |
