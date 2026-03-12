const ProductionJob = require('../models/ProductionJob');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all production jobs
// @route   GET /api/production
// @access  Public
exports.getJobs = asyncHandler(async (req, res, next) => {
  const jobs = await ProductionJob.find().populate('bom');
  res.status(200).json({ success: true, count: jobs.length, data: jobs });
});

// @desc    Get single production job
// @route   GET /api/production/:id
// @access  Public
exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findById(req.params.id).populate('bom');
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  res.status(200).json({ success: true, data: job });
});

// @desc    Create new production job
// @route   POST /api/production
// @access  Public
exports.createJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.create(req.body);
  res.status(201).json({ success: true, data: job });
});

// @desc    Update production job
// @route   PUT /api/production/:id
// @access  Public
exports.updateJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('bom');
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  res.status(200).json({ success: true, data: job });
});

// @desc    Delete production job
// @route   DELETE /api/production/:id
// @access  Public
exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findByIdAndDelete(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
