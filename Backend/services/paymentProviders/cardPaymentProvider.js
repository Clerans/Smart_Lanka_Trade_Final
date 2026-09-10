const PaymentProviderInterface = require('./paymentProviderInterface');
const simulatedProvider = require('./simulatedPaymentProvider');

/**
 * Card Payment Provider (Visa / Mastercard IPG)
 * Requires env: CARD_PAYMENT_API_KEY, CARD_PAYMENT_MERCHANT_ID (Future production)
 */
class CardPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super();
    this.apiKey = process.env.CARD_PAYMENT_API_KEY;
    this.merchantId = process.env.CARD_PAYMENT_MERCHANT_ID;
  }

  get providerName() {
    return 'CARD_IPG';
  }

  async createPayment(paymentData) {
    if (!this.apiKey) {
      return simulatedProvider.createPayment({ ...paymentData, method: 'CARD' });
    }
    throw new Error('Real Card IPG Gateway integration pending merchant credentials.');
  }

  async verifyPayment(verificationData) {
    if (!this.apiKey) {
      return simulatedProvider.verifyPayment(verificationData);
    }
    throw new Error('Real Card IPG Gateway verification pending merchant credentials.');
  }

  async getPaymentStatus(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.getPaymentStatus(providerReference);
    }
    throw new Error('Real Card IPG status check pending merchant credentials.');
  }

  async cancelPayment(providerReference) {
    if (!this.apiKey) {
      return simulatedProvider.cancelPayment(providerReference);
    }
    throw new Error('Real Card IPG cancellation pending merchant credentials.');
  }
}

module.exports = new CardPaymentProvider();
