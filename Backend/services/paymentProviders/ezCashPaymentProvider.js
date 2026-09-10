const PaymentProviderInterface = require('./paymentProviderInterface');
const simulatedProvider = require('./simulatedPaymentProvider');

/**
 * eZ Cash Payment Provider (Dialog Axiata mobile money)
 * Requires env: EZCASH_API_KEY, EZCASH_MERCHANT_ID (Future production)
 */
class EzCashPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super();
    this.apiKey = process.env.EZCASH_API_KEY;
    this.merchantId = process.env.EZCASH_MERCHANT_ID;
  }

  get providerName() {
    return 'EZCASH_WALLET';
  }

  async createPayment(paymentData) {
    if (!this.apiKey) {
      return simulatedProvider.createPayment({ ...paymentData, method: 'EZCASH' });
    }
    throw new Error('Real eZ Cash Gateway integration pending merchant credentials.');
  }

  async verifyPayment(verificationData) {
    if (!this.apiKey) {
      return simulatedProvider.verifyPayment(verificationData);
    }
    throw new Error('Real eZ Cash Gateway verification pending merchant credentials.');
  }

  async getPaymentStatus(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.getPaymentStatus(providerReference);
    }
    throw new Error('Real eZ Cash status check pending merchant credentials.');
  }

  async cancelPayment(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.cancelPayment(providerReference);
    }
    throw new Error('Real eZ Cash cancellation pending merchant credentials.');
  }
}

module.exports = new EzCashPaymentProvider();
