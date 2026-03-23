const Tenant = require('../models/Tenant');

function formatDateOnly(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function buildBlockedReason(status, statusReason, trialEndDate) {
  const s = String(status || '').toLowerCase();
  const reason = String(statusReason || '').trim();
  if (s === 'suspended') {
    return reason ? `Tenant is suspended: ${reason}` : 'Tenant is suspended';
  }
  if (s === 'archived') {
    return reason ? `Tenant is archived: ${reason}` : 'Tenant is archived';
  }
  if (s === 'trial') {
    const stamp = formatDateOnly(trialEndDate);
    if (reason) return `Tenant trial expired: ${reason}`;
    if (stamp) return `Tenant trial expired on ${stamp}`;
    return 'Tenant trial expired';
  }
  return reason ? `Tenant is ${s || 'unavailable'}: ${reason}` : `Tenant is ${s || 'unavailable'}`;
}

/**
 * Valid statuses for normal tenant access are active|trial.
 * If trial is expired, this function auto-suspends tenant and returns blocked.
 */
async function ensureTenantAccess(tenantId) {
  const t = await Tenant.findById(tenantId).select('status trialEndDate statusReason');
  if (!t) return { ok: false, reason: 'Tenant not found', code: 400 };

  const status = String(t.status || '').toLowerCase();
  if (status === 'active') return { ok: true };

  if (status === 'trial') {
    const trialEnd = t.trialEndDate ? new Date(t.trialEndDate) : null;
    const expired = !!trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd.getTime() <= Date.now();
    if (!expired) return { ok: true };

    const reason =
      String(t.statusReason || '').trim() ||
      `Trial expired on ${formatDateOnly(trialEnd) || new Date().toISOString().slice(0, 10)}`;
    await Tenant.updateOne(
      { _id: tenantId, status: 'trial' },
      { $set: { status: 'suspended', statusReason: reason } }
    );
    return { ok: false, reason: buildBlockedReason('trial', reason, trialEnd), code: 403 };
  }

  return { ok: false, reason: buildBlockedReason(status, t.statusReason, t.trialEndDate), code: 403 };
}

/**
 * Super admins may operate in suspended/archived tenants (support / platform).
 * Only verify the tenant id exists in the database.
 */
async function ensureTenantExists(tenantId) {
  const exists = await Tenant.exists({ _id: tenantId });
  if (!exists) return { ok: false, reason: 'Tenant not found', code: 400 };
  return { ok: true };
}

module.exports = {
  ensureTenantAccess,
  ensureTenantExists,
};
