const asyncHandler = require('../middleware/asyncHandler');
const SavedView = require('../models/SavedView');
const { byTenant } = require('../utils/tenantQuery');

const MODULES = ['orders', 'inventory', 'production', 'finance_ar', 'finance_ap'];

exports.list = asyncHandler(async (req, res) => {
  const { module } = req.query;
  const q = byTenant(req, { user: req.user._id });
  if (module && MODULES.includes(module)) q.module = module;
  const list = await SavedView.find(q).sort({ updatedAt: -1 });
  res.json({ success: true, data: list });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, module, filters } = req.body;
  if (!name || !module || !MODULES.includes(module)) {
    return res.status(400).json({
      success: false,
      message: `name and module required (one of: ${MODULES.join(', ')})`,
    });
  }
  const v = await SavedView.create({
    user: req.user._id,
    name: String(name).trim(),
    module,
    filters: filters && typeof filters === 'object' ? filters : {},
  });
  res.status(201).json({ success: true, data: v });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await SavedView.findOneAndDelete(
    byTenant(req, {
      _id: req.params.id,
      user: req.user._id,
    })
  );
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: {} });
});
