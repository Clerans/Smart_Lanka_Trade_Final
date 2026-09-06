# Environment & Configuration Baseline

---

## 1. Environment Variables (`Backend/.env`)

| Variable Name | Required | Example / Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `5000` | HTTP port for Express API Gateway |
| `NODE_ENV` | Yes | `development` / `production` | Node execution environment |
| `JWT_SECRET` | Yes | `[256-bit Cryptographic Secret]` | Secret key for signing and verifying JWT tokens |
| `DB_USER` | Yes | `smartlanka_admin` | Oracle database username |
| `DB_PASSWORD` | Yes | `[Encrypted DB Password]` | Oracle database password |
| `DB_CONNECT_STRING` | Yes | `localhost:1521/XEPDB1` | Oracle Easy Connect string / TNS alias |
| `DB_POOL_MIN` | No | `2` | Minimum pooled database connections |
| `DB_POOL_MAX` | No | `10` | Maximum pooled database connections |
| `EMAIL_SERVICE_HOST`| No | `smtp.mailtrap.io` | SMTP Host for OTP & verification emails |
| `EMAIL_SERVICE_PORT`| No | `2525` | SMTP Port |
| `EMAIL_SERVICE_USER`| No | `[Mailtrap User]` | SMTP Username |
| `EMAIL_SERVICE_PASS`| No | `[Mailtrap Pass]` | SMTP Password |
| `EMAIL_FROM` | No | `noreply@smartlanka.lk` | Default outgoing sender address |
| `CORS_ORIGIN` | No | `*` / `exp://*` | Allowed CORS origins |

---

## 2. Platform & Toolchain Baseline

* **Node.js Version:** `v20+` (Validated on Node v24.18.0)
* **Package Manager:** `npm v10+`
* **Operating System:** Cross-platform (Windows / Linux / macOS)
* **Mobile Runtime:** Expo Go SDK 55 or Native Android/iOS Build
* **Database Driver:** `oracledb` Thick/Thin Client Mode
