const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');
const { applyMovement } = require('../services/stockService');
const audit = require('../services/auditService');
const { byTenant } = require('../utils/tenantQuery');

exports.getProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find(byTenant(req));
  res.status(200).json({ success: true, count: products.length, data: products });
});

exports.getProductByBarcode = asyncHandler(async (req, res) => {
  const code = (req.params.barcode || '').trim();
  if (!code) {
    return res.status(400).json({ success: false, message: 'barcode required' });
  }
  const product = await Product.findOne(byTenant(req, { barcode: code }));
  if (!product) {
    return res.status(404).json({ success: false, message: 'No product with this barcode' });
  }
  res.status(200).json({ success: true, data: product });
});

exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne(byTenant(req, { _id: req.params.id }));
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.status(200).json({ success: true, data: product });
});

exports.createProduct = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body.tenantId;
  body.tenantId = req.tenantId;
  const initialStock = Math.max(0, Number(body.stock) || 0);
  body.stock = 0;

  const product = await Product.create(body);
  if (initialStock > 0) {
    try {
      await applyMovement(null, {
        tenantId: req.tenantId,
        productId: product._id,
        delta: initialStock,
        movementType: 'opening_balance',
        referenceType: 'Product',
        referenceId: product._id,
        note: 'Initial on-hand at create',
      });
    } catch (e) {
      await Product.findByIdAndDelete(product._id);
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  const fresh = await Product.findById(product._id);
  res.status(201).json({ success: true, data: fresh });
});

exports.updateProduct = asyncHandler(async (req, res, next) => {
  const existing = await Product.findOne(byTenant(req, { _id: req.params.id }));
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const body = { ...req.body };
  delete body.tenantId;
  const newStock = body.stock;
  delete body.stock;

  if (newStock !== undefined && newStock !== null) {
    const target = Number(newStock);
    const delta = target - existing.stock;
    if (delta !== 0) {
      try {
        await applyMovement(null, {
          tenantId: req.tenantId,
          productId: existing._id,
          delta,
          movementType: 'adjustment',
          referenceType: 'Product',
          referenceId: existing._id,
          note: body.stockAdjustmentNote || 'Stock updated from product edit',
        });
      } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
      }
    }
  }

  const product = await Product.findOneAndUpdate(byTenant(req, { _id: req.params.id }), body, {
    new: true,
    runValidators: true,
  });
  await audit.record({
    req,
    action: 'product.update',
    entityType: 'Product',
    entityId: product._id,
    summary: { sku: product.sku, fields: Object.keys(body) },
  });
  res.status(200).json({ success: true, data: product });
});

exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  await audit.record({
    req,
    action: 'product.delete',
    entityType: 'Product',
    entityId: product._id,
    summary: { sku: product.sku },
  });
  res.status(200).json({ success: true, data: {} });
});
