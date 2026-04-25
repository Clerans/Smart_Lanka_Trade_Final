const cron = require('node-cron');
const marketService = require('./marketService');
const alertModel = require('../models/alertModel');
const emailService = require('./emailService');
const notificationService = require('./notificationService');

const startPriceMonitor = () => {
  console.log('🚀 Price Monitor Service Started (Running every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const activeAlerts = await alertModel.getActiveAlerts();
      if (activeAlerts.length === 0) return;

      console.log(`🔍 Checking ${activeAlerts.length} active alerts...`);

      // Get unique symbols to minimize API calls
      const symbols = [...new Set(activeAlerts.map(a => a.SYMBOL))];
      
      // Fetch current prices
      const marketData = await marketService.getMultiplePricesInLKR(symbols);
      const currentPrices = {};
      marketData.prices.forEach(p => {
        currentPrices[p.symbol] = p.priceLKR;
      });

      for (const alert of activeAlerts) {
        const currentPrice = currentPrices[alert.SYMBOL];
        if (!currentPrice) continue;

        let triggered = false;
        if (alert.ALERT_TYPE === 'ABOVE' && currentPrice >= alert.TARGET_PRICE) {
          triggered = true;
        } else if (alert.ALERT_TYPE === 'BELOW' && currentPrice <= alert.TARGET_PRICE) {
          triggered = true;
        }

        if (triggered) {
          console.log(`🔔 ALERT TRIGGERED: ${alert.SYMBOL} hit ${alert.TARGET_PRICE} (Current: ${currentPrice})`);
          
          // 1. Send Email
          await emailService.sendPriceAlertEmail(
            alert.EMAIL, 
            alert.SYMBOL, 
            alert.TARGET_PRICE, 
            currentPrice, 
            alert.ALERT_TYPE
          );

          // 2. Send Push Notification
          if (alert.EXPO_PUSH_TOKEN) {
            await notificationService.sendPushNotification(
              alert.EXPO_PUSH_TOKEN,
              '🚀 Price Alert Triggered!',
              `${alert.SYMBOL} has reached your target of ${alert.TARGET_PRICE}. Current price: ${currentPrice.toFixed(2)} LKR`,
              { symbol: alert.SYMBOL, price: currentPrice }
            );
          }

          // 3. Mark as triggered (inactive)
          await alertModel.markAlertTriggered(alert.ID);
        }
      }
    } catch (err) {
      console.error('❌ Price Monitor Error:', err.message);
    }
  });
};

module.exports = { startPriceMonitor };
