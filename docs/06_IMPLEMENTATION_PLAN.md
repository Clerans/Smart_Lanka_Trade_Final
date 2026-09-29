# DOCUMENT 06 — IMPLEMENTATION PLAN & PRIORITIZED ISSUE REGISTER
## SmartLanka Trade – Phased Engineering Roadmap & Quality Assurance

---

### 1. Prioritized Issue Register

| ID | Issue Description | Location | Severity | Root Cause & Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Missing Pull-to-Refresh on HomeScreen | `HomeScreen.tsx` | **High** | `ScrollView` lacked `RefreshControl` prop. Connect `fetchData()` to native `RefreshControl`. |
| **ISS-02** | Missing Pull-to-Refresh on User Profile | `UserProfileScreen.tsx` | **Medium** | User details & KYC status not refreshable via pull. Connect `loadUserProfile()` to `RefreshControl`. |
| **ISS-03** | Missing Pull-to-Refresh on Security Settings | `SecuritySettingsScreen.tsx` | **Medium** | Preferences & active sessions not refreshable. Add `RefreshControl`. |
| **ISS-04** | Potential Keyboard Overlap on Forgot Password | `ForgotPasswordScreen.tsx` | **Medium** | Form rendered inside a non-scrollable `View`. Wrap in `ScrollView` with `keyboardShouldPersistTaps`. |
| **ISS-05** | OTP Input Horizontal Overflow on Narrow Devices | `OTPVerificationScreen.tsx` | **Medium** | 6 input boxes exceeded 320dp width without responsive sizing. Use dynamic box sizing (`gap: 6`). |
| **ISS-06** | Reset Password Keypad Hardcoded Width | `ResetPasswordScreen.tsx` | **Low** | Custom keypad buttons fixed width. Use responsive screen width percentage. |
| **ISS-07** | Floating Tab Bar Obscuring Bottom Content | Multiple Screens | **Medium** | Bottom content cutoff by floating tab bar. Add `paddingBottom: 96` on all tab screens. |
| **ISS-08** | Inconsistent Spacing Scale across Screens | Multiple Screens | **Low** | Ad-hoc margins used across legacy screens. Standardize with tokens in `spacing.ts` and `responsive.ts`. |
| **ISS-09** | Large LKR Financial Number Wrapping | `HomeScreen.tsx`, `WalletOverviewScreen.tsx` | **Medium** | Large values wrap to two lines on small screens. Add `numberOfLines={1}` and `adjustsFontSizeToFit`. |

---

### 2. Phased Engineering Execution Roadmap

#### Phase 1 — Global Responsive Design System & Design Tokens
- Create `src/theme/responsive.ts` providing scaling helpers (`scale`, `verticalScale`, `moderateScale`, `wp`, `hp`).
- Update `src/theme/spacing.ts` and `src/theme/typography.ts` with standardized spacing tokens and tabular figures.

#### Phase 2 — Main Tab Screens Optimization & Pull-to-Refresh
- **`HomeScreen.tsx`**: Add native `RefreshControl`, tabular financial formatting, tab bar clearance.
- **`MarketWatchScreen.tsx`**: Filter pill spacing, search input alignment, responsive price pills.
- **`TradingTerminalScreen.tsx`**: Keyboard handling, coin picker dropdown responsiveness, buy/sell inputs alignment.
- **`WalletOverviewScreen.tsx`**: Quick action circular button centering, holdings layout, pull-to-refresh sync.
- **`UserProfileScreen.tsx`**: Pull-to-refresh integration, masked details alignment, modal forms keyboard handling.

#### Phase 3 — Detail Screens, AI Screens & Modals Optimization
- **`AssetDetailsScreen.tsx`**: Header back button, Candlestick chart responsive width on layout, stats grid 2-column alignment.
- **`AIAnalyticsScreen.tsx`**: Timeframe filter pills scroll padding, collapsible insight cards, live status pulse dot.
- **`SOMIAIChatScreen.tsx`**: `KeyboardAvoidingView` offsets for iOS/Android, message bubble width constraints (82%).
- **`CurrencyConversionScreen.tsx`**: Input field layout, swap button alignment, CBSL exchange rate status bar.
- **`DemoTradingScreen.tsx`**: Virtual balance card, trade execution forms, confirmation modal.
- **Modals**: `NotificationModal`, `DepositModal`, `WithdrawModal`, `TransferModal` with consistent 52px button heights.

#### Phase 4 — Authentication & Security Screens Optimization
- **`SplashScreen.tsx`**: Progress bar responsive width interpolation, branding layout.
- **`LoginScreen.tsx` & `RegisterScreen.tsx`**: Password toggle icon alignment, strength checklist, Google OAuth and Biometric button spacing.
- **`ForgotPasswordScreen.tsx`**: `ScrollView` wrap inside `KeyboardAvoidingView`.
- **`ResetPasswordScreen.tsx`**: Responsive numeric keypad sizing.
- **`OTPVerificationScreen.tsx`**: Responsive 6-digit OTP input boxes with `gap: 6`.
- **`KYCVerificationScreen.tsx`**: NIC document preview aspect ratio, manual NIC input spacing, OCR result card, pull-to-refresh status.

#### Phase 5 — Quality Assurance, Type Safety & Verification
- Run TypeScript compiler check (`npx tsc --noEmit`).
- Verify live Metro bundler compilation.
- Review all responsive viewports (320px–430px) and safe areas.
