const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CHAPA_API_BASE = 'https://api.chapa.co/v1';

/**
 * Get Chapa Secret Key from environment
 */
const getChapaSecretKey = () => {
  return String(process.env.CHAPA_SECRET_KEY || '').trim();
};

/**
 * Initialize a Chapa transaction
 * @param {Object} payload - Transaction details (amount, email, first_name, last_name, tx_ref, etc.)
 */
exports.initializeTransaction = async (payload) => {
  const secret = getChapaSecretKey();
  if (!secret) {
    throw new Error('Missing CHAPA_SECRET_KEY environment variable');
  }

  const response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || String(body?.status || '').toLowerCase() !== 'success') {
    const msg = String(body?.message || 'Unable to initialize Chapa checkout');
    throw new Error(msg);
  }

  return body.data; // contains checkout_url
};

/**
 * Verify a Chapa transaction status
 * @param {string} txRef - The unique transaction reference
 */
exports.verifyTransaction = async (txRef) => {
  const secret = getChapaSecretKey();
  if (!secret) {
    throw new Error('Missing CHAPA_SECRET_KEY environment variable');
  }

  const response = await fetch(
    `${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(String(txRef || '').trim())}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    }
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = String(body?.message || `Chapa verify failed (${response.status})`);
    throw new Error(msg);
  }

  return body.data;
};
