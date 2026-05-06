const mongoose = require('mongoose');
const ProductionJob = require('../models/ProductionJob');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tid = new mongoose.Types.ObjectId('69bd45231025c360b881957c');
  const req = { tenantId: tid, query: {} };

  // 1. OEE Test
  const jobs = await ProductionJob.find({ tenantId: tid, status: 'Completed' }).lean();
  console.log('Completed jobs for tenant:', jobs.length);
  
  const oeeResults = jobs.reduce((acc, job) => {
    const wc = job.workCenterCode || 'Unknown';
    if (!acc[wc]) acc[wc] = { workCenter: wc, oee: 0, count: 0 };
    
    const op = job.operations?.[0] || {};
    const plannedRun = Number(op.plannedRunMin || 0);
    const actualMachine = Number(op.actualMachineMin || 0);
    const totalQty = Number(op.wipOutQty || 0);
    const goodQty = totalQty - Number(op.scrapQty || 0);

    const avail = actualMachine > 0 ? Math.min(100, (actualMachine / plannedRun) * 100) : 0;
    const perf = 100; // Simplified
    const quality = totalQty > 0 ? (goodQty / totalQty) * 100 : 100;
    
    const jobOee = (avail * perf * quality) / 10000;
    acc[wc].oee += jobOee;
    acc[wc].count += 1;
    return acc;
  }, {});

  const oeeData = Object.values(oeeResults).map(r => ({
    ...r,
    oee: Math.round(r.oee / r.count)
  }));
  console.log('OEE Data:', oeeData);

  // 2. Profitability Test
  const invoiceAgg = await Invoice.aggregate([
    { $match: { tenantId: tid, status: 'Paid' } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.product',
        revenue: { $sum: { $multiply: ['$lines.quantity', '$lines.unitPrice'] } },
        qty: { $sum: '$lines.quantity' },
      },
    },
  ]);
  console.log('Invoice Aggregation:', invoiceAgg.length);

  const jobAgg = await ProductionJob.aggregate([
    { $match: { tenantId: tid, status: 'Completed' } },
    {
      $group: {
        _id: '$bom', // Simplified, usually products are linked to BOMs
        cost: {
          $sum: {
            $add: [
              { $ifNull: ['$costing.actualLaborCost', 0] },
              { $ifNull: ['$costing.actualMachineCost', 0] },
              { $ifNull: ['$costing.actualOverheadCost', 0] },
            ],
          },
        },
      },
    },
  ]);
  console.log('Job Aggregation:', jobAgg.length);

  process.exit(0);
}

test();
