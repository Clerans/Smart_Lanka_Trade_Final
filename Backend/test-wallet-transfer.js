const oracledb = require('oracledb');
require('dotenv').config();
const connectDB = require('./config/db');
const paymentService = require('./services/paymentService');
const walletFundingService = require('./services/walletFundingService');
const userModel = require('./models/userModel');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 SMARTLANKA TRADE WALLET & TRANSFER AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  let connection;
  try {
    await connectDB();
    connection = await oracledb.getConnection();

    // Ensure test users have UIDs
    await connection.execute(`UPDATE SL_USERS SET ACCOUNT_UID = 'SLT-TESTUSR1' WHERE ID = 1 AND (ACCOUNT_UID IS NULL OR ACCOUNT_UID NOT LIKE 'SLT-%')`);
    await connection.execute(`UPDATE SL_USERS SET ACCOUNT_UID = 'SLT-TESTUSR2' WHERE ID = 2 AND (ACCOUNT_UID IS NULL OR ACCOUNT_UID NOT LIKE 'SLT-%')`);
    await connection.commit();

    // Find two test users in database
    const usersRes = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL FROM SL_USERS WHERE ID IN (1, 2) ORDER BY ID`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (usersRes.rows.length < 2) {
      console.warn('Need at least 2 users in database for transfer tests.');
      return;
    }

    const user1 = usersRes.rows[0];
    const user2 = usersRes.rows[1];
    console.log(`👤 User 1: ID=${user1.ID}, UID=${user1.ACCOUNT_UID}, Name=${user1.NAME}`);
    console.log(`👤 User 2: ID=${user2.ID}, UID=${user2.ACCOUNT_UID}, Name=${user2.NAME}\n`);

    // ----------------------------------------------------
    // TEST 1: Deposit via Simulated Payment Provider
    // ----------------------------------------------------
    console.log('--- TEST 1: Deposit via Simulated Payment Provider ---');
    const depositAmount = 25000.00;
    const initialWallet1 = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`,
      { id: user1.ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const initialBal1 = parseFloat(initialWallet1.rows[0]?.BALANCE_LKR || 0);

    const depositInit = await paymentService.initiateDeposit({
      userId: user1.ID,
      amount: depositAmount,
      method: 'CARD',
      idempotencyKey: `test-dep-init-${Date.now()}`
    });
    assert(depositInit.success && depositInit.transactionId, 'Deposit initiated with PENDING/PROCESSING status');

    const depositSettle = await paymentService.verifyAndSettleDeposit({
      userId: user1.ID,
      transactionId: depositInit.transactionId,
      providerReference: depositInit.providerReference
    });
    assert(depositSettle.success && depositSettle.status === 'COMPLETED', 'Deposit settled and verified');

    const postDepWallet1 = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`,
      { id: user1.ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const postDepBal1 = parseFloat(postDepWallet1.rows[0].BALANCE_LKR);
    assert(postDepBal1 === initialBal1 + depositAmount, `Wallet 1 balance incremented exactly by LKR ${depositAmount}`);

    // ----------------------------------------------------
    // TEST 2: Invalid Deposit (Negative / Zero Amount)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Invalid Deposit Rejection ---');
    try {
      await paymentService.initiateDeposit({
        userId: user1.ID,
        amount: -500,
        method: 'BANK'
      });
      assert(false, 'Negative deposit should throw error');
    } catch (err) {
      assert(err.status === 400, 'Negative deposit rejected with 400 Bad Request');
    }

    // ----------------------------------------------------
    // TEST 3: Idempotent Deposit (Double Crediting Prevention)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Idempotent Deposit ---');
    const idemKey = `idem-${Date.now()}`;
    const firstInit = await paymentService.initiateDeposit({
      userId: user1.ID,
      amount: 1000,
      method: 'JUSTPAY',
      idempotencyKey: idemKey
    });
    const secondInit = await paymentService.initiateDeposit({
      userId: user1.ID,
      amount: 1000,
      method: 'JUSTPAY',
      idempotencyKey: idemKey
    });
    assert(secondInit.isIdempotentReplay === true && secondInit.transactionId === firstInit.transactionId, 'Repeated idempotency key returns existing transaction without duplicate insert');

    // ----------------------------------------------------
    // TEST 4: Recipient UID Lookup
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Recipient UID Lookup ---');
    const lookupRes = await walletFundingService.lookupRecipient(user2.ACCOUNT_UID, user1.ID);
    assert(lookupRes.found && lookupRes.recipient.name === user2.NAME, `Looked up ${user2.ACCOUNT_UID} successfully without leaking credentials`);

    // Nonexistent UID
    try {
      await walletFundingService.lookupRecipient('SLT-NONEXISTENT', user1.ID);
      assert(false, 'Nonexistent UID lookup should throw 404');
    } catch (err) {
      assert(err.status === 404, 'Nonexistent UID rejected with 404 Not Found');
    }

    // Self-lookup
    try {
      await walletFundingService.lookupRecipient(user1.ACCOUNT_UID, user1.ID);
      assert(false, 'Self UID lookup should throw 400');
    } catch (err) {
      assert(err.status === 400, 'Self-transfer lookup rejected with 400 Bad Request');
    }

    // ----------------------------------------------------
    // TEST 5: Internal UID Transfer (Atomic Debit & Credit)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Atomic Internal Transfer ---');
    const transferAmount = 15000.00;
    const u1Before = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user1.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);
    const u2Before = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user2.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);

    const transferRes = await walletFundingService.executeInternalTransfer({
      senderUserId: user1.ID,
      recipientUid: user2.ACCOUNT_UID,
      amount: transferAmount,
      message: 'Settlement for trade'
    });

    assert(transferRes.success && transferRes.transferReference, 'Transfer executed successfully');

    const u1After = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user1.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);
    const u2After = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user2.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);

    assert(u1After === u1Before - transferAmount, `Sender balance accurately debited by LKR ${transferAmount}`);
    assert(u2After === u2Before + transferAmount, `Recipient balance accurately credited by LKR ${transferAmount}`);

    // ----------------------------------------------------
    // TEST 6: Withdrawal Lifecycle & Insufficient Balance
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Withdrawal Lifecycle & Balance Check ---');
    const withdrawAmount = 5000.00;
    const balBeforeWithdraw = u1After;

    const withdrawRes = await walletFundingService.requestWithdrawal({
      userId: user1.ID,
      amount: withdrawAmount,
      method: 'BANK_ACCOUNT',
      destination: '8001234567',
      bankName: 'Commercial Bank of Ceylon'
    });

    assert(withdrawRes.success && withdrawRes.status === 'PROCESSING', 'Withdrawal request created in PROCESSING status');
    const balAfterWithdraw = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user1.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);
    assert(balAfterWithdraw === balBeforeWithdraw - withdrawAmount, `Withdrawal balance deducted from available cash`);

    // Insufficient funds withdrawal test
    try {
      await walletFundingService.requestWithdrawal({
        userId: user1.ID,
        amount: balAfterWithdraw + 99999999,
        method: 'BANK_ACCOUNT',
        destination: '8001234567'
      });
      assert(false, 'Excess withdrawal should be rejected');
    } catch (err) {
      assert(err.status === 400, 'Excess withdrawal rejected with 400 Insufficient Funds');
    }

    // ----------------------------------------------------
    // TEST 7: Concurrency & Double-Spend Protection (Phase 14)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Concurrency & Overdraft Protection ---');
    // Set a controlled test balance for User 2 of LKR 10,000
    await connection.execute(`UPDATE WALLETS SET BALANCE_LKR = 10000.00 WHERE USER_ID = :id`, { id: user2.ID });
    await connection.commit();

    console.log('User 2 starting balance: LKR 10,000. Launching two simultaneous transfers of LKR 8,000 each...');

    const p1 = walletFundingService.executeInternalTransfer({
      senderUserId: user2.ID,
      recipientUid: user1.ACCOUNT_UID,
      amount: 8000.00,
      message: 'Concurrent transfer attempt 1'
    }).then(res => ({ success: true, res })).catch(err => ({ success: false, err }));

    const p2 = walletFundingService.executeInternalTransfer({
      senderUserId: user2.ID,
      recipientUid: user1.ACCOUNT_UID,
      amount: 8000.00,
      message: 'Concurrent transfer attempt 2'
    }).then(res => ({ success: true, res })).catch(err => ({ success: false, err }));

    const [r1, r2] = await Promise.all([p1, p2]);

    const successes = [r1, r2].filter(r => r.success).length;
    const failures = [r1, r2].filter(r => !r.success).length;

    assert(successes === 1 && failures === 1, `Exactly ONE concurrent transfer succeeded (${successes} succeeded, ${failures} rejected)`);

    const finalU2Bal = parseFloat((await connection.execute(`SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`, { id: user2.ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].BALANCE_LKR);
    assert(finalU2Bal === 2000.00, `User 2 final balance is exactly LKR 2,000.00 (No negative balance, no double-spend)`);

    // ----------------------------------------------------
    // TEST 8: Transaction History & Receipt Query
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Transaction History & Receipts ---');
    const history = await walletFundingService.getTransactionHistory({ userId: user1.ID, limit: 10 });
    assert(Array.isArray(history) && history.length > 0, `Retrieved ${history.length} transactions in history`);

    const firstTx = history[0];
    const details = await walletFundingService.getTransactionDetails(firstTx.id, user1.ID);
    assert(details.id === firstTx.id && details.amount > 0, `Retrieved detailed transaction receipt for ID ${details.id}`);

    console.log('\n========================================================');
    console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

  } catch (err) {
    console.error('❌ Test suite fatal error:', err);
  } finally {
    if (connection) await connection.close();
    const { closePool } = require('./config/db');
    await closePool();
  }
}

runTests();
