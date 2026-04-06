const asyncHandler = require('../middleware/asyncHandler');
const StockMovement = require('../models/StockMovement');
const { applyMovement } = require('../services/stockService');
const audit = require('../services/auditService');
const { byTenant } = require('../utils/tenantQuery');

const VALID_KINDS = ['receipt', 'issue', 'adjustment'];

exports.getMovements = asyncHandler(async (req, res) => {
  const { productId, limit = '100', skip = '0' } = req.query;
  const q = byTenant(req);
  if (productId) q.product = productId;

  const movements = await StockMovement.find(q)
    .populate('product', 'name sku unit')
    .sort({ createdAt: -1 })
    .skip(Math.max(0, parseInt(skip, 10) || 0))
    .limit(Math.min(500, Math.max(1, parseInt(limit, 10) || 100)));

  const total = await StockMovement.countDocuments(q);
  res.status(200).json({ success: true, count: movements.length, total, data: movements });
});

/**
 * Body: { productId, kind: 'receipt'|'issue'|'adjustment', quantity: number, note? }
 * receipt/issue: quantity is positive magnitude; adjustment: quantity is signed delta
 */
exports.createMovement = asyncHandler(async (req, res) => {
  const { productId, kind, quantity, note, lotNumber, batchNumber, serialNumber, expirationDate } = req.body;
  const Product = require('../models/Product');

  if (!productId || !kind || quantity === undefined || quantity === null) {
    return res.status(400).json({
      success: false,
      message: 'productId, kind, and quantity are required',
    });
  }

  const productDoc = await Product.findOne(byTenant(req, { _id: productId }));
  if (!productDoc) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (productDoc.trackingMethod === 'batch' && !lotNumber && !batchNumber) {
    return res.status(400).json({ success: false, message: 'Lot or Batch number is required for this product' });
  }
  if (productDoc.trackingMethod === 'serial' && !serialNumber) {
    return res.status(400).json({ success: false, message: 'Serial number is required for this product' });
  }
  if (productDoc.trackingMethod === 'serial' && Math.abs(Number(quantity)) !== 1) {
    return res.status(400).json({ success: false, message: 'Serial tracked items must be moved one at a time (quantity 1)' });
  }
  if (!VALID_KINDS.includes(kind)) {
    return res.status(400).json({
      success: false,
      message: `kind must be one of: ${VALID_KINDS.join(', ')}`,
    });
  }

  let delta;
  let movementType;
  if (kind === 'receipt') {
    const q = Number(quantity);
    if (q <= 0) {
      return res.status(400).json({ success: false, message: 'Receipt quantity must be positive' });
    }
    delta = q;
    movementType = 'receipt';
  } else if (kind === 'issue') {
    const q = Number(quantity);
    if (q <= 0) {
      return res.status(400).json({ success: false, message: 'Issue quantity must be positive' });
    }
    delta = -q;
    movementType = 'issue';
  } else {
    delta = Number(quantity);
    if (delta === 0) {
      return res.status(400).json({ success: false, message: 'Adjustment cannot be zero' });
    }
    movementType = 'adjustment';
  }

  try {
    const movement = await applyMovement(null, {
      tenantId: req.tenantId,
      productId,
      delta,
      movementType,
      referenceType: 'Manual',
      note: note || `Manual ${kind}`,
      lotNumber: lotNumber || '',
      batchNumber: batchNumber || '',
      serialNumber: serialNumber || '',
      expirationDate: expirationDate || null,
    });
    const populated = await StockMovement.findOne(byTenant(req, { _id: movement._id })).populate(
      'product',
      'name sku stock unit'
    );
    await audit.record({
      req,
      action: 'stock.manual_movement',
      entityType: 'StockMovement',
      entityId: movement._id,
      summary: { kind, delta, productId: String(productId) },
    });
    res.status(201).json({ success: true, data: populated });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Movement failed' });
  }
});
