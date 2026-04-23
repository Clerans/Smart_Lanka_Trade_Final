const oracledb = require('oracledb');

const getWalletBalance = async (req, res) => {
  let connection;
  try {
    // For development: if not authenticated, fallback to User ID 1
    const userId = req.user ? req.user.id : 1;
    
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT BALANCE, CURRENCY FROM SL_WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(result.rows[0].BALANCE),
        currency: result.rows[0].CURRENCY
      }
    });
  } catch (error) {
    console.error('Wallet Fetch Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching wallet balance' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

module.exports = {
  getWalletBalance
};
