const cron = require('node-cron');
const marketService = require('./marketService');
const alertModel = require('../models/alertModel');
const emailService = require('./emailService');
const notificationService = require('./notificationService');

const startPriceMonitor = () => {
  console.log('🚀 Price Monitor Service Started for CSE Stock Market (Running every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const activeAlerts = await alertModel.getActiveAlerts();
      if (!activeAlerts || activeAlerts.length === 0) return;

      const quotes = await marketService.getAllStockQuotes();
      const priceMap = {};
      quotes.forEach(q => {
        priceMap[q.symbol] = q.priceLKR;
      });

      for (const alert of activeAlerts) {
        const currentPrice = priceMap[alert.SYMBOL];
        if (!currentPrice) continue;

        let triggered = false;
        if (alert.ALERT_TYPE === 'ABOVE' && currentPrice >= alert.TARGET_PRICE) {
          triggered = true;
        } else if (alert.ALERT_TYPE === 'BELOW' && currentPrice <= alert.TARGET_PRICE) {
          triggered = true;
        }

        if (triggered) {
          console.log(`🔔 CSE STOCK ALERT TRIGGERED: ${alert.SYMBOL} target=${alert.TARGET_PRICE}, current=${currentPrice}`);

          // 1. Mark as triggered immediately to prevent duplicate runs
          await alertModel.markAlertTriggered(alert.ID);

          // 2. Send Email
          if (alert.EMAIL) {
            await emailService.sendPriceAlertEmail(
              alert.EMAIL, 
              alert.SYMBOL, 
              alert.TARGET_PRICE, 
              currentPrice, 
              alert.ALERT_TYPE
            );
          }

          // 3. Send Push Notification
          if (alert.EXPO_PUSH_TOKEN) {
            await notificationService.sendPushNotification(
              alert.EXPO_PUSH_TOKEN,
              '📈 CSE Price Alert Triggered!',
              `${alert.SYMBOL} has reached your target of LKR ${alert.TARGET_PRICE}. Current price: LKR ${currentPrice.toFixed(2)}`,
              { symbol: alert.SYMBOL, price: currentPrice }
            );
          }
        }
      }
    } catch (err) {
      console.error('❌ Price Monitor Error:', err.message);
    }
  });
};

module.exports = { startPriceMonitor };
