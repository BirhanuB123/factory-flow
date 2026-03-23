const asyncHandler = require('../middleware/asyncHandler');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const { byTenant } = require('../utils/tenantQuery');
const { applyMovement } = require('../services/stockService');
const { applyReceiptToAverageCost } = require('../services/costingService');
const { computeLineInventoryUnitCosts } = require('../services/landedCostService');

function attachCostPreview(poDoc) {
  const o = poDoc.toObject ? poDoc.toObject() : { ...poDoc };
  const costs = computeLineInventoryUnitCosts(poDoc);
  o.landedCostPoolTotal =
    (Number(poDoc.importFreight) || 0) +
    (Number(poDoc.importDuty) || 0) +
    (Number(poDoc.importClearing) || 0);
  o.lineInventoryCosts = costs;
  return o;
}

function buildSourcingForCreate(body) {
  const imp = body.supplyType === 'import';
  return {
    importFreight: Math.max(0, Number(body.importFreight) || 0),
    importDuty: Math.max(0, Number(body.importDuty) || 0),
    importClearing: Math.max(0, Number(body.importClearing) || 0),
    landedCostAllocation: ['none', 'by_value', 'by_quantity'].includes(body.landedCostAllocation)
      ? body.landedCostAllocation
      : imp
        ? 'by_value'
        : 'none',
    invoiceCurrency:
      (body.invoiceCurrency && String(body.invoiceCurrency).trim().toUpperCase().slice(0, 8)) || 'ETB',
    fxRateToFunctional: Number(body.fxRateToFunctional) > 0 ? Number(body.fxRateToFunctional) : 1,
    lcReference: body.lcReference != null ? String(body.lcReference).trim().slice(0, 120) : '',
    lcBank: body.lcBank != null ? String(body.lcBank).trim().slice(0, 120) : '',
    lcAmount: body.lcAmount != null && body.lcAmount !== '' ? Number(body.lcAmount) : null,
    lcCurrency:
      body.lcCurrency != null ? String(body.lcCurrency).trim().toUpperCase().slice(0, 8) : '',
    lcExpiry: body.lcExpiry ? new Date(body.lcExpiry) : null,
  };
}

function patchSourcingOntoDocument(po, body) {
  if (body.importFreight !== undefined) po.importFreight = Math.max(0, Number(body.importFreight) || 0);
  if (body.importDuty !== undefined) po.importDuty = Math.max(0, Number(body.importDuty) || 0);
  if (body.importClearing !== undefined) po.importClearing = Math.max(0, Number(body.importClearing) || 0);
  if (
    body.landedCostAllocation !== undefined &&
    ['none', 'by_value', 'by_quantity'].includes(body.landedCostAllocation)
  ) {
    po.landedCostAllocation = body.landedCostAllocation;
  }
  if (body.invoiceCurrency !== undefined) {
    po.invoiceCurrency =
      String(body.invoiceCurrency || 'ETB')
        .trim()
        .toUpperCase()
        .slice(0, 8) || 'ETB';
  }
  if (body.fxRateToFunctional !== undefined) {
    const fx = Number(body.fxRateToFunctional);
    po.fxRateToFunctional = fx > 0 ? fx : 1;
  }
  if (body.lcReference !== undefined) po.lcReference = String(body.lcReference).trim().slice(0, 120);
  if (body.lcBank !== undefined) po.lcBank = String(body.lcBank).trim().slice(0, 120);
  if (body.lcAmount !== undefined) {
    po.lcAmount = body.lcAmount === '' || body.lcAmount == null ? null : Number(body.lcAmount);
  }
  if (body.lcCurrency !== undefined) {
    po.lcCurrency = String(body.lcCurrency || '').trim().toUpperCase().slice(0, 8);
  }
  if (body.lcExpiry !== undefined) {
    po.lcExpiry = body.lcExpiry ? new Date(body.lcExpiry) : null;
  }
  if (body.supplyType === 'import' || body.supplyType === 'local') {
    po.supplyType = body.supplyType;
  }
}

exports.listPurchaseOrders = asyncHandler(async (req, res) => {
  const list = await PurchaseOrder.find(byTenant(req))
    .populate('lines.product', 'name sku unit')
    .populate('vendor', 'code name')
    .populate('approvedBy', 'name employeeId')
    .sort({ createdAt: -1 });
  res.json({
    success: true,
    count: list.length,
    data: list.map((po) => attachCostPreview(po)),
  });
});

exports.getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }))
    .populate('lines.product', 'name sku unit stock')
    .populate('vendor', 'code name email')
    .populate('approvedBy', 'name employeeId');
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  res.json({ success: true, data: attachCostPreview(po) });
});

exports.createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplierName, lines, notes, vendor, supplyType } = req.body;
  if (!supplierName || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'supplierName and lines[] are required',
    });
  }
  const normalized = lines.map((l) => ({
    product: l.product,
    quantityOrdered: Number(l.quantityOrdered || l.quantity),
    quantityReceived: 0,
    unitCost: Number(l.unitCost) || 0,
  }));
  if (normalized.some((l) => !l.product || l.quantityOrdered < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Each line needs product and quantityOrdered >= 1',
    });
  }
  const poNumber = `PO-${Date.now()}`;
  const po = await PurchaseOrder.create({
    tenantId: req.tenantId,
    poNumber,
    supplierName: supplierName.trim(),
    vendor: vendor || null,
    supplyType: supplyType === 'import' ? 'import' : 'local',
    status: 'draft',
    lines: normalized,
    notes: notes || '',
    ...buildSourcingForCreate(req.body),
  });
  const populated = await PurchaseOrder.findOne(byTenant(req, { _id: po._id })).populate(
    'lines.product',
    'name sku'
  );
  res.status(201).json({ success: true, data: attachCostPreview(populated) });
});

exports.updatePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }));
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (po.status !== 'draft') {
    return res.status(400).json({
      success: false,
      message: 'Only draft POs can be edited',
    });
  }
  const { supplierName, lines, notes, vendor } = req.body;
  if (supplierName != null) po.supplierName = supplierName.trim();
  if (notes != null) po.notes = notes;
  if (vendor !== undefined) po.vendor = vendor || null;
  if (lines != null && Array.isArray(lines)) {
    po.lines = lines.map((l) => ({
      product: l.product,
      quantityOrdered: Number(l.quantityOrdered || l.quantity),
      quantityReceived: 0,
      unitCost: Number(l.unitCost) || 0,
    }));
  }
  patchSourcingOntoDocument(po, req.body);
  po.updatedAt = new Date();
  await po.save();
  const populated = await PurchaseOrder.findOne(byTenant(req, { _id: po._id })).populate(
    'lines.product',
    'name sku'
  );
  res.json({ success: true, data: attachCostPreview(populated) });
});

/** Update landed cost / FX / LC while PO is open (draft, approved, or partial received). */
exports.patchPurchaseOrderSourcing = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }));
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (!['draft', 'approved', 'partial_received'].includes(po.status)) {
    return res.status(400).json({
      success: false,
      message: 'Sourcing can only be edited for draft, approved, or partially received POs',
    });
  }
  patchSourcingOntoDocument(po, req.body);
  po.updatedAt = new Date();
  await po.save();
  const populated = await PurchaseOrder.findOne(byTenant(req, { _id: po._id }))
    .populate('lines.product', 'name sku unit stock')
    .populate('vendor', 'code name');
  res.json({ success: true, data: attachCostPreview(populated) });
});

exports.approvePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }));
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (po.status !== 'draft') {
    return res.status(400).json({
      success: false,
      message: 'Only draft POs can be approved',
    });
  }
  po.status = 'approved';
  po.approvedBy = req.user._id;
  po.approvedAt = new Date();
  await po.save();
  const populated = await PurchaseOrder.findOne(byTenant(req, { _id: po._id }))
    .populate('lines.product', 'name sku')
    .populate('approvedBy', 'name');
  res.json({ success: true, data: attachCostPreview(populated) });
});

exports.cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }));
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (po.lines.some((l) => l.quantityReceived > 0)) {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel PO with receipts; receive remaining or adjust manually',
    });
  }
  if (po.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Already cancelled' });
  }
  po.status = 'cancelled';
  await po.save();
  res.json({ success: true, data: po });
});

/**
 * Body: { receipts: [{ lineIndex: number, quantity: number }] }
 */
exports.receivePurchaseOrder = asyncHandler(async (req, res) => {
  const { receipts } = req.body;
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'receipts[] required, e.g. [{ lineIndex: 0, quantity: 10 }]',
    });
  }
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }));
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (!['approved', 'partial_received'].includes(po.status)) {
    return res.status(400).json({
      success: false,
      message: 'PO must be approved before receiving',
    });
  }

  const unitCosts = computeLineInventoryUnitCosts(po);

  for (const r of receipts) {
    const idx = Number(r.lineIndex);
    const q = Number(r.quantity);
    if (Number.isNaN(idx) || idx < 0 || idx >= po.lines.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid lineIndex ${r.lineIndex}`,
      });
    }
    if (q <= 0) continue;
    const line = po.lines[idx];
    const remaining = line.quantityOrdered - line.quantityReceived;
    const take = Math.min(q, remaining);
    if (take <= 0) continue;

    await applyMovement(null, {
      tenantId: req.tenantId,
      productId: line.product,
      delta: take,
      movementType: 'receipt',
      referenceType: 'PurchaseOrder',
      referenceId: po._id,
      note: `${po.poNumber} line ${idx + 1}${r.lotNumber ? ` lot ${r.lotNumber}` : ''}`,
      lotNumber: r.lotNumber || '',
      batchNumber: r.batchNumber || '',
    });

    line.quantityReceived += take;
    const effectiveUnit =
      unitCosts[idx] && unitCosts[idx].inventoryUnitCost > 0
        ? unitCosts[idx].inventoryUnitCost
        : Number(line.unitCost) || 0;
    const prod = await Product.findOne(byTenant(req, { _id: line.product }));
    if (prod && effectiveUnit > 0) {
      if (prod.costingMethod === 'average') {
        await applyReceiptToAverageCost(line.product, take, effectiveUnit, req.tenantId);
      } else {
        await Product.findOneAndUpdate(byTenant(req, { _id: line.product }), {
          unitCost: effectiveUnit,
          lastReceived: new Date(),
        });
      }
    } else if (prod) {
      await Product.findOneAndUpdate(byTenant(req, { _id: line.product }), {
        lastReceived: new Date(),
      });
    }
  }

  const allDone = po.lines.every(
    (l) => l.quantityReceived >= l.quantityOrdered
  );
  po.status = allDone ? 'received' : 'partial_received';
  po.updatedAt = new Date();
  await po.save();

  const populated = await PurchaseOrder.findOne(byTenant(req, { _id: po._id })).populate(
    'lines.product',
    'name sku stock'
  );
  res.json({ success: true, data: attachCostPreview(populated) });
});
