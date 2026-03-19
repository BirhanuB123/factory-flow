const asyncHandler = require('../middleware/asyncHandler');
const Order = require('../models/Order');
const StockReservation = require('../models/StockReservation');
const {
  createReservation,
  sumReservedForOrderLine,
  getAvailableToReserve,
  releaseOrderReservations,
  listActiveForOrder,
  listActiveForJob,
} = require('../services/reservationService');

exports.getReservations = asyncHandler(async (req, res) => {
  const { orderId, jobId, productId } = req.query;
  if (orderId) {
    const list = await listActiveForOrder(orderId);
    return res.json({ success: true, data: list });
  }
  if (jobId) {
    const list = await listActiveForJob(jobId);
    return res.json({ success: true, data: list });
  }
  const q = { status: 'active' };
  if (productId) q.product = productId;
  const list = await StockReservation.find(q)
    .populate('product', 'name sku stock')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, count: list.length, data: list });
});

exports.reserveOrderLine = asyncHandler(async (req, res) => {
  const { lineIndex, quantity } = req.body;
  const idx = Number(lineIndex);
  if (Number.isNaN(idx) || idx < 0) {
    return res.status(400).json({ success: false, message: 'Invalid lineIndex' });
  }
  const order = await Order.findById(req.params.orderId);
  if (!order || !order.items[idx]) {
    return res.status(404).json({ success: false, message: 'Order or line not found' });
  }
  const line = order.items[idx];
  const pid = line.product;
  const already = await sumReservedForOrderLine(order._id, idx, pid);
  const maxForLine = line.quantity - already;
  if (maxForLine <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Line is fully reserved already',
    });
  }
  const { available } = await getAvailableToReserve(pid);
  const want = Number(quantity);
  if (want <= 0) {
    return res.status(400).json({ success: false, message: 'quantity must be positive' });
  }
  const q = Math.min(want, maxForLine, available);
  if (q <= 0) {
    return res.status(400).json({
      success: false,
      message: `No stock to reserve (available: ${available})`,
    });
  }
  const doc = await createReservation({
    productId: pid,
    quantity: q,
    refType: 'Order',
    refId: order._id,
    lineIndex: idx,
    note: `Order line ${idx + 1}`,
  });
  const populated = await StockReservation.findById(doc._id).populate('product', 'name sku');
  res.status(201).json({ success: true, data: populated });
});

exports.releaseReservation = asyncHandler(async (req, res) => {
  const r = await StockReservation.findById(req.params.id);
  if (!r) {
    return res.status(404).json({ success: false, message: 'Reservation not found' });
  }
  if (r.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Reservation is not active' });
  }
  r.status = 'released';
  await r.save();
  res.json({ success: true, data: r });
});
