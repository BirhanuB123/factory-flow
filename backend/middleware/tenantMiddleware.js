const mongoose = require('mongoose');
const { ensureTenantAccess, ensureTenantExists } = require('../utils/tenantAccess');

function parseTenantHeader(req) {
  const raw = req.headers['x-tenant-id'];
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!mongoose.Types.ObjectId.isValid(v)) return null;
  return v;
}

async function ensureTenantUsable(tenantId) {
  return ensureTenantAccess(tenantId);
}

/**
 * Sets req.tenantId for all authenticated /api routes (after protect).
 * - Normal users: pinned to req.user.tenantId; rejects mismatched X-Tenant-Id.
 * - super_admin: may switch context via X-Tenant-Id (validated against Tenant collection).
 */
async function withTenant(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      const err = new Error('Tenant context requires authenticated user');
      err.statusCode = 401;
      return next(err);
    }

    const headerTenantId = parseTenantHeader(req);
    const isSuper = user.platformRole === 'super_admin';

    if (isSuper) {
      // Subscription / trial gates apply to tenant users only — not super_admin (otherwise
      // a super admin homed on a suspended default company gets 403 on every /api call and
      // the SPA logs them out).
      if (headerTenantId) {
        const check = await ensureTenantExists(headerTenantId);
        if (!check.ok) {
          const err = new Error(
            check.reason === 'Tenant not found' ? 'Invalid tenant id (x-tenant-id)' : check.reason
          );
          err.statusCode = check.code || (check.reason === 'Tenant not found' ? 400 : 403);
          return next(err);
        }
        req.tenantId = headerTenantId;
        req.tenantSwitched = true;
        return next();
      }
      if (user.tenantId) {
        const tid = String(user.tenantId);
        const check = await ensureTenantExists(tid);
        if (!check.ok) {
          const err = new Error(check.reason);
          err.statusCode = check.code || (check.reason === 'Tenant not found' ? 400 : 403);
          return next(err);
        }
        req.tenantId = tid;
        req.tenantSwitched = false;
        return next();
      }
      const err = new Error(
        'Super admin must set default tenant on user or send x-tenant-id header'
      );
      err.statusCode = 403;
      return next(err);
    }

    if (!user.tenantId) {
      const err = new Error(
        'Your account has no company (tenant). Ask an administrator to run the tenant migration.'
      );
      err.statusCode = 403;
      return next(err);
    }

    const tid = String(user.tenantId);
    const check = await ensureTenantUsable(tid);
    if (!check.ok) {
      const err = new Error(check.reason);
      err.statusCode = check.code || (check.reason === 'Tenant not found' ? 400 : 403);
      return next(err);
    }

    if (headerTenantId && headerTenantId !== tid) {
      const err = new Error('Tenant mismatch: remove x-tenant-id or use a super admin account');
      err.statusCode = 403;
      return next(err);
    }

    req.tenantId = tid;
    req.tenantSwitched = false;
    return next();
  } catch (e) {
    return next(e);
  }
}

module.exports = { withTenant, parseTenantHeader };
