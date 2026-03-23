const asyncHandler = require('../middleware/asyncHandler');
const Product = require('../models/Product');
const { unitCostForSale } = require('../services/costingService');
const { byTenant } = require('../utils/tenantQuery');

exports.getValuation = asyncHandler(async (req, res) => {
  const products = await Product.find(byTenant(req)).select(
    'name sku stock unitCost costingMethod standardUnitCost'
  );
  const lines = [];
  let total = 0;
  for (const p of products) {
    const stock = Number(p.stock) || 0;
    const uc = unitCostForSale(p);
    const ext = Math.round(stock * uc * 100) / 100;
    total += ext;
    lines.push({
      _id: p._id,
      sku: p.sku,
      name: p.name,
      stock,
      costingMethod: p.costingMethod,
      unitCost: uc,
      extendedValue: ext,
    });
  }
  total = Math.round(total * 100) / 100;
  res.json({
    success: true,
    data: { asOf: new Date().toISOString(), totalValue: total, lines },
  });
});
