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
    productId,
    delta,
    movementType,
    referenceType = null,
    referenceId = null,
    note = '',
    lotNumber = '',
    batchNumber = '',
  } = options;

  if (delta === 0) {
    return null;
  }

  const id = new mongoose.Types.ObjectId(productId);
  const sessionOpt = session ? { session } : {};

  let product;
  if (delta < 0) {
    product = await Product.findOneAndUpdate(
      { _id: id, stock: { $gte: -delta } },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
    if (!product) {
      const p = await Product.findById(id).session(session || null);
      if (!p) throw new Error('Product not found');
      throw new Error(
        `Insufficient stock for ${p.sku}: need ${-delta}, have ${p.stock}`
      );
    }
  } else {
    product = await Product.findOneAndUpdate(
      { _id: id },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
    if (!product) throw new Error('Product not found');
  }

  const [movement] = await StockMovement.create(
    [
      {
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
