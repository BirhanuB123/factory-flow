const { can, P } = require('../config/permissions');

/**
 * Admin + finance_head: full access.
 * finance_viewer + finance:read: GET only (SOX-friendly read-only).
 */
function financeAccess(req, res, next) {
  const r = req.user?.role;
  if (!r) {
    const e = new Error('Unauthorized');
    e.statusCode = 401;
    return next(e);
  }
  if (['Admin', 'finance_head'].includes(r)) return next();
  if (r === 'finance_viewer' && req.method === 'GET') return next();
  if (req.method === 'GET' && can(r, P.FINANCE_READ)) return next();
  const e = new Error('Not authorized for this finance action');
  e.statusCode = 403;
  return next(e);
}

module.exports = financeAccess;
