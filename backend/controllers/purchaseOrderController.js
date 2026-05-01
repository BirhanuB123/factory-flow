const asyncHandler = require('../middleware/asyncHandler');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
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

  try {
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
        serialNumber: r.serialNumber || '',
        expirationDate: r.expirationDate || null,
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
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Receipt failed' });
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

function esc(x) {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Printable PO. */
exports.getPurchaseOrderHtml = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.id }))
    .populate('vendor')
    .populate('lines.product')
    .populate('approvedBy', 'name')
    .lean();
  if (!po) {
    res.status(404).setHeader('Content-Type', 'text/plain');
    return res.send('Purchase Order not found');
  }

  const tenant = await Tenant.findById(req.tenantId).select('documentSettings legalName').lean();
  const ds = tenant?.documentSettings || {};
  const primaryColor = ds.primaryColor || '#4f46e5';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PO ${esc(po.poNumber)}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:16px;color:#111}
  h1{font-size:1.25rem;margin:0}
  .muted{color:#555;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ccc;padding:8px;text-align:left}
  th{background:#f5f5f5;font-size:11px;text-transform:uppercase;border-top:2px solid ${primaryColor}}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .header-table{width:100%;border:none;margin-bottom:20px}
  .header-table td{border:none;padding:0;vertical-align:top}
  .logo{max-height:60px;margin-bottom:10px}
  .total{font-weight:700;color:${primaryColor}}
  @media print{.no-print{display:none}}
</style></head><body>
  <p class="no-print"><a href="#" onclick="window.print()">Print</a></p>
  
  <table class="header-table">
    <tr>
      <td>
        ${ds.logoUrl ? `<img src="${esc(ds.logoUrl)}" class="logo" />` : `<h1>${esc(tenant?.legalName || 'Integra ERP')}</h1>`}
      </td>
      <td style="text-align:right">
        <h1 style="color:${primaryColor}">${esc(ds.poHeader || 'PURCHASE ORDER')}</h1>
        <p class="muted"># ${esc(po.poNumber)}</p>
      </td>
    </tr>
  </table>

  <p><strong>To / ሻጭ</strong><br/>
  ${esc(po.vendor?.name || po.supplierName)}<br/>
  ${esc(po.vendor?.address || '')}<br/>
  ${po.vendor?.email ? `Email: ${esc(po.vendor.email)}` : ''}</p>
  <hr/>
  <p><strong>Date:</strong> ${new Date(po.createdAt).toLocaleDateString('en-GB')}<br/>
  <strong>Status:</strong> ${esc(po.status).toUpperCase()}<br/>
  ${po.approvedBy ? `<strong>Approved by:</strong> ${esc(po.approvedBy.name)}` : ''}</p>
  
  <table>
    <tr><th>SKU</th><th>Product</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Total</th></tr>
    ${po.lines.map(l => {
      const sub = (l.quantityOrdered || 0) * (l.unitCost || 0);
      return `<tr>
        <td>${esc(l.product?.sku || '—')}</td>
        <td>${esc(l.product?.name || 'Unknown')}</td>
        <td class="num">${l.quantityOrdered}</td>
        <td class="num">${Number(l.unitCost || 0).toFixed(2)}</td>
        <td class="num">${sub.toFixed(2)}</td>
      </tr>`;
    }).join('')}
  </table>
  
  <table style="margin-top:8px;max-width:300px;margin-left:auto">
    <tr class="total">
      <td>TOTAL</td>
      <td class="num">${po.lines.reduce((sum, l) => sum + (l.quantityOrdered * l.unitCost), 0).toFixed(2)}</td>
    </tr>
  </table>

  ${po.notes ? `<p><strong>Notes:</strong><br/>${esc(po.notes)}</p>` : ''}
  ${ds.footerText ? `<div style="margin-top:40px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#888">${esc(ds.footerText)}</div>` : ''}
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
