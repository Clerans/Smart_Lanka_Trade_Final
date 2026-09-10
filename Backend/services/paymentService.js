const oracledb = require('oracledb');
const bankProvider = require('./paymentProviders/bankPaymentProvider');
const cardProvider = require('./paymentProviders/cardPaymentProvider');
const ezCashProvider = require('./paymentProviders/ezCashPaymentProvider');
const justPayProvider = require('./paymentProviders/justPayPaymentProvider');
const simulatedProvider = require('./paymentProviders/simulatedPaymentProvider');
const userModel = require('../models/userModel');
const { sendPushNotification } = require('./notificationService');

class PaymentService {
  /**
   * Get provider instance for selected payment method
   */
  getProvider(method) {
    const cleanMethod = (method || '').toUpperCase();
    switch (cleanMethod) {
      case 'BANK':
      case 'BANK_ACCOUNT':
        return bankProvider;
      case 'CARD':
      case 'DEBIT_CARD':
      case 'CREDIT_CARD':
        return cardProvider;
      case 'EZCASH':
      case 'EZ_CASH':
        return ezCashProvider;
      case 'JUSTPAY':
      case 'JUST_PAY':
        return justPayProvider;
      case 'SIMULATED':
      case 'SIMULATED_DEMO':
      default:
        return simulatedProvider;
    }
  }

  /**
   * 1. Initiate Deposit:
   * Creates a transaction in PENDING status, calls the payment provider, returns reference.
   */
  async initiateDeposit({ userId, amount, method = 'CARD', idempotencyKey = null, metadata = {} }) {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      const err = new Error('Invalid deposit amount. Amount must be a positive number.');
      err.status = 400;
      throw err;
    }

    const numAmount = parseFloat(amount);
    const provider = this.getProvider(method);

    let connection;
    try {
      connection = await oracledb.getConnection();

      // Idempotency check: if request with same idempotency key exists, return existing
      if (idempotencyKey) {
        const existingTx = await connection.execute(
          `SELECT TRANSACTION_ID, TOTAL_AMOUNT, STATUS, PROVIDER_REF, PAYMENT_METHOD, CREATED_AT 
           FROM TRANSACTIONS 
           WHERE USER_ID = :userId AND IDEMPOTENCY_KEY = :idempotencyKey`,
          { userId, idempotencyKey },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (existingTx.rows.length > 0) {
          const row = existingTx.rows[0];
          return {
            success: true,
            isIdempotentReplay: true,
            transactionId: row.TRANSACTION_ID,
            providerReference: row.PROVIDER_REF,
            amount: parseFloat(row.TOTAL_AMOUNT),
            status: row.STATUS,
            method: row.PAYMENT_METHOD,
            providerName: provider.providerName
          };
        }
      }

      // Step A: Insert PENDING transaction record
      const desc = `Deposit via ${method} (${provider.providerName})`;
      const insertResult = await connection.execute(
        `INSERT INTO TRANSACTIONS (
          USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, 
          STATUS, PAYMENT_METHOD, DESCRIPTION, IDEMPOTENCY_KEY
        ) VALUES (
          :userId, 'LKR', 'DEPOSIT', 1, :numAmount, :numAmount, 
          'PENDING', :method, :txDescription, :idempotencyKey
        ) RETURNING TRANSACTION_ID INTO :txId`,
        {
          userId,
          numAmount,
          method,
          txDescription: desc,
          idempotencyKey: idempotencyKey || null,
          txId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );

      const transactionId = insertResult.outBinds.txId[0];

      // Step B: Call Payment Provider
      const providerRes = await provider.createPayment({
        transactionId,
        userId,
        amount: numAmount,
        currency: 'LKR',
        method,
        metadata
      });

      // Update provider reference in transaction
      await connection.execute(
        `UPDATE TRANSACTIONS 
         SET PROVIDER_REF = :providerRef, STATUS = :status 
         WHERE TRANSACTION_ID = :transactionId`,
        {
          providerRef: providerRes.providerReference,
          status: providerRes.status || 'PROCESSING',
          transactionId
        }
      );

      await connection.commit();

      return {
        success: true,
        transactionId,
        providerReference: providerRes.providerReference,
        providerName: provider.providerName,
        isSimulation: !!providerRes.isSimulation,
        status: providerRes.status || 'PROCESSING',
        amount: numAmount,
        currency: 'LKR',
        method
      };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * 2. Verify and Settle Deposit:
   * Confirms payment with provider, credits user wallet atomically, transitions status to COMPLETED.
   */
  async verifyAndSettleDeposit({ userId, transactionId, providerReference, simulateFailure = false }) {
    let connection;
    try {
      connection = await oracledb.getConnection();

      // Lock the transaction record
      let querySql = `SELECT TRANSACTION_ID, USER_ID, TOTAL_AMOUNT, STATUS, PAYMENT_METHOD, PROVIDER_REF 
                      FROM TRANSACTIONS WHERE TRANSACTION_ID = :transactionId AND USER_ID = :userId FOR UPDATE`;
      let queryParams = { transactionId, userId };

      if (!transactionId && providerReference) {
        querySql = `SELECT TRANSACTION_ID, USER_ID, TOTAL_AMOUNT, STATUS, PAYMENT_METHOD, PROVIDER_REF 
                    FROM TRANSACTIONS WHERE PROVIDER_REF = :providerReference AND USER_ID = :userId FOR UPDATE`;
        queryParams = { providerReference, userId };
      }

      const txResult = await connection.execute(querySql, queryParams, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      if (txResult.rows.length === 0) {
        const err = new Error('Deposit transaction record not found.');
        err.status = 404;
        throw err;
      }

      const tx = txResult.rows[0];
      const actualTxId = tx.TRANSACTION_ID;
      const amount = parseFloat(tx.TOTAL_AMOUNT);
      const method = tx.PAYMENT_METHOD;
      const ref = tx.PROVIDER_REF || providerReference;

      // Check if already completed (prevent double credit)
      if (tx.STATUS === 'COMPLETED') {
        const walletResult = await connection.execute(
          `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId`,
          { userId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return {
          success: true,
          alreadyCompleted: true,
          transactionId: actualTxId,
          status: 'COMPLETED',
          message: 'Transaction already completed and settled.',
          availableBalance: parseFloat(walletResult.rows[0]?.BALANCE_LKR || 0)
        };
      }

      const provider = this.getProvider(method);
      const verifyResult = await provider.verifyPayment({
        transactionId: actualTxId,
        providerReference: ref,
        simulateFailure
      });

      if (!verifyResult.success || !verifyResult.verified) {
        // Mark FAILED
        await connection.execute(
          `UPDATE TRANSACTIONS 
           SET STATUS = 'FAILED', FAILURE_REASON = :reason 
           WHERE TRANSACTION_ID = :actualTxId`,
          {
            reason: verifyResult.failureReason || 'Payment verification rejected by provider',
            actualTxId
          }
        );
        await connection.commit();

        const err = new Error(verifyResult.failureReason || 'Payment verification failed.');
        err.status = 422;
        throw err;
      }

      // Step C: Payment Verified! Lock user wallet and credit balance
      const walletRes = await connection.execute(
        `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId FOR UPDATE`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (walletRes.rows.length === 0) {
        // Initialize wallet if not present
        await connection.execute(
          `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:userId, :amount)`,
          { userId, amount }
        );
      } else {
        await connection.execute(
          `UPDATE WALLETS 
           SET BALANCE_LKR = BALANCE_LKR + :amount, UPDATED_AT = CURRENT_TIMESTAMP 
           WHERE USER_ID = :userId`,
          { amount, userId }
        );
      }

      // Sync legacy SL_WALLETS
      try {
        await connection.execute(
          `UPDATE SL_WALLETS SET BALANCE = BALANCE + :amount, LAST_UPDATED = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
          { amount, userId }
        );
      } catch (e) {}

      // Update transaction status to COMPLETED
      await connection.execute(
        `UPDATE TRANSACTIONS 
         SET STATUS = 'COMPLETED', PROVIDER_REF = :ref 
         WHERE TRANSACTION_ID = :actualTxId`,
        { ref: verifyResult.providerReference || ref, actualTxId }
      );

      // Sync legacy SL_TRANSACTIONS
      try {
        await connection.execute(
          `INSERT INTO SL_TRANSACTIONS (USER_ID, AMOUNT, TYPE, STATUS) VALUES (:userId, :amount, 'DEPOSIT', 'COMPLETED')`,
          { userId, amount }
        );
      } catch (e) {}

      await connection.commit();

      // Fetch new balance
      const finalWallet = await connection.execute(
        `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const newBalance = parseFloat(finalWallet.rows[0].BALANCE_LKR);

      // Trigger Push Notification async
      userModel.findById(userId).then(user => {
        if (user && user.EXPO_PUSH_TOKEN) {
          sendPushNotification(
            user.EXPO_PUSH_TOKEN,
            'Deposit Successful 💰',
            `LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} deposited via ${method}. New Balance: LKR ${newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            { type: 'WALLET_DEPOSIT', amount, transactionId: actualTxId }
          );
        }
      }).catch(() => {});

      return {
        success: true,
        transactionId: actualTxId,
        providerReference: verifyResult.providerReference || ref,
        status: 'COMPLETED',
        amount,
        currency: 'LKR',
        method,
        availableBalance: newBalance,
        message: `Successfully deposited LKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }
}

module.exports = new PaymentService();
