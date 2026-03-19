const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEV_FALLBACK =
  process.env.NODE_ENV === 'test'
    ? 'test-jwt-secret-must-be-32-chars-min!!'
    : 'dev-only-min-32-chars-do-not-use-in-production!';

/**
 * @returns {string}
 */
function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (!s || String(s).length < 32) {
      console.error(
        '[FATAL] Set JWT_SECRET to a random string of at least 32 characters in production.'
      );
      process.exit(1);
    }
    return s;
  }
  if (s && String(s).length < 32) {
    console.warn('[warn] JWT_SECRET should be at least 32 characters.');
  }
  return s || DEV_FALLBACK;
}

/** Pre-Phase-4 default; tokens in browsers may still use this when JWT_SECRET was unset */
const LEGACY_DEV_SECRETS = ['fallback_secret', 'dev-only-min-32-chars-do-not-use-in-production!'];

/**
 * Secrets to try when verifying JWT (signing always uses getJwtSecret() only).
 * Dev: accept tokens from older dev defaults or after JWT_SECRET changes until users re-login.
 */
function getJwtVerifySecrets() {
  const primary = getJwtSecret();
  if (process.env.NODE_ENV === 'production') {
    const prev = process.env.JWT_SECRET_PREVIOUS;
    return prev && prev !== primary ? [primary, prev] : [primary];
  }
  const out = new Set([primary, ...LEGACY_DEV_SECRETS]);
  if (process.env.JWT_SECRET_PREVIOUS) out.add(process.env.JWT_SECRET_PREVIOUS);
  return [...out];
}

module.exports = { getJwtSecret, getJwtVerifySecrets };
