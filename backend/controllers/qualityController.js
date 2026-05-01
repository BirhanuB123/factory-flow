const asyncHandler = require('../middleware/asyncHandler');
const QualityChecklist = require('../models/QualityChecklist');
const QualityInspection = require('../models/QualityInspection');
const ProductionJob = require('../models/ProductionJob');
const { byTenant } = require('../utils/tenantQuery');

exports.listChecklists = asyncHandler(async (req, res) => {
  const list = await QualityChecklist.find(byTenant(req)).sort({ name: 1 }).lean();
  res.json({ success: true, data: list });
});

exports.createChecklist = asyncHandler(async (req, res) => {
  const { name, description, inspectionType, items } = req.body;
  if (!name || !items || !items.length) {
    return res.status(400).json({ success: false, message: 'name and items required' });
  }
  const checklist = await QualityChecklist.create({
    tenantId: req.tenantId,
    name,
    description,
    inspectionType,
    items,
  });
  res.status(201).json({ success: true, data: checklist });
});

exports.updateChecklist = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  delete patch.tenantId;
  const doc = await QualityChecklist.findOneAndUpdate(
    byTenant(req, { _id: req.params.id }),
    patch,
    { new: true, runValidators: true }
  );
  if (!doc) return res.status(404).json({ success: false, message: 'Checklist not found' });
  res.json({ success: true, data: doc });
});

exports.submitInspection = asyncHandler(async (req, res) => {
  const {
    productionJob,
    operationIndex,
    inspectionType,
    checklist,
    checklistResults,
    notes,
    quantityInspected,
    inspector,
  } = req.body;

  if (!inspectionType || !status) {
    // Note: status will be calculated based on checklistResults if provided
  }

  // Auto-determine overall status if multiple results are provided
  let overallStatus = 'pass';
  if (checklistResults && checklistResults.some(r => r.status === 'fail')) {
    overallStatus = 'fail';
  }

  const inspection = await QualityInspection.create({
    tenantId: req.tenantId,
    productionJob: productionJob || null,
    operationIndex: operationIndex != null ? Number(operationIndex) : null,
    inspectionType,
    checklist: checklist || null,
    checklistResults: checklistResults || [],
    status: overallStatus,
    notes: notes || '',
    quantityInspected: quantityInspected || 0,
    inspector: inspector || req.user.name || 'Unknown',
    inspectedAt: new Date(),
  });

  // If linked to a job operation, update the operation's quality status
  if (productionJob && operationIndex != null) {
    const job = await ProductionJob.findOne(byTenant(req, { _id: productionJob }));
    if (job && job.operations[operationIndex]) {
      job.operations[operationIndex].qualityStatus = overallStatus === 'pass' ? 'passed' : 'failed';
      job.markModified('operations');
      await job.save();
    }
  }

  res.status(201).json({ success: true, data: inspection });
});

exports.getChecklistForJob = asyncHandler(async (req, res) => {
    // Simple logic: find active checklists for the given type
    const { type } = req.query; // incoming, in_process, final
    const q = { active: true };
    if (type) q.inspectionType = type;
    
    const list = await QualityChecklist.find(byTenant(req, q)).lean();
    res.json({ success: true, data: list });
});
