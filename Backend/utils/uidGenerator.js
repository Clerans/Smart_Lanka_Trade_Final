const crypto = require('crypto');

function generateAccountUID() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  const bytes = crypto.randomBytes(7);
  for (let i = 0; i < 7; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `SLT-${code}`;
}

module.exports = { generateAccountUID };
