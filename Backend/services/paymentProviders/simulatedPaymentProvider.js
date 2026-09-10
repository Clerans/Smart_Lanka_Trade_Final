const crypto = require('crypto');
const PaymentProviderInterface = require('./paymentProviderInterface');

class SimulatedPaymentProvider extends PaymentProviderInterface {
  get providerName() {
    return 'SIMULATED_DEMO';
  }

  /**
   * Initiate a simulated demo deposit
   */
  async createPayment({ transactionId, userId, amount, currency = 'LKR', method = 'CARD', metadata = {} }) {
    const providerReference = `SLT-SIM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Intentional simulation failure trigger for QA testing if amount is 99999999 or simulateFail flag set
    if (metadata.simulateFail === true) {
      return {
        success: false,
        providerName: this.providerName,
        providerReference,
        status: 'FAILED',
        isSimulation: true,
        failureReason: 'Simulated payment rejection (QA test trigger)'
      };
    }

    return {
      success: true,
      providerName: this.providerName,
      providerReference,
      status: 'PROCESSING',
      isSimulation: true,
      amount,
      currency,
      message: 'Simulated payment intent initialized in Demo mode'
    };
  }

  /**
   * Verify simulated payment
   */
  async verifyPayment({ transactionId, providerReference, simulateFailure = false }) {
    if (simulateFailure) {
      return {
        success: false,
        verified: false,
        status: 'FAILED',
        providerName: this.providerName,
        providerReference,
        isSimulation: true,
        failureReason: 'Simulated payment verification failed'
      };
    }

    return {
      success: true,
      verified: true,
      status: 'COMPLETED',
      providerName: this.providerName,
      providerReference: providerReference || `SLT-SIM-VERIFIED-${Date.now()}`,
      isSimulation: true,
      settledAt: new Date().toISOString()
    };
  }

  async getPaymentStatus(providerReference) {
    return {
      status: 'COMPLETED',
      providerName: this.providerName,
      providerReference,
      isSimulation: true
    };
  }

  async cancelPayment(providerReference) {
    return {
      success: true,
      status: 'CANCELLED',
      providerName: this.providerName,
      providerReference,
      isSimulation: true
    };
  }
}

module.exports = new SimulatedPaymentProvider();
