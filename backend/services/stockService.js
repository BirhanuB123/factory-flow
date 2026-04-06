const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const LotBalance = require('../models/LotBalance');

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
    serialNumber = '',
    expirationDate = null,
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

  // Validate tracking rules
  const checkProduct = await Product.findOne({ _id: id, tenantId: tid }).session(session || null);
  if (!checkProduct) throw new Error('Product not found');

  if (checkProduct.trackingMethod === 'batch' && !lotNumber && !batchNumber) {
    throw new Error('Lot or Batch number is required for this product');
  }
  if (checkProduct.trackingMethod === 'serial' && !serialNumber) {
    throw new Error('Serial number is required for this product');
  }
  if (checkProduct.trackingMethod === 'serial' && Math.abs(Number(delta)) !== 1) {
    throw new Error('Serial tracked items must be moved one at a time (quantity 1)');
  }

  let product;
  if (delta < 0) {
    product = await Product.findOneAndUpdate(
      { _id: id, tenantId: tid, stock: { $gte: -delta } },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
    if (!product) {
      throw new Error(
        `Insufficient stock for ${checkProduct.sku}: need ${-delta}, have ${checkProduct.stock}`
      );
    }
  } else {
    product = await Product.findOneAndUpdate(
      { _id: id, tenantId: tid },
      { $inc: { stock: delta } },
      { new: true, ...sessionOpt }
    );
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
        serialNumber: serialNumber || '',
        expirationDate: expirationDate || null,
        balanceAfter: product.stock,
      },
    ],
    session ? { session } : {}
  );

  // Update Lot Balance
  // We only track lots/serials if they are provided OR if the product requires it.
  // If the product is "none" tracked, we might still want to track by location (if given).
  if (lotNumber || serialNumber) {
    const lotFilter = {
      tenantId: tid,
      product: id,
      lotNumber: lotNumber || '',
      serialNumber: serialNumber || '',
    };
    
    // UPSERT the lot balance
    const updateObj = { 
      $inc: { quantity: delta },
      $set: { updatedAt: new Date() }
    };
    if (expirationDate) {
      updateObj.$set.expirationDate = expirationDate;
    }

    await LotBalance.findOneAndUpdate(
      lotFilter,
      updateObj,
      { upsert: true, new: true, ...sessionOpt }
    );
  }

  return movement;
}

module.exports = { applyMovement };
