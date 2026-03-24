const crypto = require('crypto');

function normalizeRawBody(req) {
  const raw = req?.rawBody;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (typeof raw === 'string') return raw;
  return '';
}

function safeCompareHex(expectedHex, incomingHex) {
  if (!expectedHex || !incomingHex) return false;
  const a = Buffer.from(String(expectedHex), 'hex');
  const b = Buffer.from(String(incomingHex), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyTimestampedHmac({ req, secret, signatureHeaders, timestampHeaders, toleranceSec = 300 }) {
  const key = String(secret || '').trim();
  if (!key) return { ok: false, reason: 'missing_secret' };

  const rawBody = normalizeRawBody(req);
  if (!rawBody) return { ok: false, reason: 'missing_raw_body' };

  const tsHeader = timestampHeaders
    .map((h) => String(req.headers[h] || '').trim())
    .find(Boolean);
  const sigHeader = signatureHeaders
    .map((h) => String(req.headers[h] || '').trim())
    .find(Boolean);

  if (!tsHeader || !sigHeader) return { ok: false, reason: 'missing_headers' };

  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_timestamp' };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > Math.max(1, Number(toleranceSec) || 300)) {
    return { ok: false, reason: 'timestamp_out_of_range' };
  }

  const payload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');
  const incoming = sigHeader.replace(/^v1=/i, '');

  if (!safeCompareHex(expected, incoming)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}

module.exports = {
  normalizeRawBody,
  verifyTimestampedHmac,
};
