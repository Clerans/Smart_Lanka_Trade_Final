const oracledb = require('oracledb');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const { sendPushNotification } = require('./notificationService');

class WalletFundingService {
  /**
   * Look up recipient user by unique Account UID (e.g. SLT-8F42K91)
   */
  async lookupRecipient(uid, senderUserId) {
    if (!uid || typeof uid !== 'string' || !uid.trim()) {
      const err = new Error('Recipient UID is required.');
      err.status = 400;
      throw err;
    }

    const cleanUid = uid.trim().toUpperCase();
    const recipient = await userModel.findByUid(cleanUid);

    if (!recipient) {
      const err = new Error(`Recipient with UID "${cleanUid}" not found.`);
      err.status = 404;
      throw err;
    }

    if (senderUserId && recipient.ID === senderUserId) {
      const err = new Error('Self-transfer is not permitted. You cannot transfer funds to your own UID.');
      err.status = 400;
      throw err;
    }

    return {
      found: true,
      recipient: {
        accountUid: recipient.ACCOUNT_UID,
        name: recipient.NAME,
        isVerified: recipient.IS_VERIFIED === 1,
        kycStatus: recipient.KYC_STATUS || 'NOT_SUBMITTED',
        memberSince: recipient.CREATED_AT
      }
    };
  }

  /**
   * Execute atomic internal wallet transfer between two users
   */
  async executeInternalTransfer({ senderUserId, recipientUid, amount, message = '', idempotencyKey = null, pin = null }) {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      const err = new Error('Invalid transfer amount. Must be greater than zero.');
      err.status = 400;
      throw err;
    }

    const numAmount = parseFloat(amount);
    const cleanRecipientUid = (recipientUid || '').trim().toUpperCase();

    // Server-enforced High-Value Transaction Rule (> LKR 100,000)
    if (numAmount > 100000) {
      if (!pin) {
        const err = new Error('High-value transfers exceeding LKR 100,000 require security PIN verification.');
        err.code = 'HIGH_VALUE_PIN_REQUIRED';
        err.status = 403;
        throw err;
      }
      const isPinValid = await userModel.verifyPin(senderUserId, pin);
      if (!isPinValid) {
        const err = new Error('Invalid security PIN for high-value transfer authorization.');
        err.code = 'INVALID_SECURITY_PIN';
        err.status = 401;
        throw err;
      }
    }

    let connection;
    try {
      connection = await oracledb.getConnection();

      // 1. Resolve recipient by UID
      const recipientRes = await connection.execute(
        `SELECT ID, ACCOUNT_UID, NAME, EXPO_PUSH_TOKEN, KYC_STATUS FROM SL_USERS WHERE UPPER(ACCOUNT_UID) = :cleanRecipientUid`,
        { cleanRecipientUid },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (recipientRes.rows.length === 0) {
        const err = new Error(`Recipient with UID "${cleanRecipientUid}" does not exist.`);
        err.status = 404;
        throw err;
      }

      const recipient = recipientRes.rows[0];
      const recipientUserId = recipient.ID;

      // 2. Reject self-transfer
      if (senderUserId === recipientUserId) {
        const err = new Error('Self-transfer is not permitted. You cannot transfer funds to yourself.');
        err.status = 400;
        throw err;
      }

      // 3. Idempotency Check
      if (idempotencyKey) {
        const existingTx = await connection.execute(
          `SELECT TRANSACTION_ID, TOTAL_AMOUNT, STATUS, PROVIDER_REF, CREATED_AT 
           FROM TRANSACTIONS 
           WHERE USER_ID = :senderUserId AND IDEMPOTENCY_KEY = :idempotencyKey`,
          { senderUserId, idempotencyKey },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (existingTx.rows.length > 0) {
          const row = existingTx.rows[0];
          return {
            success: true,
            isIdempotentReplay: true,
            transactionId: row.TRANSACTION_ID,
            transferReference: row.PROVIDER_REF,
            amount: parseFloat(row.TOTAL_AMOUNT),
            status: row.STATUS,
            recipient: {
              accountUid: recipient.ACCOUNT_UID,
              name: recipient.NAME
            }
          };
        }
      }

      // 4. Deadlock-free row locking: sort by user ID
      const [firstId, secondId] = senderUserId < recipientUserId 
        ? [senderUserId, recipientUserId] 
        : [recipientUserId, senderUserId];

      const firstWalletRes = await connection.execute(
        `SELECT USER_ID, BALANCE_LKR FROM WALLETS WHERE USER_ID = :firstId FOR UPDATE`,
        { firstId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const secondWalletRes = await connection.execute(
        `SELECT USER_ID, BALANCE_LKR FROM WALLETS WHERE USER_ID = :secondId FOR UPDATE`,
        { secondId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // Verify sender wallet exists
      const senderWalletRow = senderUserId === firstId ? firstWalletRes.rows[0] : secondWalletRes.rows[0];
      if (!senderWalletRow) {
        const err = new Error('Sender wallet record not found.');
        err.status = 404;
        throw err;
      }

      const senderBalance = parseFloat(senderWalletRow.BALANCE_LKR);
      if (senderBalance < numAmount) {
        const err = new Error(`Insufficient wallet balance. Available: LKR ${senderBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        err.status = 400;
        throw err;
      }

      // Ensure recipient wallet row exists (initialize if missing)
      const recipientWalletRow = recipientUserId === firstId ? firstWalletRes.rows[0] : secondWalletRes.rows[0];
      if (!recipientWalletRow) {
        await connection.execute(
          `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:recipientUserId, 0.00)`,
          { recipientUserId }
        );
      }

      // 5. Debit sender
      await connection.execute(
        `UPDATE WALLETS 
         SET BALANCE_LKR = BALANCE_LKR - :numAmount, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :senderUserId`,
        { numAmount, senderUserId }
      );

      // 6. Credit recipient
      await connection.execute(
        `UPDATE WALLETS 
         SET BALANCE_LKR = BALANCE_LKR + :numAmount, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :recipientUserId`,
        { numAmount, recipientUserId }
      );

      // Generate unique transfer reference
      const transferRef = `SLT-TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const senderDesc = message ? `Transfer to ${recipient.NAME} (${recipient.ACCOUNT_UID}): ${message}` : `Transfer to ${recipient.NAME} (${recipient.ACCOUNT_UID})`;
      const recipientDesc = message ? `Transfer from UID: ${message}` : `Transfer received from user`;

      // 7. Insert sender transaction
      const senderTxResult = await connection.execute(
        `INSERT INTO TRANSACTIONS (
          USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, 
          STATUS, PAYMENT_METHOD, PROVIDER_REF, RECIPIENT_USER_ID, RECIPIENT_UID, 
          DESCRIPTION, IDEMPOTENCY_KEY
        ) VALUES (
          :senderUserId, 'LKR', 'TRANSFER_SENT', 1, :numAmount, :numAmount, 
          'COMPLETED', 'INTERNAL_TRANSFER', :transferRef, :recipientUserId, :cleanRecipientUid, 
          :senderDesc, :idempotencyKey
        ) RETURNING TRANSACTION_ID INTO :txId`,
        {
          senderUserId,
          numAmount,
          transferRef,
          recipientUserId,
          cleanRecipientUid,
          senderDesc,
          idempotencyKey: idempotencyKey || null,
          txId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );

      const senderTxId = senderTxResult.outBinds.txId[0];

      // 8. Insert recipient transaction
      await connection.execute(
        `INSERT INTO TRANSACTIONS (
          USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, 
          STATUS, PAYMENT_METHOD, PROVIDER_REF, SENDER_USER_ID, RECIPIENT_UID, 
          DESCRIPTION
        ) VALUES (
          :recipientUserId, 'LKR', 'TRANSFER_RECEIVED', 1, :numAmount, :numAmount, 
          'COMPLETED', 'INTERNAL_TRANSFER', :transferRef, :senderUserId, :cleanRecipientUid, 
          :recipientDesc
        )`,
        {
          recipientUserId,
          numAmount,
          transferRef,
          senderUserId,
          cleanRecipientUid,
          recipientDesc
        }
      );

      // Commit entire atomic transaction
      await connection.commit();

      const newSenderBalance = senderBalance - numAmount;

      // 9. Dispatch async notifications
      userModel.findById(senderUserId).then(senderUser => {
        if (senderUser && senderUser.EXPO_PUSH_TOKEN) {
          sendPushNotification(
            senderUser.EXPO_PUSH_TOKEN,
            'Transfer Sent 💸',
            `LKR ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} sent to ${recipient.NAME} (${recipient.ACCOUNT_UID}).`,
            { type: 'TRANSFER_SENT', amount: numAmount, transferRef }
          );
        }
      }).catch(() => {});

      if (recipient.EXPO_PUSH_TOKEN) {
        sendPushNotification(
          recipient.EXPO_PUSH_TOKEN,
          'Funds Received 🎉',
          `You received LKR ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} in your SmartLanka Trade wallet!`,
          { type: 'TRANSFER_RECEIVED', amount: numAmount, transferRef }
        );
      }

      return {
        success: true,
        transactionId: senderTxId,
        transferReference: transferRef,
        amount: numAmount,
        currency: 'LKR',
        recipient: {
          name: recipient.NAME,
          accountUid: recipient.ACCOUNT_UID
        },
        availableBalance: newSenderBalance,
        message: `Successfully transferred LKR ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to ${recipient.NAME}`
      };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Request / Process a withdrawal with state lifecycle
   */
  async requestWithdrawal({ userId, amount, method = 'BANK_ACCOUNT', destination = '', bankName = '', idempotencyKey = null }) {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      const err = new Error('Invalid withdrawal amount. Must be greater than zero.');
      err.status = 400;
      throw err;
    }

    if (!destination || !destination.trim()) {
      const err = new Error('Withdrawal destination account number / identifier is required.');
      err.status = 400;
      throw err;
    }

    const numAmount = parseFloat(amount);
    let connection;
    try {
      connection = await oracledb.getConnection();

      // Lock user wallet and check balance
      const walletRes = await connection.execute(
        `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId FOR UPDATE`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (walletRes.rows.length === 0) {
        const err = new Error('Wallet not found.');
        err.status = 404;
        throw err;
      }

      const availableBalance = parseFloat(walletRes.rows[0].BALANCE_LKR);
      if (availableBalance < numAmount) {
        const err = new Error(`Insufficient funds for withdrawal. Available: LKR ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        err.status = 400;
        throw err;
      }

      // Idempotency Check
      if (idempotencyKey) {
        const existingTx = await connection.execute(
          `SELECT TRANSACTION_ID, TOTAL_AMOUNT, STATUS, PROVIDER_REF, CREATED_AT 
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
            withdrawalReference: row.PROVIDER_REF,
            amount: parseFloat(row.TOTAL_AMOUNT),
            status: row.STATUS,
            availableBalance: availableBalance
          };
        }
      }

      // Deduct balance atomically
      await connection.execute(
        `UPDATE WALLETS 
         SET BALANCE_LKR = BALANCE_LKR - :numAmount, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE USER_ID = :userId`,
        { numAmount, userId }
      );

      // Generate withdrawal reference
      const withdrawalRef = `SLT-WTH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const maskedDest = destination.length > 4 ? `****${destination.slice(-4)}` : destination;
      const desc = `Withdrawal to ${bankName ? bankName + ' ' : ''}(${maskedDest}) via ${method}`;

      // Insert transaction in PROCESSING status
      const insertResult = await connection.execute(
        `INSERT INTO TRANSACTIONS (
          USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, 
          STATUS, PAYMENT_METHOD, PROVIDER_REF, DESCRIPTION, IDEMPOTENCY_KEY
        ) VALUES (
          :userId, 'LKR', 'WITHDRAW', 1, :numAmount, :numAmount, 
          'PROCESSING', :method, :withdrawalRef, :txDescription, :idempotencyKey
        ) RETURNING TRANSACTION_ID INTO :txId`,
        {
          userId,
          numAmount,
          method,
          withdrawalRef,
          txDescription: desc,
          idempotencyKey: idempotencyKey || null,
          txId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );

      const txId = insertResult.outBinds.txId[0];

      await connection.commit();

      const newBalance = availableBalance - numAmount;

      // Async notification
      userModel.findById(userId).then(user => {
        if (user && user.EXPO_PUSH_TOKEN) {
          sendPushNotification(
            user.EXPO_PUSH_TOKEN,
            'Withdrawal Initiated ⏳',
            `Withdrawal of LKR ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to ${maskedDest} is processing.`,
            { type: 'WITHDRAWAL_PROCESSING', amount: numAmount, withdrawalRef }
          );
        }
      }).catch(() => {});

      return {
        success: true,
        transactionId: txId,
        withdrawalReference: withdrawalRef,
        amount: numAmount,
        currency: 'LKR',
        status: 'PROCESSING',
        destinationMasked: maskedDest,
        fee: 0.00,
        youReceive: numAmount,
        availableBalance: newBalance,
        message: `Withdrawal request for LKR ${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} submitted successfully.`
      };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Get detailed transaction history with filter and pagination
   */
  async getTransactionHistory({ userId, limit = 20, type = 'ALL' }) {
    let connection;
    try {
      connection = await oracledb.getConnection();
      let sql = `
        SELECT 
          TRANSACTION_ID, USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, 
          TOTAL_AMOUNT, STATUS, PAYMENT_METHOD, PROVIDER_REF, SENDER_USER_ID, 
          RECIPIENT_USER_ID, RECIPIENT_UID, DESCRIPTION, FAILURE_REASON, CREATED_AT 
        FROM TRANSACTIONS 
        WHERE (USER_ID = :userId OR RECIPIENT_USER_ID = :userId)
      `;

      const binds = { userId };

      if (type && type !== 'ALL') {
        const cleanType = type.toUpperCase();
        if (cleanType === 'TRANSFER') {
          sql += ` AND TRANSACTION_TYPE IN ('TRANSFER_SENT', 'TRANSFER_RECEIVED')`;
        } else {
          sql += ` AND TRANSACTION_TYPE = :cleanType`;
          binds.cleanType = cleanType;
        }
      }

      sql += ` ORDER BY CREATED_AT DESC FETCH NEXT :limit ROWS ONLY`;
      binds.limit = parseInt(limit, 10) || 20;

      const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      const formatted = result.rows.map(row => ({
        id: row.TRANSACTION_ID,
        type: row.TRANSACTION_TYPE,
        amount: parseFloat(row.TOTAL_AMOUNT),
        symbol: row.SYMBOL || 'LKR',
        quantity: parseFloat(row.QUANTITY || 1),
        price: parseFloat(row.PRICE || row.TOTAL_AMOUNT),
        status: row.STATUS,
        paymentMethod: row.PAYMENT_METHOD || 'INTERNAL',
        reference: row.PROVIDER_REF || null,
        recipientUid: row.RECIPIENT_UID || null,
        description: row.DESCRIPTION || '',
        failureReason: row.FAILURE_REASON || null,
        isIncoming: row.TRANSACTION_TYPE === 'DEPOSIT' || row.TRANSACTION_TYPE === 'TRANSFER_RECEIVED' || row.TRANSACTION_TYPE === 'SELL',
        createdAt: row.CREATED_AT
      }));

      return formatted;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Get single transaction details receipt
   */
  async getTransactionDetails(transactionId, userId) {
    let connection;
    try {
      connection = await oracledb.getConnection();
      const result = await connection.execute(
        `SELECT 
          TRANSACTION_ID, USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, 
          TOTAL_AMOUNT, STATUS, PAYMENT_METHOD, PROVIDER_REF, SENDER_USER_ID, 
          RECIPIENT_USER_ID, RECIPIENT_UID, DESCRIPTION, FAILURE_REASON, CREATED_AT 
         FROM TRANSACTIONS 
         WHERE TRANSACTION_ID = :transactionId AND (USER_ID = :userId OR RECIPIENT_USER_ID = :userId)`,
        { transactionId, userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length === 0) {
        const err = new Error('Transaction record not found.');
        err.status = 404;
        throw err;
      }

      const row = result.rows[0];
      return {
        id: row.TRANSACTION_ID,
        type: row.TRANSACTION_TYPE,
        amount: parseFloat(row.TOTAL_AMOUNT),
        symbol: row.SYMBOL || 'LKR',
        quantity: parseFloat(row.QUANTITY || 1),
        price: parseFloat(row.PRICE || row.TOTAL_AMOUNT),
        status: row.STATUS,
        paymentMethod: row.PAYMENT_METHOD || 'INTERNAL',
        reference: row.PROVIDER_REF || null,
        recipientUid: row.RECIPIENT_UID || null,
        description: row.DESCRIPTION || '',
        failureReason: row.FAILURE_REASON || null,
        fee: 0.00,
        createdAt: row.CREATED_AT
      };
    } finally {
      if (connection) await connection.close();
    }
  }
}

module.exports = new WalletFundingService();
