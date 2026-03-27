const { randomUUID } = require('crypto');
const QRCode = require('qrcode');
const ProductionJob = require('../models/ProductionJob');
const Order = require('../models/Order');
const BOM = require('../models/BOM');
const StockMovement = require('../models/StockMovement');
const StockReservation = require('../models/StockReservation');
const asyncHandler = require('../middleware/asyncHandler');
const { postProductionCompletion } = require('../services/productionInventoryService');
const { applyMovement } = require('../services/stockService');
const {
  buildOperationsFromBom,
  ensureTravelerToken,
} = require('../services/jobOperationsService');
const {
  createReservation,
  releaseJobReservations,
  listActiveForJob,
} = require('../services/reservationService');
const { byTenant } = require('../utils/tenantQuery');

function computeCostSnapshot(job) {
  const laborMin = (job.operations || []).reduce((s, o) => s + (o.actualLaborMin || 0), 0);
  const machineMin = (job.operations || []).reduce((s, o) => s + (o.actualMachineMin || 0), 0);
  const opOverhead = (job.operations || []).reduce((s, o) => s + (o.actualOverheadCost || 0), 0);
  const base = job.costing || {};
  const actualLaborCost = Number(base.actualLaborCost || 0);
  const actualMachineCost = Number(base.actualMachineCost || 0);
  const actualOverheadCost = Number(base.actualOverheadCost || 0) + opOverhead;
  const plannedTotal =
    Number(base.plannedLaborCost || 0) +
    Number(base.plannedMachineCost || 0) +
    Number(base.plannedOverheadCost || 0);
  const actualTotal = actualLaborCost + actualMachineCost + actualOverheadCost;
  return {
    laborMin,
    machineMin,
    plannedTotal,
    actualTotal,
    variance: actualTotal - plannedTotal,
    ...base,
    actualLaborCost,
    actualMachineCost,
    actualOverheadCost,
  };
}

exports.getJobs = asyncHandler(async (req, res, next) => {
  const jobs = await ProductionJob.find(byTenant(req)).populate('bom').lean();
  for (const j of jobs) j.costSummary = computeCostSnapshot(j);
  res.status(200).json({ success: true, count: jobs.length, data: jobs });
});

exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id })).populate('bom').lean();
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  job.costSummary = computeCostSnapshot(job);
  res.status(200).json({ success: true, data: job });
});

exports.createJob = asyncHandler(async (req, res, next) => {
  const payload = { ...req.body, inventoryPosted: false };
  delete payload.tenantId;
  if (payload.status === 'Completed') {
    payload.inventoryPosted = false;
  }
  const bom = await BOM.findOne(byTenant(req, { _id: payload.bom }));
  if (!bom) {
    return res.status(400).json({ success: false, message: 'BOM not found' });
  }
  payload.operations = buildOperationsFromBom(bom, payload.quantity);
  payload.travelerToken = randomUUID();
  const job = await ProductionJob.create({ ...payload, tenantId: req.tenantId });

  if (job.status === 'Completed' && !job.inventoryPosted) {
    try {
      await postProductionCompletion(job);
    } catch (e) {
      await ProductionJob.findOneAndDelete(byTenant(req, { _id: job._id }));
      return res.status(400).json({
        success: false,
        message: e.message || 'Could not complete job (inventory)',
      });
    }
    const updated = await ProductionJob.findOne(byTenant(req, { _id: job._id })).populate('bom');
    return res.status(201).json({ success: true, data: updated });
  }

  res.status(201).json({ success: true, data: job });
});

exports.createJobFromOrder = asyncHandler(async (req, res) => {
  const {
    orderId,
    lineIndex,
    quantity,
    jobId,
    dueDate,
    priority,
    assignedTo,
    notes,
  } = req.body;

  const idx = Number(lineIndex);
  if (!orderId || Number.isNaN(idx) || idx < 0) {
    return res.status(400).json({
      success: false,
      message: 'orderId and lineIndex are required',
    });
  }

  const order = await Order.findOne(byTenant(req, { _id: orderId })).populate('items.product');
  if (!order || !order.items[idx]) {
    return res.status(404).json({ success: false, message: 'Order or line not found' });
  }

  const line = order.items[idx];
  const existingJob = line.productionJob?._id || line.productionJob;
  if (existingJob) {
    return res.status(400).json({
      success: false,
      message:
        'This line already has a linked job. Cancel/delete that job on the line first if you need a new one.',
    });
  }
  const pid = line.product._id || line.product;
  const bom =
    (await BOM.findOne(byTenant(req, { outputProduct: pid, status: 'Active' }))) ||
    (await BOM.findOne(byTenant(req, { outputProduct: pid })));

  if (!bom) {
    return res.status(400).json({
      success: false,
      message: 'No BOM with this product as finished good. Create a BOM first.',
    });
  }

  const lineQty = line.quantity;
  const want = quantity != null ? Number(quantity) : lineQty;
  const qty = Math.max(1, Math.min(want, lineQty));

  const jid =
    jobId ||
    `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const job = await ProductionJob.create({
    tenantId: req.tenantId,
    jobId: jid,
    bom: bom._id,
    quantity: qty,
    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 86400000),
    status: 'Scheduled',
    priority: priority || 'Medium',
    assignedTo: assignedTo || '',
    notes: notes || `From order ${order._id} line ${idx + 1}`,
    sourceOrder: order._id,
    sourceLineIndex: idx,
    inventoryPosted: false,
    materialsReserved: false,
    operations: buildOperationsFromBom(bom, qty),
    travelerToken: randomUUID(),
  });

  order.items[idx].productionJob = job._id;
  await order.save();

  const populated = await ProductionJob.findOne(byTenant(req, { _id: job._id })).populate('bom');
  res.status(201).json({ success: true, data: populated });
});

exports.reserveJobMaterials = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  if (['Completed', 'Cancelled'].includes(job.status)) {
    return res.status(400).json({
      success: false,
      message: 'Cannot reserve materials for completed or cancelled jobs',
    });
  }

  const bom = await BOM.findOne(byTenant(req, { _id: job.bom })).populate('components.product');
  if (!bom) {
    return res.status(404).json({ success: false, message: 'BOM not found' });
  }

  await releaseJobReservations(job._id, req.tenantId);
  const createdIds = [];

  try {
    for (const c of bom.components) {
      const pid = c.product._id || c.product;
      const need = c.quantity * job.quantity;
      if (need <= 0) continue;
      const doc = await createReservation({
        tenantId: req.tenantId,
        productId: pid,
        quantity: need,
        refType: 'ProductionJob',
        refId: job._id,
        note: `Job ${job.jobId} material`,
      });
      createdIds.push(doc._id);
    }
  } catch (e) {
    if (createdIds.length) {
      await StockReservation.deleteMany(byTenant(req, { _id: { $in: createdIds } }));
    }
    return res.status(400).json({
      success: false,
      message: e.message || 'Failed to reserve materials',
    });
  }

  await ProductionJob.findOneAndUpdate(byTenant(req, { _id: job._id }), {
    materialsReserved: true,
  });
  const list = await listActiveForJob(job._id, req.tenantId);
  res.json({ success: true, data: list });
});

exports.updateJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const prevStatus = job.status;
  const nextStatus = req.body.status !== undefined ? req.body.status : prevStatus;
  const body = { ...req.body };
  delete body.tenantId;

  if (nextStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
    await releaseJobReservations(job._id, req.tenantId);
    body.materialsReserved = false;
  }

  if (
    nextStatus === 'Completed' &&
    prevStatus !== 'Completed' &&
    !job.inventoryPosted
  ) {
    try {
      await postProductionCompletion(job);
      body.inventoryPosted = true;
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: e.message || 'Cannot complete job: inventory posting failed',
      });
    }
  }

  const updated = await ProductionJob.findOneAndUpdate(byTenant(req, { _id: req.params.id }), body, {
    new: true,
    runValidators: true,
  }).populate('bom');

  res.status(200).json({ success: true, data: updated });
});

exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  await releaseJobReservations(job._id, req.tenantId);

  if (job.sourceOrder != null && job.sourceLineIndex != null) {
    const order = await Order.findOne(byTenant(req, { _id: job.sourceOrder }));
    if (order && order.items[job.sourceLineIndex]) {
      const pj = order.items[job.sourceLineIndex].productionJob;
      if (pj && pj.toString() === job._id.toString()) {
        order.items[job.sourceLineIndex].productionJob = null;
        await order.save();
      }
    }
  }

  await ProductionJob.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  res.status(200).json({ success: true, data: {} });
});

function getOperation(job, opIndex) {
  const i = Number(opIndex);
  if (!job.operations?.length || Number.isNaN(i) || i < 0 || i >= job.operations.length) {
    return null;
  }
  return { index: i, op: job.operations[i] };
}

function validateNonNegativeNumber(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${field} must be >= 0`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

exports.syncJobOperations = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const bom = await BOM.findOne(byTenant(req, { _id: job.bom }));
  if (!bom) return res.status(404).json({ success: false, message: 'BOM not found' });
  job.operations = buildOperationsFromBom(bom, job.quantity);
  ensureTravelerToken(job);
  await job.save();
  const populated = await ProductionJob.findOne(byTenant(req, { _id: job._id })).populate('bom');
  res.json({ success: true, data: populated });
});

exports.startOperation = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  if (got.op.status === 'done') {
    return res.status(400).json({ success: false, message: 'Operation already completed' });
  }
  got.op.status = 'active';
  got.op.startedAt = new Date();
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

exports.completeOperation = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  if (got.op.qualityRequired && !['passed', 'waived'].includes(got.op.qualityStatus || 'pending')) {
    return res.status(400).json({
      success: false,
      message: 'Quality check required before completing this operation',
    });
  }
  if ((got.op.wipOutQty || 0) <= 0 && (got.op.wipInQty || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: 'WIP output quantity must be logged before completion',
    });
  }
  got.op.status = 'done';
  got.op.completedAt = new Date();
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

exports.logOperationTime = asyncHandler(async (req, res) => {
  const minutes = Number(req.body.minutes);
  if (!minutes || minutes <= 0) {
    return res.status(400).json({ success: false, message: 'minutes > 0 required' });
  }
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  got.op.timeLogs.push({
    minutes,
    note: req.body.note || '',
    loggedAt: new Date(),
  });
  got.op.actualLaborMin = (got.op.actualLaborMin || 0) + minutes;
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

exports.logOperationWip = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  const wipInQty = req.body.wipInQty != null ? validateNonNegativeNumber(req.body.wipInQty, 'wipInQty') : null;
  const wipOutQty = req.body.wipOutQty != null ? validateNonNegativeNumber(req.body.wipOutQty, 'wipOutQty') : null;
  if (wipInQty == null && wipOutQty == null) {
    return res.status(400).json({ success: false, message: 'wipInQty or wipOutQty is required' });
  }
  if (wipInQty != null) got.op.wipInQty = wipInQty;
  if (wipOutQty != null) got.op.wipOutQty = wipOutQty;
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

exports.recordOperationQuality = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  const status = String(req.body.status || '').toLowerCase();
  const map = { pass: 'passed', passed: 'passed', fail: 'failed', failed: 'failed', waive: 'waived', waived: 'waived' };
  const normalized = map[status];
  if (!normalized) {
    return res.status(400).json({ success: false, message: 'status must be pass|fail|waive' });
  }
  got.op.qualityStatus = normalized;
  got.op.qualityRequired = true;
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

exports.issueJobMaterial = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const productId = req.body.productId;
  const quantity = Number(req.body.quantity);
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'productId and quantity > 0 required' });
  }
  const mv = await applyMovement(null, {
    tenantId: req.tenantId,
    productId,
    delta: -quantity,
    movementType: 'production_issue',
    referenceType: 'ProductionJob',
    referenceId: job._id,
    note: req.body.note || `Issue to job ${job.jobId}`,
  });
  job.materialTransactions = job.materialTransactions || [];
  job.materialTransactions.push({
    product: productId,
    quantity,
    txnType: 'issue',
    operationIndex: req.body.operationIndex != null ? Number(req.body.operationIndex) : null,
    note: String(req.body.note || ''),
    movementId: mv?._id || null,
    createdAt: new Date(),
  });
  await job.save();
  res.status(201).json({ success: true, data: job });
});

exports.returnJobMaterial = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const productId = req.body.productId;
  const quantity = Number(req.body.quantity);
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'productId and quantity > 0 required' });
  }
  const mv = await applyMovement(null, {
    tenantId: req.tenantId,
    productId,
    delta: quantity,
    movementType: 'production_return',
    referenceType: 'ProductionJob',
    referenceId: job._id,
    note: req.body.note || `Return from job ${job.jobId}`,
  });
  job.materialTransactions = job.materialTransactions || [];
  job.materialTransactions.push({
    product: productId,
    quantity,
    txnType: 'return',
    operationIndex: req.body.operationIndex != null ? Number(req.body.operationIndex) : null,
    note: String(req.body.note || ''),
    movementId: mv?._id || null,
    createdAt: new Date(),
  });
  await job.save();
  res.status(201).json({ success: true, data: job });
});

exports.updateJobCosting = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const next = { ...(job.costing?.toObject?.() || job.costing || {}) };
  const keys = [
    'plannedLaborCost',
    'plannedMachineCost',
    'plannedOverheadCost',
    'actualLaborCost',
    'actualMachineCost',
    'actualOverheadCost',
  ];
  for (const k of keys) {
    if (req.body[k] !== undefined) next[k] = validateNonNegativeNumber(req.body[k], k);
  }
  job.costing = next;
  await job.save();
  const plain = job.toObject();
  plain.costSummary = computeCostSnapshot(plain);
  res.json({ success: true, data: plain });
});

exports.getCapacityPlan = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 3 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 14 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }
  const capacityPerDay = Number(req.query.capacityPerDayMinutes) > 0 ? Number(req.query.capacityPerDayMinutes) : 480;
  const jobs = await ProductionJob.find(
    byTenant(req, {
      status: { $in: ['Scheduled', 'In Progress', 'On Hold'] },
      dueDate: { $gte: from, $lte: to },
    })
  ).lean();
  const buckets = {};
  for (const j of jobs) {
    const day = new Date(j.plannedStartDate || j.dueDate).toISOString().slice(0, 10);
    const wc = String(j.workCenterCode || j.operations?.[0]?.workCenterCode || 'UNASSIGNED');
    const load = (j.operations || []).reduce((s, o) => s + (o.plannedSetupMin || 0) + (o.plannedRunMin || 0), 0);
    const key = `${day}::${wc}`;
    if (!buckets[key]) buckets[key] = { day, workCenterCode: wc, loadMinutes: 0, jobs: 0 };
    buckets[key].loadMinutes += load;
    buckets[key].jobs += 1;
  }
  const rows = Object.values(buckets).map((b) => ({
    ...b,
    capacityMinutes: capacityPerDay,
    utilizationPct: b.loadMinutes > 0 ? Math.round((b.loadMinutes / capacityPerDay) * 100) : 0,
    overloaded: b.loadMinutes > capacityPerDay,
  }));
  rows.sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.workCenterCode).localeCompare(String(b.workCenterCode)));
  res.json({ success: true, data: rows });
});

exports.getProductionKpis = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }
  const jobs = await ProductionJob.find(
    byTenant(req, {
      createdAt: { $gte: from, $lte: to },
    })
  ).lean();
  const completed = jobs.filter((j) => j.status === 'Completed');
  const throughputQty = completed.reduce((s, j) => s + Number(j.quantity || 0), 0);
  const onTime = completed.filter((j) => {
    const lastCompleted = (j.operations || []).reduce((m, o) => {
      const t = o.completedAt ? new Date(o.completedAt).getTime() : 0;
      return Math.max(m, t);
    }, 0);
    return lastCompleted > 0 && lastCompleted <= new Date(j.dueDate).getTime();
  }).length;
  const totalScrap = jobs.reduce(
    (s, j) => s + (j.operations || []).reduce((k, o) => k + Number(o.scrapQty || 0), 0),
    0
  );
  const totalInput = jobs.reduce(
    (s, j) => s + (j.operations || []).reduce((k, o) => k + Number(o.wipInQty || 0), 0),
    0
  );
  const scheduleAdherencePct = completed.length ? Math.round((onTime / completed.length) * 100) : 0;
  const scrapRatePct = totalInput > 0 ? Math.round((totalScrap / totalInput) * 10000) / 100 : 0;
  res.json({
    success: true,
    data: {
      window: { from: from.toISOString(), to: to.toISOString() },
      jobsCreated: jobs.length,
      jobsCompleted: completed.length,
      throughputQty,
      scheduleAdherencePct,
      scrapRatePct,
      oeeProxyPct: Math.max(0, Math.min(100, Math.round((100 - scrapRatePct) * (scheduleAdherencePct / 100)))),
    },
  });
});

exports.scrapReworkOperation = asyncHandler(async (req, res) => {
  const scrap = Number(req.body.scrapQty) || 0;
  const rework = Number(req.body.reworkQty) || 0;
  if (scrap < 0 || rework < 0) {
    return res.status(400).json({ success: false, message: 'Quantities must be >= 0' });
  }
  const job = await ProductionJob.findOne(byTenant(req, { _id: req.params.id }));
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  const got = getOperation(job, req.params.opIndex);
  if (!got) return res.status(400).json({ success: false, message: 'Invalid operation index' });
  got.op.scrapQty = (got.op.scrapQty || 0) + scrap;
  got.op.reworkQty = (got.op.reworkQty || 0) + rework;
  job.markModified('operations');
  await job.save();
  res.json({ success: true, data: job });
});

function escHtml(x) {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Unauthenticated shop-floor traveler (token is secret). */
exports.getTravelerHtml = asyncHandler(async (req, res) => {
  const job = await ProductionJob.findOne({ travelerToken: req.params.token })
    .populate('bom')
    .populate('sourceOrder');
  if (!job) {
    res.status(404).setHeader('Content-Type', 'text/plain');
    return res.send('Traveler not found');
  }
  const base = `${req.protocol}://${req.get('host')}`;
  const selfUrl = `${base}/api/production/traveler/${req.params.token}.html`;
  let qrSrc = '';
  try {
    qrSrc = await QRCode.toDataURL(selfUrl, { width: 160, margin: 1 });
  } catch {
    qrSrc = '';
  }
  const rows = (job.operations || [])
    .map(
      (op, i) =>
        `<tr><td>${i + 1}</td><td>${escHtml(op.code)}</td><td>${escHtml(op.name)}</td><td>${escHtml(
          op.workCenterCode
        )}</td><td>${escHtml(op.status)}</td><td>${op.actualLaborMin || 0} min</td><td>_______</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Traveler ${escHtml(job.jobId)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:16px auto;padding:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #333;padding:6px}
th{background:#eee}
.sig{height:28px;border-bottom:1px solid #000;display:inline-block;min-width:120px}
@media print{.np{display:none}}
</style></head><body>
<p class="np"><a href="#" onclick="window.print();return false">Print</a></p>
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
<div>
<h1 style="margin:0">Production traveler</h1>
<p><b>Job:</b> ${escHtml(job.jobId)} &nbsp; <b>Qty:</b> ${job.quantity}<br/>
<b>BOM:</b> ${escHtml(job.bom?.partNumber)} ${escHtml(job.bom?.name)}<br/>
<b>Due:</b> ${job.dueDate ? new Date(job.dueDate).toLocaleDateString() : '—'}</p>
</div>
${qrSrc ? `<div><img src="${qrSrc}" alt="QR" width="120" height="120"/><div style="font-size:10px;color:#666">Scan to reopen</div></div>` : ''}
</div>
<table>
<tr><th>#</th><th>Code</th><th>Operation</th><th>WC</th><th>Status</th><th>Labor</th><th>Sign-off</th></tr>
${rows}
</table>
<p style="margin-top:24px;font-size:12px"><b>Scrap / rework:</b> record in MES or job detail.</p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
