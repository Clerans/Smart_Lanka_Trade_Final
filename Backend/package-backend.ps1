$sourceDir = "c:\Users\micha\OneDrive\Desktop\Personal project\Finall\Smart_Lanka_Trade_Final\Backend"
$walletDir = "C:\oracle\SmartLankaTradeDB\Wallet_SmartLankaTradeDB"
$zipFile = "c:\Users\micha\OneDrive\Desktop\Personal project\Finall\smartlanka-backend.zip"

Write-Host "Packaging SmartLanka Trade Backend with Oracle Wallet..."

if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

$staging = "$env:TEMP\smartlanka-deploy-stage"
if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

# 1. Copy backend source code (excluding node_modules, logs, etc.)
robocopy "$sourceDir" "$staging" /E /XD node_modules .git scratch /XF *.log | Out-Null

# 2. Copy Oracle Cloud Wallet
if (Test-Path $walletDir) {
    $stageWallet = "$staging\wallet"
    New-Item -ItemType Directory -Path $stageWallet -Force | Out-Null
    robocopy "$walletDir" "$stageWallet" /E | Out-Null
    Write-Host "Oracle Wallet files packaged into wallet/"
}

# 3. Create production Linux .env file
$envContent = @'
PORT=5000
BASE_URL=http://140.238.89.49:5000
JWT_SECRET=smartlanka_super_secret_key_2024

# Oracle Database
DB_USER=ADMIN
DB_CONNECT=smartlankatradedb_low
DB_PASSWORD="KrishCl1228@#"
DB_WALLET_PATH=/home/opc/smartlanka-backend/wallet
DB_WALLET_PASSWORD="KrishCl1228@#"

# Email
EMAIL_USER=cleranspc@gmail.com
EMAIL_PASS=gxheezokvkslvhwn
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=cleranspc@gmail.com
SMTP_PASS=gxheezokvkslvhwn
EMAIL_FROM="SMARTLANKA TRADE <cleranspc@gmail.com>"

# Binance API Configuration
BINANCE_API_KEY=c4xJHYQiWgOySOlffsYTTeCh37BwJt7wk5estOwZamK1KxozghzafNlFiq6v6hRm
BINANCE_API_SECRET=uljLJfz9whdodDIOsxDECNCfTTilm9C6x8pRI9K8WVQnomC3mwofaa9kdnmdbKSV
BINANCE_BASE_URL=https://api.binance.com
'@

[System.IO.File]::WriteAllText("$staging\.env", $envContent, [System.Text.Encoding]::UTF8)

# 4. Create one-click Linux setup and launch script
$setupScript = @'
#!/bin/bash
set -e

echo "============================================================"
echo "SMARTLANKA TRADE — AUTOMATED SERVER INSTALLATION"
echo "============================================================"

# 1. Install Node.js 20 & build tools
echo "Installing Node.js 20, NPM, and build tools..."
sudo dnf install -y nodejs npm git gcc-c++ make libaio unzip tar wget curl

# 2. Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# 3. Configure Firewall (open port 5000, 80, 443)
echo "Opening Firewall ports..."
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --zone=public --add-port=5000/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=80/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=443/tcp --permanent || true
    sudo firewall-cmd --reload || true
fi
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true

# 4. Install backend dependencies
echo "Installing NPM packages..."
npm install --omit=dev

# 5. Start with PM2
echo "Starting backend with PM2..."
pm2 delete smartlanka-backend 2>/dev/null || true
pm2 start server.js --name "smartlanka-backend"
pm2 save

echo "============================================================"
echo "DEPLOYMENT COMPLETE! Server is running on port 5000!"
echo "============================================================"
pm2 status
'@

[System.IO.File]::WriteAllText("$staging\run-deploy.sh", $setupScript.Replace("`r`n", "`n"), [System.Text.Encoding]::UTF8)

Compress-Archive -Path "$staging\*" -DestinationPath "$zipFile" -Force
Remove-Item $staging -Recurse -Force

Write-Host "Ready-to-deploy zip created: $zipFile"


