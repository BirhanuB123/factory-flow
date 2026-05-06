require('../config/loadEnv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const BOM = require('../models/BOM');
const ProductionJob = require('../models/ProductionJob');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Asset = require('../models/Asset');
const DowntimeEvent = require('../models/DowntimeEvent');

const WorkCenter = require('../models/WorkCenter');

async function main() {
  await connectDB();

  const tenant = await Tenant.findOne({ key: 'default' });
  if (!tenant) {
    console.error('Default tenant not found. Please run npm run migrate:tenant first.');
    process.exit(1);
  }
  const tid = tenant._id;

  console.log('Seeding data for tenant:', tenant.displayName);

  // 1. Create a Client
  let client = await Client.findOne({ tenantId: tid });
  if (!client) {
    client = await Client.create({
      tenantId: tid,
      name: 'Global Manufacturing Corp',
      email: 'contact@globalmfg.com',
      phone: '+1-555-0199',
      address: '123 Industrial Way, Tech City',
      status: 'active'
    });
    console.log('Created client:', client.name);
  }

  // 2. Create Products
  const productData = [
    { name: 'Industrial Turbine Blade', sku: 'TURB-001', price: 1200, unitCost: 450, stock: 50 },
    { name: 'Precision Gear Box', sku: 'GEAR-X2', price: 850, unitCost: 320, stock: 120 },
    { name: 'Hydraulic Seal Kit', sku: 'SEAL-HYD', price: 120, unitCost: 35, stock: 500 },
    { name: 'Control Module V3', sku: 'CTRL-V3', price: 2100, unitCost: 890, stock: 25 }
  ];

  const products = [];
  for (const p of productData) {
    let prod = await Product.findOne({ tenantId: tid, sku: p.sku });
    if (!prod) {
      prod = await Product.create({ ...p, tenantId: tid });
      console.log('Created product:', prod.sku);
    }
    products.push(prod);
  }

  // 3. Create BOMs
  const boms = [];
  for (const prod of products) {
    let bom = await BOM.findOne({ tenantId: tid, outputProduct: prod._id });
    if (!bom) {
      bom = await BOM.create({
        tenantId: tid,
        name: `BOM for ${prod.name}`,
        outputProduct: prod._id,
        partNumber: prod.sku,
        status: 'Active',
        components: [
          { product: products[0]._id, quantity: 1 } // Dummy component
        ]
      });
      console.log('Created BOM for:', prod.sku);
    }
    boms.push(bom);
  }

  // 4. Create Work Centers and Assets for OEE
  const wcData = [
    { name: 'Machining Center', code: 'WC-MACH' },
    { name: 'Assembly Line', code: 'WC-ASSY' }
  ];

  const wcs = {};
  for (const w of wcData) {
    let wc = await WorkCenter.findOne({ tenantId: tid, code: w.code });
    if (!wc) {
      wc = await WorkCenter.create({ ...w, tenantId: tid });
      console.log('Created work center:', wc.code);
    }
    wcs[w.code] = wc;
  }

  const assetData = [
    { name: 'CNC Milling Machine A', code: 'CNC-A', workCenterCode: 'WC-MACH' },
    { name: 'Assembly Line 1', code: 'ASSY-1', workCenterCode: 'WC-ASSY' }
  ];

  const assets = [];
  for (const a of assetData) {
    let asset = await Asset.findOne({ tenantId: tid, code: a.code });
    if (!asset) {
      asset = await Asset.create({ 
        tenantId: tid, 
        code: a.code, 
        name: a.name, 
        workCenter: wcs[a.workCenterCode]._id,
        active: true
      });
      console.log('Created asset:', asset.code);
    }
    assets.push({ ...asset.toObject(), workCenterCode: a.workCenterCode });
  }

  // 5. Create Production Jobs (Completed)
  console.log('Creating completed production jobs...');
  for (let i = 0; i < 10; i++) {
    const prod = products[i % products.length];
    const bom = boms[i % boms.length];
    const asset = assets[i % assets.length];
    
    await ProductionJob.create({
      tenantId: tid,
      jobId: `JOB-${Date.now()}-${i}`,
      bom: bom._id,
      quantity: 10 + i,
      status: 'Completed',
      dueDate: new Date(),
      workCenterCode: asset.workCenterCode,
      travelerToken: `token-${Date.now()}-${i}`,
      operations: [
        {
          name: 'Main Operation',
          workCenterCode: asset.workCenterCode,
          status: 'done',
          plannedRunMin: 120,
          actualMachineMin: 110 + (i * 5),
          wipOutQty: 10 + i,
          scrapQty: i % 2 === 0 ? 1 : 0
        }
      ],
      costing: {
        actualLaborCost: 200 + (i * 20),
        actualMachineCost: 150 + (i * 15),
        actualOverheadCost: 50 + (i * 5)
      },
      updatedAt: new Date(Date.now() - (i * 86400000)) // Spread over last 10 days
    });
  }

  // 6. Create Paid Invoices
  console.log('Creating paid invoices...');
  for (let i = 0; i < 15; i++) {
    const prod = products[i % products.length];
    const qty = 5 + i;
    const amount = prod.price * qty;
    
    await Invoice.create({
      tenantId: tid,
      client: client._id,
      invoiceId: `INV-${Date.now()}-${i}`,
      amount: amount,
      status: 'Paid',
      dueDate: new Date(),
      invoiceDate: new Date(Date.now() - (i * 86400000)),
      lines: [
        {
          product: prod._id,
          quantity: qty,
          unitPrice: prod.price,
          sku: prod.sku
        }
      ]
    });
  }

  // 7. Create Downtime Events
  console.log('Creating downtime events...');
  for (let i = 0; i < 3; i++) {
    const asset = assets[i % assets.length];
    const start = new Date(Date.now() - (i * 86400000) - 3600000);
    const end = new Date(Date.now() - (i * 86400000));
    
    await DowntimeEvent.create({
      tenantId: tid,
      asset: asset._id,
      reason: 'Mechanical Failure',
      startedAt: start,
      endedAt: end,
      status: 'Resolved'
    });
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
