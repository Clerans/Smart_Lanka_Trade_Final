#!/bin/bash
set -e

echo "============================================================"
echo "🚀 SMARTLANKA TRADE — OPTIMIZED SERVER SETUP"
echo "============================================================"

# 1. Add 2GB Swap space (Prevents 1GB RAM Micro VM from running Out of Memory)
echo "💾 Checking / Configuring Swap memory..."
if ! grep -q "/swapfile" /proc/swaps; then
    sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile swap swap defaults 0 0" | sudo tee -a /etc/fstab
    echo "✅ 2GB Swap activated!"
fi

# 2. Clean dnf locks and install Node.js + tools
echo "📦 Installing Node.js & dependencies..."
sudo pkill -9 -f dnf || true
sudo rm -f /var/lib/rpm/.rpm.lock /var/lib/dnf/*.lock || true

# Install nodejs & tools with low-memory options
sudo dnf clean all
sudo dnf install -y --setopt=install_weak_deps=False nodejs npm libaio git

# 3. Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. Configure Linux Firewall
echo "🛡️ Configuring Firewall for ports 5000, 80, 443..."
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --zone=public --add-port=5000/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=80/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=443/tcp --permanent || true
    sudo firewall-cmd --reload || true
fi
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true

# 5. Install App Dependencies
echo "📦 Installing backend packages..."
cd /home/opc/smartlanka-backend
npm install --omit=dev

# 6. Start / Restart backend with PM2
echo "🚀 Starting backend with PM2..."
pm2 delete smartlanka-backend 2>/dev/null || true
pm2 start server.js --name "smartlanka-backend"
pm2 save

echo "============================================================"
echo "🎉 DEPLOYMENT COMPLETE! Server is running on port 5000!"
echo "============================================================"
pm2 status
