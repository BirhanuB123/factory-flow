const asyncHandler = require('../middleware/asyncHandler');
const AuditLog = require('../models/AuditLog');
const { byTenant } = require('../utils/tenantQuery');

exports.listAuditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const skip = Number(req.query.skip) || 0;
  const filter = byTenant(req);
  if (req.query.action) filter.action = new RegExp(req.query.action, 'i');
  if (req.query.entityType) filter.entityType = req.query.entityType;
  const list = await AuditLog.find(filter)
    .sort({ at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('actor', 'name employeeId role')
    .lean();
  const total = await AuditLog.countDocuments(filter);
  res.json({ success: true, data: list, total, limit, skip });
});
