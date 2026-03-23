/**
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} [extra]
 */
function byTenant(req, extra = {}) {
  if (!req.tenantId) {
    throw new Error('byTenant: req.tenantId missing (withTenant middleware?)');
  }
  return { ...extra, tenantId: req.tenantId };
}

module.exports = { byTenant };
