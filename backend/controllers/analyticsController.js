const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const ProductionJob = require('../models/ProductionJob');
const DowntimeEvent = require('../models/DowntimeEvent');
const Asset = require('../models/Asset');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const { byTenant } = require('../utils/tenantQuery');

function getDateFilter(req) {
  const { startDate, endDate } = req.query;
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) filter.$lt = new Date(endDate);
  return Object.keys(filter).length > 0 ? filter : null;
}

/** Calculates Machine OEE */
exports.getOeeAnalytics = asyncHandler(async (req, res) => {
  const dateFilter = getDateFilter(req);
  const query = { status: 'Completed' };
  if (dateFilter) query.updatedAt = dateFilter;

  const jobs = await ProductionJob.find(byTenant(req, query)).lean();
  
  const dtQuery = {};
  if (dateFilter) dtQuery.startedAt = dateFilter;
  const downtime = await DowntimeEvent.find(byTenant(req, dtQuery)).populate('asset').lean();

  const wcStats = {};
  jobs.forEach(job => {
    job.operations.forEach(op => {
      const wc = op.workCenterCode || 'UNASSIGNED';
      if (!wcStats[wc]) {
        wcStats[wc] = { name: wc, plannedRunMin: 0, actualMachineMin: 0, totalQty: 0, scrapQty: 0, goodQty: 0, downtimeMin: 0 };
      }
      wcStats[wc].plannedRunMin += op.plannedRunMin || 0;
      wcStats[wc].actualMachineMin += op.actualMachineMin || 0;
      wcStats[wc].scrapQty += op.scrapQty || 0;
      wcStats[wc].goodQty += op.wipOutQty || 0;
      wcStats[wc].totalQty += (op.wipOutQty || 0) + (op.scrapQty || 0);
    });
  });

  downtime.forEach(dt => {
    if (dt.endedAt && dt.asset && dt.asset.workCenter) {
      const wcCode = dt.asset.workCenterCode || 'OTHER'; 
      if (wcStats[wcCode]) {
        const diff = (new Date(dt.endedAt) - new Date(dt.startedAt)) / 60000;
        wcStats[wcCode].downtimeMin += diff;
      }
    }
  });

  const results = Object.values(wcStats).map(s => {
    const availability = s.plannedRunMin > 0 ? Math.max(0, Math.min(1, (s.plannedRunMin - s.downtimeMin) / s.plannedRunMin)) : 1;
    const performance = s.actualMachineMin > 0 ? Math.max(0, Math.min(1, s.plannedRunMin / s.actualMachineMin)) : 1;
    const quality = s.totalQty > 0 ? Math.max(0, Math.min(1, s.goodQty / s.totalQty)) : 1;
    const oee = availability * performance * quality;
    return {
      workCenter: s.name,
      availability: Math.round(availability * 100),
      performance: Math.round(performance * 100),
      quality: Math.round(quality * 100),
      oee: Math.round(oee * 100),
      totalQty: s.totalQty,
      scrapQty: s.scrapQty
    };
  });

  res.json({ data: results });
});

/** Calculates Product Profitability */
exports.getProductProfitability = asyncHandler(async (req, res) => {
  const tid = new mongoose.Types.ObjectId(String(req.tenantId));
  const dateFilter = getDateFilter(req);

  const invMatch = { tenantId: tid, status: 'Paid' };
  if (dateFilter) invMatch.invoiceDate = dateFilter;

  const revenueData = await Invoice.aggregate([
    { $match: invMatch },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.product',
        totalRevenue: { $sum: { $multiply: [{ $toDouble: '$lines.quantity' }, { $toDouble: '$lines.unitPrice' }] } },
        totalQty: { $sum: { $toDouble: '$lines.quantity' } }
      }
    }
  ]);

  const jobMatch = { tenantId: tid, status: 'Completed' };
  if (dateFilter) jobMatch.updatedAt = dateFilter;

  const costData = await ProductionJob.aggregate([
    { $match: jobMatch },
    {
      $group: {
        _id: '$bom',
        totalLaborCost: { $sum: { $toDouble: '$costing.actualLaborCost' } },
        totalMachineCost: { $sum: { $toDouble: '$costing.actualMachineCost' } },
        totalOverheadCost: { $sum: { $toDouble: '$costing.actualOverheadCost' } },
        producedQty: { $sum: { $toDouble: '$quantity' } }
      }
    },
    { $lookup: { from: 'boms', localField: '_id', foreignField: '_id', as: 'bomData' } },
    { $unwind: '$bomData' },
    { $project: { productId: '$bomData.product', totalMfgCost: { $add: ['$totalLaborCost', '$totalMachineCost', '$totalOverheadCost'] } } }
  ]);

  const products = await Product.find(byTenant(req)).select('name sku unitCost').lean();
  const results = products.map(p => {
    const rev = revenueData.find(r => String(r._id) === String(p._id)) || { totalRevenue: 0, totalQty: 0 };
    const cost = costData.find(c => String(c.productId) === String(p._id)) || { totalMfgCost: 0 };
    const materialCost = rev.totalQty * (p.unitCost || 0);
    const totalCost = materialCost + (cost.totalMfgCost || 0);
    const profit = rev.totalRevenue - totalCost;
    const margin = rev.totalRevenue > 0 ? (profit / rev.totalRevenue) * 100 : 0;
    return { id: p._id, name: p.name, sku: p.sku, revenue: Math.round(rev.totalRevenue * 100) / 100, cost: Math.round(totalCost * 100) / 100, profit: Math.round(profit * 100) / 100, margin: Math.round(margin * 10) / 10, quantity: rev.totalQty };
  }).filter(r => r.revenue > 0 || r.cost > 0).sort((a, b) => b.profit - a.profit);

  res.json({ data: results });
});

/** Calculates Inventory Turnover Ratio */
exports.getInventoryTurnover = asyncHandler(async (req, res) => {
  const tid = new mongoose.Types.ObjectId(String(req.tenantId));
  const dateFilter = getDateFilter(req);
  
  const invMatch = { tenantId: tid };
  if (dateFilter) {
      invMatch.invoiceDate = dateFilter;
  } else {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      invMatch.invoiceDate = { $gte: ninetyDaysAgo };
  }

  const cogsData = await Invoice.aggregate([
    { $match: invMatch },
    { $unwind: '$lines' },
    { $lookup: { from: 'products', localField: 'lines.product', foreignField: '_id', as: 'prod' } },
    { $unwind: '$prod' },
    {
      $group: {
        _id: '$lines.product',
        name: { $first: '$prod.name' },
        sku: { $first: '$prod.sku' },
        cogs: { $sum: { $multiply: [{ $toDouble: '$lines.quantity' }, { $toDouble: '$prod.unitCost' }] } }
      }
    }
  ]);

  const currentInventory = await Product.find(byTenant(req)).select('name sku stock unitCost').lean();
  const results = currentInventory.map(p => {
    const cogs = cogsData.find(c => String(c._id) === String(p._id))?.cogs || 0;
    const inventoryValue = (p.stock || 0) * (p.unitCost || 0);
    const annualCogs = cogs * 4; 
    const ratio = inventoryValue > 0 ? annualCogs / inventoryValue : (annualCogs > 0 ? 99 : 0);
    const dsi = ratio > 0 ? 365 / ratio : 365; 
    return { name: p.name, sku: p.sku, cogs: Math.round(cogs * 100) / 100, inventoryValue: Math.round(inventoryValue * 100) / 100, turnoverRatio: Math.round(ratio * 10) / 10, dsi: Math.round(dsi) };
  }).filter(r => r.cogs > 0 || r.inventoryValue > 0).sort((a, b) => b.turnoverRatio - a.turnoverRatio);

  res.json({ data: results });
});
