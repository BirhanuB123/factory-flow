const Order = require('../models/Order');
const ProductionJob = require('../models/ProductionJob');
const ApprovalRequest = require('../models/ApprovalRequest');
const asyncHandler = require('../middleware/asyncHandler');
const { releaseOrderReservations } = require('../services/reservationService');

const APPROVAL_DISCOUNT_PCT = Number(process.env.APPROVAL_DISCOUNT_PCT) || 5;
const APPROVAL_ORDER_AMOUNT = Number(process.env.APPROVAL_ORDER_AMOUNT) || 50000;

function orderNeedsApproval(doc) {
  const d = Number(doc.discountPercent) || 0;
  const t = Number(doc.totalAmount) || 0;
  return d >= APPROVAL_DISCOUNT_PCT || t >= APPROVAL_ORDER_AMOUNT;
}

async function ensureOrderApprovalState(orderId, userId, prevSnapshot) {
  const fresh = await Order.findById(orderId);
  if (!fresh) return;
  if (!orderNeedsApproval(fresh)) {
    await Order.findByIdAndUpdate(orderId, {
      approvalStatus: 'none',
      pendingApprovalId: null,
    });
    return;
  }
  const wasApproved = prevSnapshot && prevSnapshot.approvalStatus === 'approved';
  const worsened =
    prevSnapshot &&
    (Number(fresh.totalAmount) > Number(prevSnapshot.totalAmount) + 0.01 ||
      Number(fresh.discountPercent) > Number(prevSnapshot.discountPercent) + 0.01);
  if (wasApproved && !worsened) {
    return;
  }
  await ApprovalRequest.updateMany(
    { entityId: orderId, entityType: 'Order', status: 'pending' },
    { $set: { status: 'rejected', note: 'Superseded by order update' } }
  );
  const type =
    (Number(fresh.discountPercent) || 0) >= APPROVAL_DISCOUNT_PCT
      ? 'order_discount'
      : 'order_large';
  const ar = await ApprovalRequest.create({
    type,
    entityType: 'Order',
    entityId: orderId,
    payload: {
      discountPercent: fresh.discountPercent,
      totalAmount: fresh.totalAmount,
    },
    requestedBy: userId,
    status: 'pending',
  });
  await Order.findByIdAndUpdate(orderId, {
    approvalStatus: 'pending',
    pendingApprovalId: ar._id,
  });
}

async function attachProductionJobs(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  for (const o of list) {
    const items = o.items || [];
    for (let i = 0; i < items.length; i++) {
      const pj = items[i].productionJob;
      if (pj) {
        const id = pj._id || pj;
        const job = await ProductionJob.findById(id)
          .select('jobId status quantity dueDate materialsReserved')
          .lean();
        items[i].productionJob = job;
      }
    }
  }
  return list;
}

exports.getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find().populate('client').populate('items.product').lean();
  await attachProductionJobs(orders);
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('client').populate('items.product').lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  await attachProductionJobs(order);
  res.status(200).json({ success: true, data: order });
});

exports.createOrder = asyncHandler(async (req, res, next) => {
  let order = await Order.create(req.body);
  if (orderNeedsApproval(order)) {
    await ensureOrderApprovalState(order._id, req.user._id, false);
  }
  order = await Order.findById(order._id);
  const populated = await Order.findById(order._id)
    .populate('client')
    .populate('items.product')
    .lean();
  await attachProductionJobs(populated);
  res.status(201).json({ success: true, data: populated });
});

exports.updateOrder = asyncHandler(async (req, res, next) => {
  const prev = await Order.findById(req.params.id);
  if (!prev) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate('client')
    .populate('items.product')
    .lean();

  await ensureOrderApprovalState(req.params.id, req.user._id, prev);

  const orderAfter = await Order.findById(req.params.id)
    .populate('client')
    .populate('items.product')
    .lean();

  const newStatus = orderAfter.status;
  if (
    (newStatus === 'delivered' || newStatus === 'cancelled') &&
    prev.status !== newStatus
  ) {
    await releaseOrderReservations(orderAfter._id);
  }

  await attachProductionJobs(orderAfter);
  res.status(200).json({ success: true, data: orderAfter });
});

exports.deleteOrder = asyncHandler(async (req, res, next) => {
  await releaseOrderReservations(req.params.id);
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
