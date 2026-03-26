const PayrollMonthClose = require('../models/PayrollMonthClose');

async function isPayrollMonthClosed(tenantId, month) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return false;
  const doc = await PayrollMonthClose.findOne({ tenantId, month: m }).lean();
  return !!doc;
}

/**
 * @throws {Error} statusCode 403 if month is closed and user is not Admin
 */
async function assertPayrollMonthEditable(req, month) {
  if (!req.user || req.user.role === 'Admin') return;
  const closed = await isPayrollMonthClosed(req.tenantId, month);
  if (closed) {
    const err = new Error('This payroll month is closed. Only an Admin can change payroll records.');
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  isPayrollMonthClosed,
  assertPayrollMonthEditable,
};
