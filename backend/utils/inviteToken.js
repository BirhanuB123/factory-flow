const crypto = require('crypto');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** URL-safe random token (show in link only once). */
function generateInviteRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashInviteToken(rawToken) {
  return sha256Hex(rawToken);
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

module.exports = {
  generateInviteRawToken,
  hashInviteToken,
  timingSafeEqualHex,
};
