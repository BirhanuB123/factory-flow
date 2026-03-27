const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');

function tid(tenantId) {
  return new mongoose.Types.ObjectId(tenantId);
}

async function sumActiveReservedForProduct(productId, tenantId) {
  if (!tenantId) throw new Error('sumActiveReservedForProduct: tenantId required');
  const id = new mongoose.Types.ObjectId(productId);
  const agg = await StockReservation.aggregate([
    { $match: { product: id, tenantId: tid(tenantId), status: 'active' } },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  return agg[0]?.total || 0;
}

/** Physical on-hand minus all active reservations */
async function getAvailableToReserve(productId, tenantId) {
  if (!tenantId) throw new Error('getAvailableToReserve: tenantId required');
  const p = await Product.findOne({ _id: productId, tenantId: tid(tenantId) });
  if (!p) return { available: 0, stock: 0, reserved: 0 };
  const reserved = await sumActiveReservedForProduct(productId, tenantId);
  return {
    stock: p.stock,
    reserved,
    available: Math.max(0, p.stock - reserved),
  };
}

async function createReservation({
  tenantId,
  productId,
  quantity,
  refType,
  refId,
  lineIndex = null,
  note = '',
}) {
  if (!tenantId) throw new Error('createReservation: tenantId required');
  const q = Number(quantity);
  if (q <= 0) throw new Error('Reservation quantity must be positive');
  const { available } = await getAvailableToReserve(productId, tenantId);
  if (available < q) {
    const p = await Product.findOne({ _id: productId, tenantId: tid(tenantId) });
    throw new Error(
      `Cannot reserve ${q} of ${p?.sku || productId}: only ${available} available (${p?.stock || 0} on hand, others reserved)`
    );
  }
  return StockReservation.create({
    tenantId: tid(tenantId),
    product: productId,
    quantity: q,
    refType,
    refId,
    lineIndex,
    note,
    status: 'active',
  });
}

async function sumReservedForOrderLine(orderId, lineIndex, productId, tenantId) {
  if (!tenantId) throw new Error('sumReservedForOrderLine: tenantId required');
  const match = {
    tenantId: tid(tenantId),
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

async function releaseOrderReservations(orderId, tenantId) {
  if (!tenantId) throw new Error('releaseOrderReservations: tenantId required');
  await StockReservation.updateMany(
    {
      tenantId: tid(tenantId),
      refType: 'Order',
      refId: orderId,
      status: 'active',
    },
    { $set: { status: 'released' } }
  );
}

/**
 * Reduce or remove active order-line reservations by shipped quantity (FIFO by createdAt).
 * @param {import('mongoose').ClientSession|null} session
 */
async function consumeOrderLineReservationQuantity(
  orderId,
  lineIndex,
  productId,
  tenantId,
  quantity,
  session
) {
  if (!tenantId) {
    throw new Error('consumeOrderLineReservationQuantity: tenantId required');
  }
  let remaining = Number(quantity);
  if (!Number.isFinite(remaining) || remaining <= 0) return;

  const match = {
    tenantId: tid(tenantId),
    refType: 'Order',
    refId: new mongoose.Types.ObjectId(orderId),
    lineIndex: Number(lineIndex),
    product: new mongoose.Types.ObjectId(productId),
    status: 'active',
  };

  let q = StockReservation.find(match).sort({ createdAt: 1 });
  if (session) q = q.session(session);
  const reservations = await q;

  for (const r of reservations) {
    if (remaining <= 0) break;
    const take = Math.min(r.quantity, remaining);
    remaining -= take;
    const newQty = r.quantity - take;
    if (newQty <= 0.0001) {
      if (session) {
        await r.deleteOne({ session });
      } else {
        await r.deleteOne();
      }
    } else {
      r.quantity = newQty;
      await r.save(session ? { session } : {});
    }
  }
}

async function releaseJobReservations(jobId, tenantId) {
  if (!tenantId) throw new Error('releaseJobReservations: tenantId required');
  await StockReservation.updateMany(
    {
      tenantId: tid(tenantId),
      refType: 'ProductionJob',
      refId: jobId,
      status: 'active',
    },
    { $set: { status: 'released' } }
  );
}

/** Before consuming components on job completion, drop active material holds */
async function consumeJobMaterialReservations(jobId, tenantId) {
  if (!tenantId) throw new Error('consumeJobMaterialReservations: tenantId required');
  await StockReservation.deleteMany({
    tenantId: tid(tenantId),
    refType: 'ProductionJob',
    refId: jobId,
    status: 'active',
  });
}

async function listActiveForOrder(orderId, tenantId) {
  if (!tenantId) throw new Error('listActiveForOrder: tenantId required');
  return StockReservation.find({
    tenantId: tid(tenantId),
    refType: 'Order',
    refId: orderId,
    status: 'active',
  }).populate('product', 'name sku');
}

async function listActiveForJob(jobId, tenantId) {
  if (!tenantId) throw new Error('listActiveForJob: tenantId required');
  return StockReservation.find({
    tenantId: tid(tenantId),
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
  consumeOrderLineReservationQuantity,
  releaseJobReservations,
  consumeJobMaterialReservations,
  listActiveForOrder,
  listActiveForJob,
};
