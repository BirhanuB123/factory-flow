const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');

async function sumActiveReservedForProduct(productId) {
  const id = new mongoose.Types.ObjectId(productId);
  const agg = await StockReservation.aggregate([
    { $match: { product: id, status: 'active' } },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  return agg[0]?.total || 0;
}

/** Physical on-hand minus all active reservations */
async function getAvailableToReserve(productId) {
  const p = await Product.findById(productId);
  if (!p) return { available: 0, stock: 0, reserved: 0 };
  const reserved = await sumActiveReservedForProduct(productId);
  return {
    stock: p.stock,
    reserved,
    available: Math.max(0, p.stock - reserved),
  };
}

async function createReservation({
  productId,
  quantity,
  refType,
  refId,
  lineIndex = null,
  note = '',
}) {
  const q = Number(quantity);
  if (q <= 0) throw new Error('Reservation quantity must be positive');
  const { available } = await getAvailableToReserve(productId);
  if (available < q) {
    const p = await Product.findById(productId);
    throw new Error(
      `Cannot reserve ${q} of ${p?.sku || productId}: only ${available} available (${p?.stock || 0} on hand, others reserved)`
    );
  }
  return StockReservation.create({
    product: productId,
    quantity: q,
    refType,
    refId,
    lineIndex,
    note,
    status: 'active',
  });
}

async function sumReservedForOrderLine(orderId, lineIndex, productId) {
  const match = {
    refType: 'Order',
    refId: new mongoose.Types.ObjectId(orderId),
    lineIndex,
    product: new mongoose.Types.ObjectId(productId),
    status: 'active',
  };
  const agg = await StockReservation.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  return agg[0]?.total || 0;
}

async function releaseOrderReservations(orderId) {
  await StockReservation.updateMany(
    { refType: 'Order', refId: orderId, status: 'active' },
    { $set: { status: 'released' } }
  );
}

async function releaseJobReservations(jobId) {
  await StockReservation.updateMany(
    { refType: 'ProductionJob', refId: jobId, status: 'active' },
    { $set: { status: 'released' } }
  );
}

/** Before consuming components on job completion, drop active material holds */
async function consumeJobMaterialReservations(jobId) {
  await StockReservation.deleteMany({
    refType: 'ProductionJob',
    refId: jobId,
    status: 'active',
  });
}

async function listActiveForOrder(orderId) {
  return StockReservation.find({
    refType: 'Order',
    refId: orderId,
    status: 'active',
  }).populate('product', 'name sku');
}

async function listActiveForJob(jobId) {
  return StockReservation.find({
    refType: 'ProductionJob',
    refId: jobId,
    status: 'active',
  }).populate('product', 'name sku');
}

module.exports = {
  sumActiveReservedForProduct,
  getAvailableToReserve,
  createReservation,
  sumReservedForOrderLine,
  releaseOrderReservations,
  releaseJobReservations,
  consumeJobMaterialReservations,
  listActiveForOrder,
  listActiveForJob,
};
