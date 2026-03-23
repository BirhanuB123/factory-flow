const asyncHandler = require('../middleware/asyncHandler');
const WorkCenter = require('../models/WorkCenter');
const Asset = require('../models/Asset');
const PmSchedule = require('../models/PmSchedule');
const DowntimeEvent = require('../models/DowntimeEvent');
const QualityInspection = require('../models/QualityInspection');
const NonConformance = require('../models/NonConformance');
const { byTenant } = require('../utils/tenantQuery');

exports.listWorkCenters = asyncHandler(async (req, res) => {
  const list = await WorkCenter.find(byTenant(req)).sort({ code: 1 }).lean();
  res.json({ success: true, data: list });
});

exports.createWorkCenter = asyncHandler(async (req, res) => {
  const { code, name, hoursPerDay, notes } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'code and name required' });
  }
  const wc = await WorkCenter.create({
    tenantId: req.tenantId,
    code: String(code).toUpperCase().trim(),
    name: String(name).trim(),
    hoursPerDay: hoursPerDay != null ? Number(hoursPerDay) : 8,
    notes: notes || '',
  });
  res.status(201).json({ success: true, data: wc });
});

exports.listAssets = asyncHandler(async (req, res) => {
  const list = await Asset.find(byTenant(req))
    .populate('workCenter', 'code name')
    .sort({ code: 1 })
    .lean();
  res.json({ success: true, data: list });
});

exports.createAsset = asyncHandler(async (req, res) => {
  const { code, name, workCenter, manufacturer, serialNumber, notes } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'code and name required' });
  }
  const a = await Asset.create({
    tenantId: req.tenantId,
    code: String(code).trim(),
    name: String(name).trim(),
    workCenter: workCenter || null,
    manufacturer: manufacturer || '',
    serialNumber: serialNumber || '',
    notes: notes || '',
  });
  res.status(201).json({ success: true, data: a });
});

exports.listPmSchedules = asyncHandler(async (req, res) => {
  const list = await PmSchedule.find(byTenant(req, { active: true }))
    .populate('asset', 'code name')
    .sort({ nextDueDate: 1 })
    .lean();
  res.json({ success: true, data: list });
});

exports.createPmSchedule = asyncHandler(async (req, res) => {
  const { asset, title, frequencyDays, nextDueDate, notes } = req.body;
  if (!asset || !title || !frequencyDays || !nextDueDate) {
    return res.status(400).json({
      success: false,
      message: 'asset, title, frequencyDays, nextDueDate required',
    });
  }
  const pm = await PmSchedule.create({
    tenantId: req.tenantId,
    asset,
    title,
    frequencyDays: Number(frequencyDays),
    nextDueDate: new Date(nextDueDate),
    notes: notes || '',
  });
  res.status(201).json({ success: true, data: pm });
});

exports.completePm = asyncHandler(async (req, res) => {
  const pm = await PmSchedule.findOne(byTenant(req, { _id: req.params.id }));
  if (!pm) return res.status(404).json({ success: false, message: 'PM schedule not found' });
  pm.lastCompletedAt = new Date();
  const next = new Date(pm.lastCompletedAt);
  next.setDate(next.getDate() + pm.frequencyDays);
  pm.nextDueDate = next;
  await pm.save();
  res.json({ success: true, data: pm });
});

exports.listDowntime = asyncHandler(async (req, res) => {
  const { assetId, limit = '50' } = req.query;
  const q = byTenant(req);
  if (assetId) q.asset = assetId;
  const list = await DowntimeEvent.find(q)
    .populate('asset', 'code name')
    .sort({ startedAt: -1 })
    .limit(Math.min(200, parseInt(limit, 10) || 50))
    .lean();
  res.json({ success: true, data: list });
});

exports.createDowntime = asyncHandler(async (req, res) => {
  const { asset, startedAt, reasonCode, description, reportedBy } = req.body;
  if (!asset) {
    return res.status(400).json({ success: false, message: 'asset required' });
  }
  const d = await DowntimeEvent.create({
    tenantId: req.tenantId,
    asset,
    startedAt: startedAt ? new Date(startedAt) : new Date(),
    reasonCode: reasonCode || 'other',
    description: description || '',
    reportedBy: reportedBy || '',
  });
  res.status(201).json({ success: true, data: d });
});

exports.endDowntime = asyncHandler(async (req, res) => {
  const d = await DowntimeEvent.findOne(byTenant(req, { _id: req.params.id }));
  if (!d) return res.status(404).json({ success: false, message: 'Not found' });
  d.endedAt = new Date();
  await d.save();
  res.json({ success: true, data: d });
});

exports.listInspections = asyncHandler(async (req, res) => {
  const list = await QualityInspection.find(byTenant(req))
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('product', 'sku name')
    .lean();
  res.json({ success: true, data: list });
});

exports.createInspection = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  delete body.tenantId;
  if (!body.inspectionType) {
    return res.status(400).json({ success: false, message: 'inspectionType required' });
  }
  const doc = await QualityInspection.create({ ...body, tenantId: req.tenantId });
  res.status(201).json({ success: true, data: doc });
});

exports.updateInspection = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  delete patch.tenantId;
  const doc = await QualityInspection.findOneAndUpdate(
    byTenant(req, { _id: req.params.id }),
    patch,
    {
      new: true,
      runValidators: true,
    }
  );
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: doc });
});

exports.listNonConformances = asyncHandler(async (req, res) => {
  const list = await NonConformance.find(byTenant(req))
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('product', 'sku name')
    .lean();
  res.json({ success: true, data: list });
});

exports.createNonConformance = asyncHandler(async (req, res) => {
  const { title, description, source, inspection, productionJob, product, lotNumber } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'title required' });
  }
  const n = await NonConformance.countDocuments(byTenant(req));
  const ncNumber = `NC-${Date.now()}-${(n % 1000).toString().padStart(3, '0')}`;
  const doc = await NonConformance.create({
    tenantId: req.tenantId,
    ncNumber,
    title,
    description: description || '',
    source: source || 'in_process',
    inspection: inspection || null,
    productionJob: productionJob || null,
    product: product || null,
    lotNumber: lotNumber || '',
  });
  res.status(201).json({ success: true, data: doc });
});

exports.updateNonConformance = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  delete patch.tenantId;
  const doc = await NonConformance.findOneAndUpdate(
    byTenant(req, { _id: req.params.id }),
    patch,
    {
      new: true,
      runValidators: true,
    }
  );
  if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: doc });
});
