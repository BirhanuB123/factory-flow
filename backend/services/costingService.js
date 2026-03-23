const mongoose = require('mongoose');
const Product = require('../models/Product');

/**
 * Weighted average cost after PO receipt (qty added at unitCost).
 */
async function applyReceiptToAverageCost(productId, receivedQty, receiptUnitCost, tenantId) {
  if (!tenantId) throw new Error('applyReceiptToAverageCost: tenantId required');
  const tid = new mongoose.Types.ObjectId(tenantId);
  const p = await Product.findOne({ _id: productId, tenantId: tid });
  if (!p || p.costingMethod !== 'average') return p;
  const q = Number(receivedQty);
  const cost = Number(receiptUnitCost) || 0;
  if (q <= 0) return p;
  const stockBefore = Math.max(0, p.stock - q);
  const oldCost = Number(p.unitCost) || 0;
  const newStock = p.stock;
  if (newStock <= 0) {
    p.unitCost = cost;
    await p.save();
    return p;
  }
  const numer = stockBefore * oldCost + q * cost;
  const denom = newStock;
  p.unitCost = Math.round((numer / denom) * 10000) / 10000;
  await p.save();
  return p;
}

function unitCostForSale(product) {
  if (!product) return 0;
  if (product.costingMethod === 'standard') {
    return Number(product.standardUnitCost) || Number(product.unitCost) || 0;
  }
  return Number(product.unitCost) || 0;
}

module.exports = { applyReceiptToAverageCost, unitCostForSale };
