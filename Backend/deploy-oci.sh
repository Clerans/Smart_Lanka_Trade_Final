#!/bin/bash
set -e

echo "============================================================"
echo "🚀 SMARTLANKA TRADE — PRODUCTION SERVER DEPLOYMENT (ORACLE LINUX 9)"
echo "============================================================"

# 1. Update system packages
echo "📦 Updating system packages..."
sudo dnf update -y || sudo yum update -y

# 2. Install Node.js 20 & build tools
echo "📦 Installing Node.js 20 and dependencies..."
sudo dnf module enable nodejs:20 -y || sudo dnf install -y nodejs
sudo dnf install -y git curl wget tar unzip libaio gcc-c++ make

# 3. Install PM2 globally
echo "📦 Installing PM2 process manager..."
sudo npm install -g pm2

# 4. Configure Linux Firewall (Firewalld) for Ports 5000, 80, 443
echo "🛡️ Configuring Firewall..."
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --zone=public --add-port=5000/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=80/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=443/tcp --permanent || true
    sudo firewall-cmd --reload || true
fi

# 5. Open iptables if iptables is active
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true

# 6. Create app directory
APP_DIR="/home/opc/smartlanka-backend"
echo "📁 Setting up App Directory at $APP_DIR..."
mkdir -p "$APP_DIR"

echo "============================================================"
echo "✅ Server environment is ready for SmartLanka Trade Backend!"
echo "============================================================"
