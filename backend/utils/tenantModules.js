/**
 * Tenant module flags (feature toggles per company).
 * Use `requireTenantModule('hr')` etc. on routes after `withTenant` when you want hard blocks.
 */

const MODULE_FLAG_KEYS = Object.freeze([
  'manufacturing',
  'inventory',
  'sales',
  'procurement',
  'finance',
  'hr',
]);

function defaultModuleFlagsObject() {
  return MODULE_FLAG_KEYS.reduce((acc, k) => {
    acc[k] = true;
    return acc;
  }, {});
}

/** Full flag object with defaults for missing / invalid `raw` from Mongo. */
function normalizeModuleFlags(raw) {
  const base = defaultModuleFlagsObject();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of MODULE_FLAG_KEYS) {
    if (typeof raw[k] === 'boolean') base[k] = raw[k];
  }
  return base;
}

/**
 * Merge partial patch (only boolean keys sent) onto existing tenant flags.
 * @param {Record<string, unknown>|null|undefined} existingFromDb
 * @param {Record<string, unknown>} patch from req.body.moduleFlags
 */
function mergeModuleFlagsPatch(existingFromDb, patch) {
  const current = normalizeModuleFlags(existingFromDb);
  if (!patch || typeof patch !== 'object') return current;
  for (const k of MODULE_FLAG_KEYS) {
    if (typeof patch[k] === 'boolean') current[k] = patch[k];
  }
  return current;
}

/**
 * Express middleware: 403 if tenant has flag false. Requires `req.tenantId` (after withTenant).
 * @param {typeof MODULE_FLAG_KEYS[number]} moduleKey
 */
function requireTenantModule(moduleKey) {
  const Tenant = require('../models/Tenant');

  return async function tenantModuleGate(req, res, next) {
    try {
      if (!MODULE_FLAG_KEYS.includes(moduleKey)) {
        const err = new Error(`Invalid module key: ${moduleKey}`);
        err.statusCode = 500;
        return next(err);
      }
      if (!req.tenantId) {
        const err = new Error('Tenant context missing');
        err.statusCode = 403;
        return next(err);
      }

      const t = await Tenant.findById(req.tenantId).select('moduleFlags').lean();
      const flags = normalizeModuleFlags(t?.moduleFlags);
      if (!flags[moduleKey]) {
        const err = new Error(`This module is disabled for your company (${moduleKey})`);
        err.statusCode = 403;
        return next(err);
      }
      req.tenantModuleFlags = flags;
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = {
  MODULE_FLAG_KEYS,
  defaultModuleFlagsObject,
  normalizeModuleFlags,
  mergeModuleFlagsPatch,
  requireTenantModule,
};
