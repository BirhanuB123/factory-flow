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
    locationId = null,
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
        location: locationId || null,
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

    // Always use locationId to differentiate stock across locations
    lotFilter.locationId = locationId || null;

    await LotBalance.findOneAndUpdate(
      lotFilter,
      updateObj,
      { upsert: true, new: true, ...sessionOpt }
    );
  }

  return movement;
}

/**
 * Transfer stock between two locations atomically.
 */
async function applyTransfer(session, options) {
  const {
    tenantId,
    productId,
    quantity,
    fromLocationId,
    toLocationId,
    referenceType = 'Manual',
    referenceId = null,
    note = 'Transfer',
    lotNumber = '',
    batchNumber = '',
    serialNumber = '',
    expirationDate = null,
  } = options;

  if (!tenantId || !fromLocationId || !toLocationId) {
    throw new Error('applyTransfer: tenantId, fromLocationId, and toLocationId are required');
  }
  
  if (quantity <= 0) throw new Error('Transfer quantity must be positive');

  // Verify stock exists in fromLocation
  const tid = new mongoose.Types.ObjectId(tenantId);
  const pid = new mongoose.Types.ObjectId(productId);
  const fromLoc = new mongoose.Types.ObjectId(fromLocationId);
  
  const lotFilter = {
    tenantId: tid,
    product: pid,
    locationId: fromLoc,
    lotNumber: lotNumber || '',
    serialNumber: serialNumber || '',
  };

  const fromBalance = await LotBalance.findOne(lotFilter).session(session || null);
  if (!fromBalance || fromBalance.quantity < quantity) {
    throw new Error(`Insufficient stock in source location for transfer. Available: ${fromBalance ? fromBalance.quantity : 0}`);
  }

  // 1. Create Issue from source
  const issueMove = await StockMovement.create([{
    tenantId: tid,
    product: pid,
    delta: -quantity,
    movementType: 'transfer_out',
    referenceType,
    referenceId,
    note,
    lotNumber,
    batchNumber,
    serialNumber,
    expirationDate,
    location: fromLocationId,
    toLocation: toLocationId,
    balanceAfter: 0, // Not tracking global balance on transfer out to avoid double decrements if we don't update Product stock
  }], session ? { session } : {});

  // 2. Create Receipt into destination
  const receiptMove = await StockMovement.create([{
    tenantId: tid,
    product: pid,
    delta: quantity,
    movementType: 'transfer_in',
    referenceType,
    referenceId,
    note,
    lotNumber,
    batchNumber,
    serialNumber,
    expirationDate,
    location: toLocationId,
    balanceAfter: 0, 
  }], session ? { session } : {});

  // 3. Update LotBalances
  await LotBalance.findOneAndUpdate(
    lotFilter,
    { $inc: { quantity: -quantity }, $set: { updatedAt: new Date() } },
    { session }
  );

  const toLotFilter = { ...lotFilter, locationId: new mongoose.Types.ObjectId(toLocationId) };
  await LotBalance.findOneAndUpdate(
    toLotFilter,
    { $inc: { quantity: quantity }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true, session }
  );

  return { issueMove: issueMove[0], receiptMove: receiptMove[0] };
}

module.exports = { applyMovement, applyTransfer };
