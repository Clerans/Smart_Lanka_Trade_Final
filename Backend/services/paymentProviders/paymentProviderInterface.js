/**
 * Payment Provider Interface
 * Base contract for all payment providers in SmartLanka Trade.
 */
class PaymentProviderInterface {
  /**
   * Unique identifier of the provider (e.g., 'SIMULATED', 'BANK_CEFTS', 'CARD_GATEWAY', 'EZCASH', 'JUSTPAY')
   */
  get providerName() {
    throw new Error('getter providerName must be implemented');
  }

  /**
   * Initiate a payment request
   * @param {Object} paymentData { transactionId, userId, amount, currency, method, metadata }
   * @returns {Promise<Object>} { success, providerReference, status, instructions, redirectUrl, demoMode }
   */
  async createPayment(paymentData) {
    throw new Error('createPayment must be implemented');
  }

  /**
   * Verify an incoming payment result / webhook
   * @param {Object} verificationData { transactionId, providerReference, signature, payload }
   * @returns {Promise<Object>} { success, verified, status, providerReference, failureReason }
   */
  async verifyPayment(verificationData) {
    throw new Error('verifyPayment must be implemented');
  }

  /**
   * Query status from the provider
   * @param {string} providerReference
   * @returns {Promise<Object>} { status, settledAt }
   */
  async getPaymentStatus(providerReference) {
    throw new Error('getPaymentStatus must be implemented');
  }

  /**
   * Cancel an in-flight payment request
   * @param {string} providerReference
   * @returns {Promise<Object>} { success, status }
   */
  async cancelPayment(providerReference) {
    throw new Error('cancelPayment must be implemented');
  }
}

module.exports = PaymentProviderInterface;
