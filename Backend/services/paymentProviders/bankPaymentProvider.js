const PaymentProviderInterface = require('./paymentProviderInterface');
const simulatedProvider = require('./simulatedPaymentProvider');

/**
 * Bank Payment Provider (CEFTS / Direct Bank Transfer)
 * Requires env: BANK_PAYMENT_API_KEY, BANK_PAYMENT_MERCHANT_ID (Future production)
 */
class BankPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super();
    this.apiKey = process.env.BANK_PAYMENT_API_KEY;
    this.merchantId = process.env.BANK_PAYMENT_MERCHANT_ID;
  }

  get providerName() {
    return 'BANK_CEFTS';
  }

  async createPayment(paymentData) {
    if (!this.apiKey) {
      // Graceful fallback to simulation mode when live credentials are not configured
      return simulatedProvider.createPayment({ ...paymentData, method: 'BANK' });
    }
    // Production integration hook
    throw new Error('Real Bank Payment Gateway integration pending merchant credentials.');
  }

  async verifyPayment(verificationData) {
    if (!this.apiKey) {
      return simulatedProvider.verifyPayment(verificationData);
    }
    throw new Error('Real Bank Payment Gateway verification pending merchant credentials.');
  }

  async getPaymentStatus(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.getPaymentStatus(providerReference);
    }
    throw new Error('Real Bank Payment Gateway status check pending merchant credentials.');
  }

  async cancelPayment(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.cancelPayment(providerReference);
    }
    throw new Error('Real Bank Payment Gateway cancellation pending merchant credentials.');
  }
}

module.exports = new BankPaymentProvider();
