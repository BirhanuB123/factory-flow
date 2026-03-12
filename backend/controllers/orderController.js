const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all orders
// @route   GET /api/orders
exports.getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find().populate('client').populate('items.product');
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

exports.createOrder = asyncHandler(async (req, res, next) => {
  // Basic stock check logic could be added here
  const order = await Order.create(req.body);
  res.status(201).json({ success: true, data: order });
});
