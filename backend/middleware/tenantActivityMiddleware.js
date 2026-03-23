const Tenant = require('../models/Tenant');

const THROTTLE_MS =
  Number.isFinite(parseInt(process.env.TENANT_ACTIVITY_THROTTLE_MS, 10)) &&
  parseInt(process.env.TENANT_ACTIVITY_THROTTLE_MS, 10) >= 5000
    ? parseInt(process.env.TENANT_ACTIVITY_THROTTLE_MS, 10)
    : 60_000;

/**
 * Best-effort: bump `lastApiActivityAt` on the active tenant (throttled) after successful routing.
 * Runs after `withTenant`; must not block the response.
 */
function touchTenantApiActivity(req, res, next) {
  next();
  const tid = req.tenantId;
  if (!tid || req.method === 'OPTIONS') return;

  setImmediate(() => {
    const now = new Date();
    const cutoff = new Date(Date.now() - THROTTLE_MS);
    Tenant.updateOne(
      {
        _id: tid,
        $or: [
          { lastApiActivityAt: { $exists: false } },
          { lastApiActivityAt: null },
          { lastApiActivityAt: { $lt: cutoff } },
        ],
      },
      { $set: { lastApiActivityAt: now } }
    ).catch(() => {});
  });
}

module.exports = { touchTenantApiActivity, THROTTLE_MS };
