const BOM = require('../models/BOM');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all BOMs
// @route   GET /api/boms
// @access  Public
exports.getBoms = asyncHandler(async (req, res, next) => {
  const boms = await BOM.find().populate('components.product');
  res.status(200).json({ success: true, count: boms.length, data: boms });
});


// @access  Public
exports.getBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.findById(req.params.id).populate('components.product');
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  res.status(200).json({ success: true, data: bom });
});

exports.createBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.create(req.body);
  res.status(201).json({ success: true, data: bom });
});

exports.updateBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('components.product');
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  res.status(200).json({ success: true, data: bom });
});

exports.deleteBom = asyncHandler(async (req, res, next) => {
  const bom = await BOM.findByIdAndDelete(req.params.id);
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
