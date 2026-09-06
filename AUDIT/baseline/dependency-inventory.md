# Dependency Inventory Baseline

---

## 1. Backend Dependencies (`Backend/package.json`)

| Package | Version | Type | Purpose | Security & Audit Note |
| :--- | :--- | :--- | :--- | :--- |
| `express` | `^5.2.1` | Runtime | HTTP Web Framework | Core API gateway and routing |
| `oracledb` | `^6.10.0` | Runtime | Oracle DB Driver | Enterprise connection pooling & transaction handling |
| `bcryptjs` | `^3.0.3` | Runtime | Cryptographic Hashing | Bcrypt password & OTP verification hashing |
| `jsonwebtoken` | `^9.0.3` | Runtime | Authentication | Signed JWT tokens with RBAC claims |
| `axios` | `^1.15.2` | Runtime | HTTP Client | External news & financial feed fetching |
| `cors` | `^2.8.6` | Runtime | Security | Cross-Origin Resource Sharing control |
| `dotenv` | `^17.4.2` | Runtime | Configuration | Environment variable management |
| `node-cron` | `^4.2.1` | Runtime | Task Scheduler | Background price monitoring & market sync |
| `nodemailer` | `^8.0.5` | Runtime | Email Dispatcher | Secure OTP & password reset mail delivery |
| `mailtrap` | `^4.5.1` | Runtime | Email Sandbox | Development/staging email testing |
| `expo-server-sdk`| `^6.1.0` | Runtime | Push Notifications | Push notification dispatch to mobile clients |
| `nodemon` | `^3.1.14` | DevDependency | Tooling | Development live-reload server |

---

## 2. Frontend Dependencies (`Frontend/package.json`)

| Package | Version | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `expo` | `~55.0.27` | Runtime | Cross-Platform Mobile Framework |
| `react` | `19.2.0` | Runtime | Reactive UI Framework |
| `react-native` | `0.83.6` | Runtime | Native Mobile Runtime |
| `@react-navigation/native` | `^7.1.33` | Runtime | App Navigation Coordination |
| `@react-navigation/stack` | `^7.8.4` | Runtime | Screen Stack Management |
| `@react-navigation/bottom-tabs` | `^7.15.5` | Runtime | Bottom Tab Bar Navigation |
| `@react-native-async-storage/async-storage`| `2.2.0` | Runtime | Client-Side Key-Value Token Storage |
| `axios` | `^1.15.2` | Runtime | REST API Client with Interceptors |
| `react-native-svg` | `15.15.3` | Runtime | Vector Graphics, Donut Charts & Sparklines |
| `victory-native` | `^41.20.2` | Runtime | Financial Charts & Visualizations |
| `@expo/vector-icons` | `^15.0.2` | Runtime | UI Iconography |
| `react-native-safe-area-context` | `~5.6.2` | Runtime | Device Safe Area Insets |
| `react-native-screens` | `~4.23.0` | Runtime | Native Screen Container Optimization |
| `typescript` | `~5.9.2` | DevDependency | Static Type Checking |
