const asyncHandler = require('../middleware/asyncHandler');
const Tenant = require('../models/Tenant');

exports.getSettings = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).select('documentSettings legalName displayName currency timezone').lean();
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
  res.json({ success: true, data: tenant });
});

exports.updateDocumentSettings = asyncHandler(async (req, res) => {
  const { documentSettings } = req.body;
  if (!documentSettings) return res.status(400).json({ success: false, message: 'documentSettings required' });

  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    { $set: { documentSettings } },
    { new: true, runValidators: true }
  ).select('documentSettings');

  res.json({ success: true, data: tenant.documentSettings });
});

exports.updateTenantInfo = asyncHandler(async (req, res) => {
    const { legalName, displayName, currency, timezone } = req.body;
    const tenant = await Tenant.findByIdAndUpdate(
        req.tenantId,
        { $set: { legalName, displayName, currency, timezone } },
        { new: true, runValidators: true }
    ).select('legalName displayName currency timezone');
    res.json({ success: true, data: tenant });
});
