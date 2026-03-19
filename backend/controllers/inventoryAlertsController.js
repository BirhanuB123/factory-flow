const asyncHandler = require('../middleware/asyncHandler');
const Product = require('../models/Product');
const { getAvailableToReserve } = require('../services/reservationService');

exports.getLowStockAlerts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).lean();
  const alerts = [];

  for (const p of products) {
    const { available, stock, reserved } = await getAvailableToReserve(p._id);
    if (available <= (p.reorderPoint || 0)) {
      let severity = 'low';
      if (available <= 0) severity = 'critical';
      else if (p.reorderPoint > 0 && available <= p.reorderPoint * 0.5) severity = 'high';

      alerts.push({
        productId: p._id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        onHand: stock,
        reserved,
        available,
        reorderPoint: p.reorderPoint || 0,
        severity,
      });
    }
  }

  alerts.sort((a, b) => a.available - b.available);
  res.json({ success: true, count: alerts.length, data: alerts });
});
