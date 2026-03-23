const asyncHandler = require('../middleware/asyncHandler');
const ApprovalRequest = require('../models/ApprovalRequest');
const Order = require('../models/Order');
const { record: auditRecord } = require('../services/auditService');
const { byTenant } = require('../utils/tenantQuery');

exports.listPending = asyncHandler(async (req, res) => {
  const list = await ApprovalRequest.find(byTenant(req, { status: 'pending' }))
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'name employeeId')
    .lean();
  res.json({ success: true, data: list });
});

exports.approve = asyncHandler(async (req, res) => {
  const { note } = req.body;
  const ar = await ApprovalRequest.findOne(byTenant(req, { _id: req.params.id }));
  if (!ar || ar.status !== 'pending') {
    return res.status(404).json({ success: false, message: 'Request not found or not pending' });
  }
  ar.status = 'approved';
  ar.decidedBy = req.user._id;
  ar.decidedAt = new Date();
  ar.note = note || ar.note;
  await ar.save();

  if (ar.entityType === 'Order') {
    await Order.findOneAndUpdate(byTenant(req, { _id: ar.entityId }), {
      approvalStatus: 'approved',
      pendingApprovalId: null,
    });
  }
  await auditRecord({
    req,
    action: 'approval.approve',
    entityType: 'ApprovalRequest',
    entityId: ar._id,
    summary: { type: ar.type, entityId: String(ar.entityId) },
  });
  res.json({ success: true, data: ar });
});

exports.reject = asyncHandler(async (req, res) => {
  const { note } = req.body;
  const ar = await ApprovalRequest.findOne(byTenant(req, { _id: req.params.id }));
  if (!ar || ar.status !== 'pending') {
    return res.status(404).json({ success: false, message: 'Request not found or not pending' });
  }
  ar.status = 'rejected';
  ar.decidedBy = req.user._id;
  ar.decidedAt = new Date();
  ar.note = note || '';
  await ar.save();

  if (ar.entityType === 'Order') {
    await Order.findOneAndUpdate(byTenant(req, { _id: ar.entityId }), {
      approvalStatus: 'rejected',
      pendingApprovalId: null,
    });
  }
  await auditRecord({
    req,
    action: 'approval.reject',
    entityType: 'ApprovalRequest',
    entityId: ar._id,
    summary: { type: ar.type, note },
  });
  res.json({ success: true, data: ar });
});
