const asyncHandler = require('../middleware/asyncHandler');
const Order = require('../models/Order');
const BOM = require('../models/BOM');
const ProductionJob = require('../models/ProductionJob');
const {
  sumReservedForOrderLine,
  getAvailableToReserve,
} = require('../services/reservationService');

/**
 * Demand → supply: open order lines with BOMs, coverage from reservations + linked jobs.
 */
exports.getMrpSuggestions = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    status: { $in: ['pending', 'processing'] },
  })
    .populate('client', 'name')
    .populate('items.product', 'name sku')
    .lean();

  const suggestions = [];

  for (const order of orders) {
    if (!order.items?.length) continue;
    for (let i = 0; i < order.items.length; i++) {
      const line = order.items[i];
      const prod = line.product;
      if (!prod?._id) continue;
      const pid = prod._id;

      const bom =
        (await BOM.findOne({ outputProduct: pid, status: 'Active' }).lean()) ||
        (await BOM.findOne({ outputProduct: pid }).lean());
      if (!bom) continue;

      const reserved = await sumReservedForOrderLine(order._id, i, pid);
      let jobCoverage = 0;
      if (line.productionJob) {
        const jobDoc = await ProductionJob.findById(line.productionJob).lean();
        if (jobDoc && jobDoc.status !== 'Cancelled') {
          jobCoverage = Math.min(line.quantity, jobDoc.quantity);
        }
      }

      const suggestedMakeQty = Math.max(0, line.quantity - reserved - jobCoverage);
      const { available, stock } = await getAvailableToReserve(pid);

      suggestions.push({
        orderId: order._id,
        orderDate: order.orderDate,
        orderStatus: order.status,
        clientName: order.client?.name || '—',
        lineIndex: i,
        productId: pid,
        productName: prod.name,
        sku: prod.sku,
        orderQty: line.quantity,
        onHand: stock,
        availableToPromise: available,
        reservedForLine: reserved,
        coveredByJobQty: jobCoverage,
        bomId: bom._id,
        bomName: bom.name,
        bomPartNumber: bom.partNumber,
        suggestedMakeQty,
        productionJobId: line.productionJob || null,
      });
    }
  }

  suggestions.sort((a, b) => b.suggestedMakeQty - a.suggestedMakeQty);
  res.json({ success: true, count: suggestions.length, data: suggestions });
});

/**
 * Multi-level BOM explosion + rough critical-path lead (sum routing leadTimeDays on longest BOM chain).
 * GET /api/mrp/explode/:productId?qty=1&maxDepth=10
 */
exports.getMrpExplosion = asyncHandler(async (req, res) => {
  const Product = require('../models/Product');
  const rootPid = req.params.productId;
  const qty = Math.max(0.0001, Number(req.query.qty) || 1);
  const maxDepth = Math.min(15, Math.max(1, parseInt(req.query.maxDepth, 10) || 10));

  const lines = [];

  async function explode(productId, level, mult) {
    if (level > maxDepth) {
      lines.push({
        level,
        productId,
        qty: mult,
        type: 'truncated',
        note: 'maxDepth',
      });
      return 0;
    }
    const p = await Product.findById(productId).lean();
    if (!p) return 0;

    const bom = await BOM.findOne({
      outputProduct: productId,
      status: 'Active',
    }).lean();

    if (!bom) {
      lines.push({
        level,
        productId,
        sku: p.sku,
        name: p.name,
        qty: mult,
        type: 'buy',
      });
      return 0;
    }

    const routeLead = (bom.routing || []).reduce(
      (s, r) => s + (Number(r.leadTimeDays) || 0),
      0
    );
    lines.push({
      level,
      productId,
      sku: p.sku,
      name: p.name,
      qty: mult,
      type: level === 0 ? 'finished_good' : 'make',
      bomId: bom._id,
      bomPartNumber: bom.partNumber,
      routingSteps: (bom.routing || []).length,
      routeLeadDays: routeLead,
    });

    let maxChildChain = 0;
    for (const c of bom.components || []) {
      const pid = c.product?.toString?.() || c.product;
      const need = (Number(c.quantity) || 0) * mult;
      if (!pid || need <= 0) continue;
      const sub = await explode(pid, level + 1, need);
      maxChildChain = Math.max(maxChildChain, sub);
    }
    return routeLead + maxChildChain;
  }

  const root = await Product.findById(rootPid).lean();
  if (!root) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const criticalPathDays = await explode(rootPid, 0, qty);

  res.json({
    success: true,
    data: {
      productId: rootPid,
      sku: root.sku,
      name: root.name,
      orderQty: qty,
      criticalPathLeadDays: criticalPathDays,
      lines,
    },
  });
});
