const Order = require('../models/Order');
const ProductionJob = require('../models/ProductionJob');
const ApprovalRequest = require('../models/ApprovalRequest');
const Client = require('../models/Client');
const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');
const { releaseOrderReservations } = require('../services/reservationService');
const { byTenant } = require('../utils/tenantQuery');

const APPROVAL_DISCOUNT_PCT = Number(process.env.APPROVAL_DISCOUNT_PCT) || 5;
const APPROVAL_ORDER_AMOUNT = Number(process.env.APPROVAL_ORDER_AMOUNT) || 50000;

function orderNeedsApproval(doc) {
  const d = Number(doc.discountPercent) || 0;
  const t = Number(doc.totalAmount) || 0;
  return d >= APPROVAL_DISCOUNT_PCT || t >= APPROVAL_ORDER_AMOUNT;
}

async function ensureOrderApprovalState(orderId, userId, prevSnapshot, tenantId) {
  const fresh = await Order.findOne({ _id: orderId, tenantId });
  if (!fresh) return;
  if (!orderNeedsApproval(fresh)) {
    await Order.findOneAndUpdate(
      { _id: orderId, tenantId },
      {
      approvalStatus: 'none',
      pendingApprovalId: null,
      }
    );
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
    {
      tenantId,
      entityId: orderId,
      entityType: 'Order',
      status: 'pending',
    },
    { $set: { status: 'rejected', note: 'Superseded by order update' } }
  );
  const type =
    (Number(fresh.discountPercent) || 0) >= APPROVAL_DISCOUNT_PCT
      ? 'order_discount'
      : 'order_large';
  const ar = await ApprovalRequest.create({
    tenantId,
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
  await Order.findOneAndUpdate(
    { _id: orderId, tenantId },
    {
    approvalStatus: 'pending',
    pendingApprovalId: ar._id,
    }
  );
}

async function attachProductionJobs(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  for (const o of list) {
    const items = o.items || [];
    for (let i = 0; i < items.length; i++) {
      const pj = items[i].productionJob;
      if (pj) {
        const id = pj._id || pj;
        const job = await ProductionJob.findOne({ _id: id, tenantId: o.tenantId })
          .select('jobId status quantity dueDate materialsReserved')
          .lean();
        items[i].productionJob = job;
      }
    }
  }
  return list;
}

async function assertOrderRefsBelongToTenant(req, payload) {
  const clientId = payload.client;
  if (!clientId) {
    return 'Client is required';
  }
  const client = await Client.findOne(byTenant(req, { _id: clientId }));
  if (!client) {
    return 'Client not found for this company';
  }
  const items = payload.items;
  if (items && items.length) {
    const ids = items.map((i) => i.product).filter(Boolean);
    if (ids.length !== items.length) {
      return 'Each line item must reference a product';
    }
    const n = await Product.countDocuments(byTenant(req, { _id: { $in: ids } }));
    if (n !== ids.length) {
      return 'One or more products are invalid for this company';
    }
  }
  return null;
}

exports.getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find(byTenant(req)).populate('client').populate('items.product').lean();
  await attachProductionJobs(orders);
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne(byTenant(req, { _id: req.params.id }))
    .populate('client')
    .populate('items.product')
    .lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  await attachProductionJobs(order);
  res.status(200).json({ success: true, data: order });
});

exports.createOrder = asyncHandler(async (req, res, next) => {
  const msg = await assertOrderRefsBelongToTenant(req, req.body);
  if (msg) {
    return res.status(400).json({ success: false, message: msg });
  }
  const body = { ...req.body };
  delete body.tenantId;
  let order = await Order.create({ ...body, tenantId: req.tenantId });
  if (orderNeedsApproval(order)) {
    await ensureOrderApprovalState(order._id, req.user._id, false, req.tenantId);
  }
  const populated = await Order.findOne(byTenant(req, { _id: order._id }))
    .populate('client')
    .populate('items.product')
    .lean();
  await attachProductionJobs(populated);
  res.status(201).json({ success: true, data: populated });
});

exports.updateOrder = asyncHandler(async (req, res, next) => {
  const prev = await Order.findOne(byTenant(req, { _id: req.params.id }));
  if (!prev) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const patch = { ...req.body };
  delete patch.tenantId;
  const merged = {
    ...prev.toObject(),
    ...patch,
    client: patch.client != null ? patch.client : prev.client,
    items: patch.items != null ? patch.items : prev.items,
  };
  const msg = await assertOrderRefsBelongToTenant(req, merged);
  if (msg) {
    return res.status(400).json({ success: false, message: msg });
  }
  const order = await Order.findOneAndUpdate(byTenant(req, { _id: req.params.id }), patch, {
    new: true,
    runValidators: true,
  })
    .populate('client')
    .populate('items.product')
    .lean();

  await ensureOrderApprovalState(req.params.id, req.user._id, prev, req.tenantId);

  const orderAfter = await Order.findOne(byTenant(req, { _id: req.params.id }))
    .populate('client')
    .populate('items.product')
    .lean();

  const newStatus = orderAfter.status;
  if (
    (newStatus === 'delivered' || newStatus === 'cancelled') &&
    prev.status !== newStatus
  ) {
    await releaseOrderReservations(orderAfter._id, req.tenantId);
  }

  await attachProductionJobs(orderAfter);
  res.status(200).json({ success: true, data: orderAfter });
});

exports.deleteOrder = asyncHandler(async (req, res, next) => {
  await releaseOrderReservations(req.params.id, req.tenantId);
  const order = await Order.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
