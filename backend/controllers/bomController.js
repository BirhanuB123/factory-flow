const BOM = require('../models/BOM');
const asyncHandler = require('../middleware/asyncHandler');
const audit = require('../services/auditService');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Get all BOMs
// @route   GET /api/boms
// @access  Public
exports.getBoms = asyncHandler(async (req, res, next) => {
  const boms = await BOM.find(byTenant(req))
    .populate('components.product')
    .populate('outputProduct', 'name sku unit stock');
  res.status(200).json({ success: true, count: boms.length, data: boms });
});


// @access  Public
exports.getBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.findOne(byTenant(req, { _id: req.params.id }))
    .populate('components.product')
    .populate('outputProduct', 'name sku unit stock');
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  res.status(200).json({ success: true, data: bom });
});

exports.createBom = asyncHandler(async (req, res, next) => {
  if (!req.body.outputProduct) {
    return res.status(400).json({
      success: false,
      message: 'outputProduct (finished good) is required',
    });
  }
  const body = { ...req.body };
  delete body.tenantId;
  const bom = await BOM.create({ ...body, tenantId: req.tenantId });
  const populated = await BOM.findOne(byTenant(req, { _id: bom._id }))
    .populate('components.product')
    .populate('outputProduct', 'name sku unit stock');
  await audit.record({
    req,
    action: 'bom.create',
    entityType: 'BOM',
    entityId: bom._id,
    summary: { partNumber: bom.partNumber, name: bom.name },
  });
  res.status(201).json({ success: true, data: populated });
});

exports.updateBom = asyncHandler(async (req, res, next) => {
  const patch = { ...req.body };
  delete patch.tenantId;
  const bom = await BOM.findOneAndUpdate(byTenant(req, { _id: req.params.id }), patch, {
    new: true,
    runValidators: true
  })
    .populate('components.product')
    .populate('outputProduct', 'name sku unit stock');
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  await audit.record({
    req,
    action: 'bom.update',
    entityType: 'BOM',
    entityId: bom._id,
    summary: { partNumber: bom.partNumber },
  });
  res.status(200).json({ success: true, data: bom });
});

exports.deleteBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  await audit.record({
    req,
    action: 'bom.delete',
    entityType: 'BOM',
    entityId: bom._id,
    summary: { partNumber: bom.partNumber },
  });
  res.status(200).json({ success: true, data: {} });
});
