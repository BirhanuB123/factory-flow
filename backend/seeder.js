const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const BOM = require('./models/BOM');
const ProductionJob = require('./models/ProductionJob');
const Employee = require('./models/Employee');
const StockMovement = require('./models/StockMovement');
const { applyMovement } = require('./services/stockService');

dotenv.config();

const products = [
  { name: "Aluminum 6061-T6 Bar Stock", sku: "AL6061-BAR-1", category: "Raw Metal", stock: 245, unit: "pcs", reorderPoint: 50, price: 50, unitCost: 28.50, supplier: "MetalPro Supply", location: "Rack A-01" },
  { name: "Steel 4140 Round Bar", sku: "ST4140-RND-2", category: "Raw Metal", stock: 12, unit: "pcs", reorderPoint: 30, price: 80, unitCost: 42.00, supplier: "Allied Steel", location: "Rack A-03" },
  { name: "Carbide End Mill 1/2\"", sku: "TOOL-CEM-050", category: "Tooling", stock: 38, unit: "pcs", reorderPoint: 10, price: 150, unitCost: 85.00, supplier: "ToolMaster Inc.", location: "Tool Crib B" },
  { name: "Coolant - Semi-Synthetic 5gal", sku: "COOL-SS-5G", category: "Consumables", stock: 0, unit: "drums", reorderPoint: 5, price: 200, unitCost: 120.00, supplier: "CoolTech Fluids", location: "Storage C-02" },
  { name: "Brass C360 Hex Bar", sku: "BR360-HEX-1", category: "Raw Metal", stock: 180, unit: "pcs", reorderPoint: 40, price: 35, unitCost: 18.75, supplier: "MetalPro Supply", location: "Rack A-02" },
  { name: "Stainless 303 Plate 1/4\"", sku: "SS303-PLT-025", category: "Raw Metal", stock: 8, unit: "sheets", reorderPoint: 15, price: 350, unitCost: 195.00, supplier: "Allied Steel", location: "Rack D-01" },
  { name: "Thread Insert M8x1.25", sku: "HDWR-TI-M8", category: "Hardware", stock: 520, unit: "pcs", reorderPoint: 100, price: 2, unitCost: 0.85, supplier: "FastenAll Co.", location: "Bin E-14" },
  { name: "Drill Bit Set - Cobalt", sku: "TOOL-DBS-COB", category: "Tooling", stock: 3, unit: "sets", reorderPoint: 5, price: 400, unitCost: 210.00, supplier: "ToolMaster Inc.", location: "Tool Crib B" },
  { name: "O-Ring Kit - Viton", sku: "HDWR-ORK-VIT", category: "Hardware", stock: 500, unit: "kits", reorderPoint: 10, price: 90, unitCost: 45.00, supplier: "SealPro Ltd.", location: "Bin E-22" },
  { name: "Titanium Grade 5 Rod", sku: "TI-GR5-ROD-1", category: "Raw Metal", stock: 62, unit: "pcs", reorderPoint: 20, price: 600, unitCost: 310.00, supplier: "TitanSource", location: "Rack A-05" },
  { name: "Deburring Wheel 6\"", sku: "TOOL-DBW-6", category: "Tooling", stock: 15, unit: "pcs", reorderPoint: 8, price: 65, unitCost: 32.00, supplier: "ToolMaster Inc.", location: "Tool Crib A" },
  { name: "Safety Glasses - Clear", sku: "PPE-SG-CLR", category: "Consumables", stock: 48, unit: "pcs", reorderPoint: 20, price: 15, unitCost: 8.50, supplier: "SafetyFirst", location: "Storage F-01" },
  { name: "Hydraulic Manifold Block (FG)", sku: "HMB-4200-FG", category: "Finished Good", stock: 0, unit: "ea", reorderPoint: 5, price: 299, unitCost: 120, supplier: "—", location: "FG Cage" },
  { name: "CNC Spindle Adapter (FG)", sku: "CSA-1100-FG", category: "Finished Good", stock: 0, unit: "ea", reorderPoint: 5, price: 189, unitCost: 75, supplier: "—", location: "FG Cage" },
];

const seedDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    await StockMovement.deleteMany();
    const StockReservation = require('./models/StockReservation');
    await StockReservation.deleteMany();
    const PurchaseOrder = require('./models/PurchaseOrder');
    await PurchaseOrder.deleteMany();
    await Product.deleteMany();
    await BOM.deleteMany();
    await ProductionJob.deleteMany();
    await Employee.deleteMany();

    const employees = [
      { employeeId: 'EMP-001', name: 'Admin User', role: 'Admin', department: 'Management', email: 'admin@integracnc.com', password: 'password123', salary: 45000, status: 'Active' },
      { employeeId: 'EMP-002', name: 'Finance Head', role: 'finance_head', department: 'Finance', email: 'finance@integracnc.com', password: 'password123', salary: 38000, status: 'Active' },
      { employeeId: 'EMP-003', name: 'HR Head', role: 'hr_head', department: 'HR', email: 'hr@integracnc.com', password: 'password123', salary: 32000, status: 'Active' },
      { employeeId: 'EMP-004', name: 'Basic Employee', role: 'employee', department: 'Production', email: 'employee@integracnc.com', password: 'password123', salary: 12000, status: 'Active' },
      { employeeId: 'EMP-005', name: 'Purchasing Lead', role: 'purchasing_head', department: 'Procurement', email: 'buyer@integracnc.com', password: 'password123', salary: 28000, status: 'Active' },
      { employeeId: 'EMP-006', name: 'Warehouse Lead', role: 'warehouse_head', department: 'Warehouse', email: 'warehouse@integracnc.com', password: 'password123', salary: 22000, status: 'Active' },
    ];

    for (const emp of employees) {
      await Employee.create(emp);
    }
    console.log('Employees seeded');

    const createdProducts = await Product.insertMany(products);
    console.log('Products inserted');

    for (const p of createdProducts) {
      const s = p.stock;
      if (s > 0) {
        await Product.findByIdAndUpdate(p._id, { $set: { stock: 0 } });
        await applyMovement(null, {
          productId: p._id,
          delta: s,
          movementType: 'opening_balance',
          referenceType: 'Product',
          referenceId: p._id,
          note: 'Seed opening balance',
        });
      }
    }
    console.log('Opening balance movements recorded');

    const productMap = {};
    createdProducts.forEach((p) => {
      productMap[p.sku] = p._id;
    });

    const boms = [
      {
        name: "Hydraulic Manifold Block",
        partNumber: "HMB-4200",
        revision: "Rev C",
        status: "Active",
        outputProduct: productMap["HMB-4200-FG"],
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: null,
        components: [
          { product: productMap["AL6061-BAR-1"], quantity: 2 },
          { product: productMap["HDWR-ORK-VIT"], quantity: 1 },
          { product: productMap["HDWR-TI-M8"], quantity: 8 },
          { product: productMap["TOOL-CEM-050"], quantity: 1 },
        ],
        notes: "Production-ready. Approved by engineering.",
      },
      {
        name: "CNC Spindle Adapter",
        partNumber: "CSA-1100",
        revision: "Rev A",
        status: "Active",
        outputProduct: productMap["CSA-1100-FG"],
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: null,
        components: [
          { product: productMap["ST4140-RND-2"], quantity: 1 },
          { product: productMap["BR360-HEX-1"], quantity: 2 },
          { product: productMap["TOOL-DBW-6"], quantity: 1 },
        ],
        notes: "Standard adapter for Haas VF-2.",
      },
    ];

    const createdBoms = await BOM.insertMany(boms);
    console.log('BOMs seeded');

    const jobs = [
      {
        jobId: "JOB-1001",
        bom: createdBoms[0]._id,
        quantity: 50,
        status: "In Progress",
        priority: "High",
        dueDate: new Date("2026-03-25"),
        assignedTo: "Mike Chen",
        inventoryPosted: false,
      },
      {
        jobId: "JOB-1002",
        bom: createdBoms[1]._id,
        quantity: 24,
        status: "Scheduled",
        priority: "Medium",
        dueDate: new Date("2026-03-30"),
        assignedTo: "Sarah Miller",
        inventoryPosted: false,
      },
    ];

    await ProductionJob.insertMany(jobs);
    console.log('Production Jobs seeded');

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
