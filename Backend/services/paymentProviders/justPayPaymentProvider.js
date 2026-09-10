const PaymentProviderInterface = require('./paymentProviderInterface');
const simulatedProvider = require('./simulatedPaymentProvider');

/**
 * LankaPay JustPay Payment Provider
 * Requires env: JUSTPAY_API_KEY, JUSTPAY_MERCHANT_ID (Future production)
 */
class JustPayPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super();
    this.apiKey = process.env.JUSTPAY_API_KEY;
    this.merchantId = process.env.JUSTPAY_MERCHANT_ID;
  }

  get providerName() {
    return 'JUSTPAY_LANKAPAY';
  }

  async createPayment(paymentData) {
    if (!this.apiKey) {
      return simulatedProvider.createPayment({ ...paymentData, method: 'JUSTPAY' });
    }
    throw new Error('Real JustPay Gateway integration pending merchant credentials.');
  }

  async verifyPayment(verificationData) {
    if (!this.apiKey) {
      return simulatedProvider.verifyPayment(verificationData);
    }
    throw new Error('Real JustPay Gateway verification pending merchant credentials.');
  }

  async getPaymentStatus(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.getPaymentStatus(providerReference);
    }
    throw new Error('Real JustPay status check pending merchant credentials.');
  }

  async cancelPayment(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.cancelPayment(providerReference);
    }
    throw new Error('Real JustPay cancellation pending merchant credentials.');
  }
}

module.exports = new JustPayPaymentProvider();
