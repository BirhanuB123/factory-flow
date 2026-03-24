const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const { verifyTimestampedHmac } = require('../utils/webhookSecurity');
const { consumeWebhookEvent } = require('../utils/webhookIdempotency');
const { normalizePlan, optionalNormalizedPlan } = require('../utils/billingDomain');

const CHAPA_API_BASE = 'https://api.chapa.co/v1';

function idempotencyTtlMs() {
  return Math.max(60_000, Number(process.env.BILLING_WEBHOOK_IDEMPOTENCY_TTL_MS) || 24 * 60 * 60 * 1000);
}

function getPublicAppOrigin() {
  return String(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function getChapaSecretKey() {
  return String(process.env.CHAPA_SECRET_KEY || '').trim();
}

function amountForPlan(planRaw) {
  const plan = normalizePlan(planRaw, 'starter').plan;
  const fromEnv = {
    starter: Number(process.env.CHAPA_PLAN_STARTER_AMOUNT || 0),
    pro: Number(process.env.CHAPA_PLAN_PRO_AMOUNT || 0),
    enterprise: Number(process.env.CHAPA_PLAN_ENTERPRISE_AMOUNT || 0),
  };
  const fallback = {
    starter: 1499,
    pro: 3999,
    enterprise: 9999,
  };
  const amount = Number.isFinite(fromEnv[plan]) && fromEnv[plan] > 0 ? fromEnv[plan] : fallback[plan];
  return Number.isFinite(amount) && amount > 0 ? amount : fallback.starter;
}

function parseTenantIdFromTxRef(txRef) {
  const m = /^ff_([a-f0-9]{24})_/i.exec(String(txRef || '').trim());
  return m ? m[1] : '';
}

async function verifyChapaTx(txRef) {
  const secret = getChapaSecretKey();
  if (!secret) throw new Error('Missing CHAPA_SECRET_KEY');
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
  return body;
}

async function markTenantPaidByTxRef(txRef, expectedTenantId) {
  const tidFromRef = parseTenantIdFromTxRef(txRef);
  const tenantId = expectedTenantId || tidFromRef;
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid or unknown tenant in tx_ref');
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const verifyBody = await verifyChapaTx(txRef);
  const data = verifyBody?.data || {};
  const chapaStatus = String(data?.status || '').trim().toLowerCase();
  if (chapaStatus !== 'success') {
    return { ok: false, tenant, status: chapaStatus || 'unknown', verifyBody };
  }

  const metaTenantId = String(data?.meta?.tenantId || '').trim();
  if (metaTenantId && metaTenantId !== String(tenant._id)) {
    throw new Error('Verified transaction tenant does not match expected tenant');
  }

  const planFromMeta = String(data?.meta?.plan || '').trim().toLowerCase();
  const customerEmail = String(data?.customer?.email || '').trim();
  const txId = String(data?.id || '').trim();
  const billingCustomerId = (txId || customerEmail || String(txRef || '').trim()).slice(0, 200);

  const patch = {
    status: 'active',
    statusReason: '',
    billingProvider: 'chapa',
    billingCustomerId,
  };
  const normalizedMetaPlan = optionalNormalizedPlan(planFromMeta);
  if (normalizedMetaPlan.hasValue && normalizedMetaPlan.isKnown && normalizedMetaPlan.plan) {
    patch.plan = normalizedMetaPlan.plan;
  }

  const updated = await Tenant.findByIdAndUpdate(tenant._id, { $set: patch }, { new: true });
  await PlatformAuditLog.create({
    actorName: 'SYSTEM',
    actorEmployeeId: 'SYSTEM',
    action: 'tenant.billing.chapa_payment',
    resourceType: 'Tenant',
    resourceId: String(updated._id),
    details: {
      key: updated.key,
      txRef: String(txRef || ''),
      chapaTransactionId: txId || undefined,
      amount: data?.amount,
      currency: data?.currency,
      plan: updated.plan,
      status: updated.status,
      ignoredPlan: normalizedMetaPlan.hasValue && !normalizedMetaPlan.isKnown ? normalizedMetaPlan.input : undefined,
    },
    ip: '',
  });

  return { ok: true, tenant: updated, status: chapaStatus, verifyBody };
}

const initializeChapaCheckout = asyncHandler(async (req, res) => {
  if (!['Admin', 'finance_head'].includes(String(req.user?.role || ''))) {
    return res.status(403).json({
      success: false,
      message: 'Only Admin or finance_head can start subscription payment',
    });
  }
  const secret = getChapaSecretKey();
  if (!secret) {
    return res.status(500).json({ success: false, message: 'Missing CHAPA_SECRET_KEY' });
  }
  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const plan = normalizePlan(req.body?.plan || tenant.plan || 'starter', 'starter').plan;
  const amount = amountForPlan(plan);
  const currency = String(process.env.CHAPA_CURRENCY || tenant.currency || 'ETB').trim().toUpperCase().slice(0, 8);
  const txRef = `ff_${tenant._id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const callbackUrl = String(process.env.CHAPA_WEBHOOK_CALLBACK_URL || `${getPublicAppOrigin()}/api/billing/webhook/chapa`).trim();
  const returnPath = String(req.body?.returnPath || '/settings').trim();
  const safeReturnPath = returnPath.startsWith('/') ? returnPath : '/settings';
  const returnUrl = `${getPublicAppOrigin()}${safeReturnPath}?chapa_ref=${encodeURIComponent(txRef)}&chapa_status=callback`;
  const name = String(req.user?.name || '').trim();
  const [firstName = 'Company', ...rest] = name.split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ') || 'Admin';
  const email = String(req.body?.email || req.user?.email || '').trim();
  if (!email) {
    return res.status(400).json({ success: false, message: 'A billing email is required to pay with Chapa' });
  }

  const payload = {
    amount: Number(amount).toFixed(2),
    currency,
    email,
    first_name: firstName,
    last_name: lastName,
    tx_ref: txRef,
    callback_url: callbackUrl,
    return_url: returnUrl,
    customization: {
      title: `${tenant.displayName || tenant.legalName} Subscription`,
      description: `Factory Flow ${plan} plan payment`,
    },
    meta: {
      tenantId: String(tenant._id),
      tenantKey: tenant.key,
      plan,
    },
  };

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
    return res.status(502).json({ success: false, message: msg });
  }

  return res.json({
    success: true,
    data: {
      provider: 'chapa',
      txRef,
      checkoutUrl: body?.data?.checkout_url,
      amount,
      currency,
      plan,
    },
  });
});

const verifyChapaPayment = asyncHandler(async (req, res) => {
  const txRef = String(req.params.txRef || req.query.txRef || '').trim();
  if (!txRef) {
    return res.status(400).json({ success: false, message: 'txRef is required' });
  }
  const result = await markTenantPaidByTxRef(txRef, String(req.tenantId || ''));
  if (!result.ok) {
    return res.status(409).json({
      success: false,
      message: `Payment not completed yet (status: ${result.status})`,
      data: { status: result.status },
    });
  }
  return res.json({
    success: true,
    data: {
      tenantId: String(result.tenant._id),
      status: result.tenant.status,
      plan: result.tenant.plan,
      billingProvider: result.tenant.billingProvider,
      txRef,
    },
  });
});

const chapaWebhook = asyncHandler(async (req, res) => {
  const hmacSecret = String(process.env.CHAPA_WEBHOOK_HMAC_SECRET || '').trim();
  if (hmacSecret) {
    const verify = verifyTimestampedHmac({
      req,
      secret: hmacSecret,
      signatureHeaders: ['x-chapa-webhook-signature', 'x-webhook-signature', 'chapa-signature'],
      timestampHeaders: ['x-chapa-webhook-timestamp', 'x-webhook-timestamp', 'chapa-timestamp'],
      toleranceSec: Number(process.env.BILLING_WEBHOOK_TOLERANCE_SEC) || 300,
    });
    if (!verify.ok) {
      return res.status(401).json({ success: false, message: `Invalid Chapa webhook signature (${verify.reason})` });
    }
  }

  const expected = String(process.env.CHAPA_WEBHOOK_SECRET || '').trim();
  if (expected) {
    const incoming = String(req.headers['x-chapa-webhook-secret'] || req.headers['chapa-webhook-secret'] || '').trim();
    if (!incoming || incoming !== expected) {
      return res.status(401).json({ success: false, message: 'Invalid Chapa webhook secret' });
    }
  }
  const txRef = String(req.body?.tx_ref || req.body?.data?.tx_ref || req.body?.trxref || '').trim();
  if (!txRef) {
    return res.status(400).json({ success: false, message: 'Missing tx_ref in webhook body' });
  }

  const eventId = String(req.body?.id || req.body?.event_id || req.headers['x-event-id'] || txRef).trim();
  const idempotency = await consumeWebhookEvent('chapa', eventId, idempotencyTtlMs());
  if (!idempotency.accepted) {
    return res.json({ success: true, duplicate: true });
  }

  const result = await markTenantPaidByTxRef(txRef);
  if (!result.ok) {
    return res.json({ success: true, ignored: true, status: result.status });
  }
  return res.json({ success: true });
});

module.exports = {
  initializeChapaCheckout,
  verifyChapaPayment,
  chapaWebhook,
};
