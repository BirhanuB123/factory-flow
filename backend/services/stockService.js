const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

/**
 * Atomically adjust stock and append ledger row.
 * For negative delta, fails if stock would go below zero.
 * @param {import('mongoose').ClientSession|null} session
 */
async function applyMovement(session, options) {
  const {
    tenantId,
    productId,
    delta,
    movementType,
    referenceType = null,
    referenceId = null,
    note = '',
    lotNumber = '',
    batchNumber = '',
  } = options;

  if (!tenantId) {
    throw new Error('applyMovement: tenantId is required');
  }

  if (delta === 0) {
    return null;
  }

  const id = new mongoose.Types.ObjectId(productId);
  const tid = new mongoose.Types.ObjectId(tenantId);
  const sessionOpt = session ? { session } : {};

  let product;
  if (delta < 0) {
    product = await Product.findOneAndUpdate(
      { _id: id, tenantId: tid, stock: { $gte: -delta } },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
    if (!product) {
      const p = await Product.findOne({ _id: id, tenantId: tid }).session(session || null);
      if (!p) throw new Error('Product not found');
      throw new Error(
        `Insufficient stock for ${p.sku}: need ${-delta}, have ${p.stock}`
      );
    }
  } else {
    product = await Product.findOneAndUpdate(
      { _id: id, tenantId: tid },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
    if (!product) throw new Error('Product not found');
  }

  const [movement] = await StockMovement.create(
    [
      {
        tenantId: tid,
        product: id,
        delta,
        movementType,
        referenceType,
        referenceId: referenceId || undefined,
        note,
        lotNumber: lotNumber || '',
        batchNumber: batchNumber || '',
        balanceAfter: product.stock,
      },
    ],
    session ? { session } : {}
  );

  return movement;
}

module.exports = { applyMovement };
