const asyncHandler = require('express-async-handler');
const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const PlatformAuditLog = require('../models/PlatformAuditLog');

const PLAN_BY_STRIPE_PRICE = {
  starter: String(process.env.STRIPE_PRICE_STARTER || '').trim(),
  pro: String(process.env.STRIPE_PRICE_PRO || '').trim(),
  enterprise: String(process.env.STRIPE_PRICE_ENTERPRISE || '').trim(),
};

function resolvePlanFromPayload(payload) {
  const explicitPlan = String(payload.plan || '').trim().toLowerCase();
  if (explicitPlan) return explicitPlan;

  const stripePriceId = String(payload.stripePriceId || payload.priceId || '').trim();
  if (!stripePriceId) return '';
  for (const [plan, id] of Object.entries(PLAN_BY_STRIPE_PRICE)) {
    if (id && id === stripePriceId) return plan;
  }
  return '';
}

function resolvePlanFromStripePriceId(priceId) {
  const incoming = String(priceId || '').trim();
  if (!incoming) return '';
  for (const [plan, id] of Object.entries(PLAN_BY_STRIPE_PRICE)) {
    if (id && id === incoming) return plan;
  }
  return '';
}

async function findTenantForBillingSync({ tenantId, tenantKey, billingCustomerId }) {
  const tid = String(tenantId || '').trim();
  if (tid) return Tenant.findById(tid);
  const key = String(tenantKey || '').trim().toLowerCase();
  if (key) return Tenant.findOne({ key });
  const cid = String(billingCustomerId || '').trim();
  if (cid) return Tenant.findOne({ billingCustomerId: cid });
  return null;
}

function normalizeBillingStatusToTenantPatch(billingStatus) {
  const s = String(billingStatus || '').trim().toLowerCase();
  if (s === 'trialing') return { status: 'trial', statusReason: '' };
  if (s === 'active') return { status: 'active', statusReason: '' };
  if (['past_due', 'unpaid', 'canceled', 'cancelled', 'incomplete_expired'].includes(s)) {
    return { status: 'suspended', statusReason: `Billing status: ${s}` };
  }
  return {};
}

async function writeSystemBillingAudit(action, tenantDoc, details) {
  await PlatformAuditLog.create({
    actorName: 'SYSTEM',
    actorEmployeeId: 'SYSTEM',
    action,
    resourceType: 'Tenant',
    resourceId: String(tenantDoc._id),
    details,
    ip: '',
  });
}

/**
 * Public webhook: sync tenant billing metadata + plan from provider events.
 * Security: requires x-billing-webhook-secret to match BILLING_WEBHOOK_SECRET.
 * Payload supports tenantId OR tenantKey OR billingCustomerId, plus:
 * { billingProvider, billingCustomerId, plan?, stripePriceId?, status?, trialEndDate? }.
 */
const billingWebhookSync = asyncHandler(async (req, res) => {
  const expected = String(process.env.BILLING_WEBHOOK_SECRET || '').trim();
  const incoming = String(req.headers['x-billing-webhook-secret'] || '').trim();
  if (!expected || !incoming || incoming !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
  }

  const provider = String(req.body.billingProvider || req.body.provider || '').trim().toLowerCase() || 'other';
  const customerId = String(req.body.billingCustomerId || req.body.customerId || '').trim();
  const tenantId = String(req.body.tenantId || '').trim();
  const tenantKey = String(req.body.tenantKey || '').trim().toLowerCase();
  const billingStatus = String(req.body.status || '').trim().toLowerCase();
  const plan = resolvePlanFromPayload(req.body);
  const trialEndDate =
    req.body.trialEndDate != null && req.body.trialEndDate !== ''
      ? new Date(String(req.body.trialEndDate))
      : null;

  if (!tenantId && !tenantKey && !customerId) {
    return res.status(400).json({
      success: false,
      message: 'Provide one of: tenantId, tenantKey, billingCustomerId',
    });
  }
  if (trialEndDate && Number.isNaN(trialEndDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid trialEndDate' });
  }

  const tenant = await findTenantForBillingSync({
    tenantId,
    tenantKey,
    billingCustomerId: customerId,
  });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found for webhook payload' });
  }

  const $set = {};
  if (provider) $set.billingProvider = ['none', 'manual', 'stripe', 'other'].includes(provider) ? provider : 'other';
  if (customerId) $set.billingCustomerId = customerId.slice(0, 200);
  if (plan) $set.plan = plan.slice(0, 64);
  if (trialEndDate) $set.trialEndDate = trialEndDate;

  if (billingStatus === 'trialing') {
    $set.status = 'trial';
    $set.statusReason = '';
  } else if (billingStatus === 'active') {
    $set.status = 'active';
    $set.statusReason = '';
  } else if (['past_due', 'unpaid', 'canceled', 'cancelled', 'incomplete_expired'].includes(billingStatus)) {
    $set.status = 'suspended';
    $set.statusReason = `Billing status: ${billingStatus}`;
  }

  const updated = await Tenant.findByIdAndUpdate(tenant._id, { $set }, { new: true });
  await writeSystemBillingAudit('tenant.billing.sync', updated, {
    key: updated.key,
    displayName: updated.displayName,
    billingProvider: updated.billingProvider,
    billingCustomerId: updated.billingCustomerId || undefined,
    plan: updated.plan,
    status: updated.status,
  });

  res.json({ success: true, data: updated });
});

const stripeWebhook = asyncHandler(async (req, res) => {
  const sig = String(req.headers['stripe-signature'] || '').trim();
  const endpointSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!endpointSecret) {
    return res.status(500).json({ success: false, message: 'Missing STRIPE_WEBHOOK_SECRET' });
  }
  if (!sig) {
    return res.status(400).json({ success: false, message: 'Missing Stripe-Signature header' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).json({ success: false, message: 'Missing raw webhook body' });
  }

  const stripe = new Stripe(
    String(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_webhooks'),
    { apiVersion: '2024-06-20' }
  );

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (_err) {
    return res.status(400).json({ success: false, message: 'Invalid Stripe signature' });
  }

  const eventType = String(event.type || '');
  let targetTenantId = '';
  let patch = {};
  let billingCustomerId = '';
  let resolvedPlan = '';

  if (eventType === 'invoice.payment_failed') {
    const invoice = event.data?.object || {};
    billingCustomerId = String(invoice.customer || '').trim();
    const tenant = await findTenantForBillingSync({
      tenantId: invoice.metadata?.tenantId,
      tenantKey: invoice.metadata?.tenantKey,
      billingCustomerId,
    });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found for invoice.payment_failed' });
    }
    targetTenantId = String(tenant._id);
    patch = {
      billingProvider: 'stripe',
      billingCustomerId: billingCustomerId || tenant.billingCustomerId || '',
      status: 'suspended',
      statusReason: 'Billing status: past_due (invoice.payment_failed)',
    };
    const linePriceId = invoice.lines?.data?.[0]?.price?.id;
    resolvedPlan = resolvePlanFromStripePriceId(linePriceId);
    if (resolvedPlan) patch.plan = resolvedPlan;
  } else if (eventType === 'customer.subscription.updated') {
    const sub = event.data?.object || {};
    billingCustomerId = String(sub.customer || '').trim();
    const tenant = await findTenantForBillingSync({
      tenantId: sub.metadata?.tenantId,
      tenantKey: sub.metadata?.tenantKey,
      billingCustomerId,
    });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found for subscription.updated' });
    }
    targetTenantId = String(tenant._id);
    const stripeStatus = String(sub.status || '').trim().toLowerCase();
    const statusPatch = normalizeBillingStatusToTenantPatch(stripeStatus);
    patch = {
      billingProvider: 'stripe',
      billingCustomerId: billingCustomerId || tenant.billingCustomerId || '',
      ...statusPatch,
    };
    const linePriceId = sub.items?.data?.[0]?.price?.id;
    resolvedPlan = resolvePlanFromStripePriceId(linePriceId);
    if (resolvedPlan) patch.plan = resolvedPlan;
    if (sub.current_period_end) {
      const trialEnd = new Date(Number(sub.current_period_end) * 1000);
      if (!Number.isNaN(trialEnd.getTime())) patch.trialEndDate = trialEnd;
    }
  } else if (eventType === 'customer.subscription.deleted') {
    const sub = event.data?.object || {};
    billingCustomerId = String(sub.customer || '').trim();
    const tenant = await findTenantForBillingSync({
      tenantId: sub.metadata?.tenantId,
      tenantKey: sub.metadata?.tenantKey,
      billingCustomerId,
    });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found for subscription.deleted' });
    }
    targetTenantId = String(tenant._id);
    patch = {
      billingProvider: 'stripe',
      billingCustomerId: billingCustomerId || tenant.billingCustomerId || '',
      status: 'suspended',
      statusReason: 'Billing status: canceled (customer.subscription.deleted)',
    };
  } else {
    // Explicitly acknowledge unhandled lifecycle events to avoid Stripe retries.
    return res.json({ success: true, ignored: true, eventType });
  }

  const updated = await Tenant.findByIdAndUpdate(targetTenantId, { $set: patch }, { new: true });
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  await writeSystemBillingAudit('tenant.billing.stripe_event', updated, {
    eventType,
    billingProvider: updated.billingProvider,
    billingCustomerId: updated.billingCustomerId || undefined,
    status: updated.status,
    plan: updated.plan,
    mappedPlan: resolvedPlan || undefined,
  });

  return res.json({ success: true });
});

module.exports = { billingWebhookSync, stripeWebhook };
