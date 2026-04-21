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

exports.getInventoryAging = asyncHandler(async (req, res) => {
  const products = await Product.find(byTenant(req, { stock: { $gt: 0 } })).lean();
  
  const buckets = {
    days0_30: [],
    days31_90: [],
    days91_180: [],
    days180plus: [],
  };

  let totalValue = 0;
  const now = new Date();

  for (const p of products) {
    const uc = unitCostForSale(p);
    const stock = Number(p.stock) || 0;
    const ext = Math.round(stock * uc * 100) / 100;
    totalValue += ext;

    const baseDate = p.lastReceived ? new Date(p.lastReceived) : (p.createdAt ? new Date(p.createdAt) : now);
    const daysAge = Math.max(0, Math.floor((now - baseDate) / 86400000));

    const row = {
      _id: p._id,
      sku: p.sku,
      name: p.name,
      stock,
      unitCost: uc,
      extendedValue: ext,
      daysAge,
      lastReceived: p.lastReceived || p.createdAt || null,
    };

    if (daysAge <= 30) buckets.days0_30.push(row);
    else if (daysAge <= 90) buckets.days31_90.push(row);
    else if (daysAge <= 180) buckets.days91_180.push(row);
    else buckets.days180plus.push(row);
  }

  const sumValues = (arr) => arr.reduce((acc, row) => acc + row.extendedValue, 0);

  res.json({
    success: true,
    data: {
      buckets,
      totals: {
        days0_30: Math.round(sumValues(buckets.days0_30) * 100) / 100,
        days31_90: Math.round(sumValues(buckets.days31_90) * 100) / 100,
        days91_180: Math.round(sumValues(buckets.days91_180) * 100) / 100,
        days180plus: Math.round(sumValues(buckets.days180plus) * 100) / 100,
        totalInventoryValue: Math.round(totalValue * 100) / 100,
      }
    }
  });
});
