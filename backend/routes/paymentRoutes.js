const express = require('express');
const router = express.Router();
const { chapaWebhook } = require('../controllers/paymentWebhookController');
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const { byTenant } = require('../utils/tenantQuery');
const asyncHandler = require('express-async-handler');

// Public webhook endpoint
router.post('/webhook', chapaWebhook);

// Protected verification endpoint for polling
router.get('/verify/:txRef', protect, asyncHandler(async (req, res) => {
  const { txRef } = req.params;
  const order = await Order.findOne(byTenant(req, { 'paymentDetails.txRef': txRef }));
  
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({
    success: true,
    data: {
      status: order.status,
      paymentStatus: order.paymentDetails.paymentStatus,
      txRef: order.paymentDetails.txRef
    }
  });
}));

module.exports = router;
