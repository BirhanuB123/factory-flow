const crypto = require('crypto');
const WebhookEvent = require('../models/WebhookEvent');

function sanitizeEventKey(value) {
  return String(value || '').trim().slice(0, 256);
}

function hashPayload(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

async function consumeWebhookEvent(provider, eventKey, ttlMs) {
  const p = String(provider || 'unknown').trim().toLowerCase() || 'unknown';
  const k = sanitizeEventKey(eventKey);
  if (!k) return { accepted: false, reason: 'missing_event_key' };

  const ttl = Math.max(60_000, Number(ttlMs) || 24 * 60 * 60 * 1000);
  const expireAt = new Date(Date.now() + ttl);
  try {
    await WebhookEvent.create({ provider: p, eventKey: k, expireAt });
    return { accepted: true };
  } catch (err) {
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      return { accepted: false, reason: 'duplicate' };
    }
    throw err;
  }
}

module.exports = {
  consumeWebhookEvent,
  hashPayload,
};
