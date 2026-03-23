const asyncHandler = require('../middleware/asyncHandler');
const Vendor = require('../models/Vendor');
const VendorBill = require('../models/VendorBill');
const VendorPayment = require('../models/VendorPayment');
const PurchaseOrder = require('../models/PurchaseOrder');
const {
  getTaxSettings,
  computePurchaseBillTax,
} = require('../services/ethiopiaTaxService');
const { byTenant } = require('../utils/tenantQuery');

exports.listVendors = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = byTenant(req, { active: true });
  if (q) {
    filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];
  }
  const list = await Vendor.find(filter).sort({ name: 1 });
  res.json({ success: true, data: list });
});

exports.allVendors = asyncHandler(async (req, res) => {
  const list = await Vendor.find(byTenant(req)).sort({ name: 1 });
  res.json({ success: true, data: list });
});

exports.createVendor = asyncHandler(async (req, res) => {
  const {
    code,
    name,
    email,
    phone,
    address,
    paymentTermsDays,
    taxId,
    tin,
    vatRegistered,
    notes,
  } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'code and name required' });
  }
  const v = await Vendor.create({
    tenantId: req.tenantId,
    code: String(code).trim().toUpperCase(),
    name: String(name).trim(),
    email: email || '',
    phone: phone || '',
    address: address || '',
    paymentTermsDays: Number(paymentTermsDays) || 30,
    taxId: taxId || '',
    tin: tin || taxId || '',
    vatRegistered: vatRegistered !== false,
    notes: notes || '',
  });
  res.status(201).json({ success: true, data: v });
});

exports.updateVendor = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  delete patch.tenantId;
  const v = await Vendor.findOneAndUpdate(byTenant(req, { _id: req.params.id }), patch, {
    new: true,
    runValidators: true,
  });
  if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
  res.json({ success: true, data: v });
});

exports.listVendorBills = asyncHandler(async (req, res) => {
  const list = await VendorBill.find(byTenant(req))
    .populate('vendor', 'code name')
    .populate('purchaseOrder', 'poNumber')
    .sort({ dueDate: -1 });
  res.json({ success: true, data: list });
});

exports.createVendorBill = asyncHandler(async (req, res) => {
  const {
    vendor,
    lines,
    dueDate,
    billDate,
    notes,
    billNumber,
    supplyType: stIn,
    skipPurchaseTax,
  } = req.body;
  if (!vendor || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'vendor and lines[] required',
    });
  }
  let taxable = 0;
  const norm = lines.map((l) => {
    const a = Number(l.amount) || Number(l.quantity || 1) * Number(l.unitCost || 0);
    taxable += a;
    return {
      description: l.description || 'Line',
      quantity: Number(l.quantity) || 1,
      unitCost: Number(l.unitCost) || 0,
      amount: a,
      product: l.product || null,
    };
  });
  const settings = await getTaxSettings(req.tenantId);
  const supplyType = stIn || 'local_vat_registered';
  const tax = skipPurchaseTax
    ? {
        taxableAmount: taxable,
        vatRate: 0,
        vatAmount: 0,
        totalGross: taxable,
        purchaseWhtRate: 0,
        purchaseWhtAmount: 0,
        vatRecoverable: false,
        supplyType: 'import',
      }
    : computePurchaseBillTax(taxable, settings, { supplyType });
  const bn =
    billNumber || `VB-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const terms = (await Vendor.findOne(byTenant(req, { _id: vendor })))?.paymentTermsDays || 30;
  const due = dueDate ? new Date(dueDate) : new Date(Date.now() + terms * 86400000);
  const bill = await VendorBill.create({
    tenantId: req.tenantId,
    billNumber: bn,
    vendor,
    lines: norm,
    amount: tax.totalGross,
    taxableAmount: tax.taxableAmount,
    vatRate: tax.vatRate,
    vatAmount: tax.vatAmount,
    purchaseWhtRate: tax.purchaseWhtRate,
    purchaseWhtAmount: tax.purchaseWhtAmount,
    supplyType: tax.supplyType,
    vatRecoverable: tax.vatRecoverable,
    dueDate: due,
    billDate: billDate ? new Date(billDate) : new Date(),
    notes: notes || '',
    status: 'Open',
  });
  const populated = await VendorBill.findOne(byTenant(req, { _id: bill._id })).populate(
    'vendor',
    'code name'
  );
  res.status(201).json({ success: true, data: populated });
});

exports.createVendorBillFromPO = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOne(byTenant(req, { _id: req.params.poId })).populate(
    'lines.product'
  );
  if (!po) {
    return res.status(404).json({ success: false, message: 'PO not found' });
  }
  if (!po.vendor) {
    return res.status(400).json({
      success: false,
      message: 'PO has no vendor linked; set vendor on PO or create manual bill',
    });
  }
  const dup = await VendorBill.findOne(byTenant(req, { purchaseOrder: po._id }));
  if (dup) {
    return res.status(400).json({
      success: false,
      message: 'Bill already exists for this PO',
      data: dup,
    });
  }
  const lines = [];
  let taxable = 0;
  for (const l of po.lines) {
    const q = l.quantityReceived;
    if (q <= 0) continue;
    const uc = Number(l.unitCost) || 0;
    const ext = q * uc;
    taxable += ext;
    lines.push({
      description: `${l.product?.sku || ''} ${l.product?.name || 'Item'}`.trim(),
      quantity: q,
      unitCost: uc,
      amount: ext,
      product: l.product?._id || l.product,
    });
  }
  if (lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'PO has no received lines to bill',
    });
  }
  const settings = await getTaxSettings(req.tenantId);
  const supplyType = po.supplyType === 'import' ? 'import' : 'local_vat_registered';
  const tax = computePurchaseBillTax(taxable, settings, { supplyType });
  const vendor = await Vendor.findOne(byTenant(req, { _id: po.vendor }));
  const due = new Date(Date.now() + (vendor?.paymentTermsDays || 30) * 86400000);
  const bill = await VendorBill.create({
    tenantId: req.tenantId,
    billNumber: `VB-PO-${po.poNumber}-${Date.now().toString(36)}`,
    vendor: po.vendor,
    purchaseOrder: po._id,
    lines,
    amount: tax.totalGross,
    taxableAmount: tax.taxableAmount,
    vatRate: tax.vatRate,
    vatAmount: tax.vatAmount,
    purchaseWhtRate: tax.purchaseWhtRate,
    purchaseWhtAmount: tax.purchaseWhtAmount,
    supplyType: tax.supplyType,
    vatRecoverable: tax.vatRecoverable,
    dueDate: due,
    status: 'Open',
    notes: `From ${po.poNumber}`,
  });
  const populated = await VendorBill.findOne(byTenant(req, { _id: bill._id }))
    .populate('vendor', 'code name')
    .populate('purchaseOrder', 'poNumber');
  res.status(201).json({ success: true, data: populated });
});

async function recomputeBillStatus(bill) {
  const open = bill.amount - bill.amountPaid;
  let status = 'Open';
  if (open <= 0.001) status = 'Paid';
  else if (bill.amountPaid > 0) status = 'Partial';
  if (status !== 'Paid' && new Date(bill.dueDate) < new Date()) status = 'Overdue';
  bill.status = status;
  await bill.save();
}

exports.recordVendorPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, paidAt } = req.body;
  const bill = await VendorBill.findOne(byTenant(req, { _id: req.params.id }));
  if (!bill) {
    return res.status(404).json({ success: false, message: 'Bill not found' });
  }
  const pay = Number(amount);
  if (!pay || pay <= 0) {
    return res.status(400).json({ success: false, message: 'amount required' });
  }
  const remaining = bill.amount - bill.amountPaid;
  if (pay > remaining + 0.01) {
    return res.status(400).json({
      success: false,
      message: `Payment exceeds open balance (${remaining.toFixed(2)})`,
    });
  }
  await VendorPayment.create({
    tenantId: req.tenantId,
    vendorBill: bill._id,
    amount: pay,
    method: method || 'ach',
    reference: reference || '',
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    recordedBy: req.user._id,
  });
  bill.amountPaid += pay;
  await recomputeBillStatus(bill);
  const populated = await VendorBill.findOne(byTenant(req, { _id: bill._id })).populate(
    'vendor',
    'code name'
  );
  res.json({ success: true, data: populated });
});

exports.getAPAging = asyncHandler(async (req, res) => {
  const now = new Date();
  await VendorBill.updateMany(
    byTenant(req, { status: { $in: ['Open', 'Partial'] }, dueDate: { $lt: now } }),
    { $set: { status: 'Overdue' } }
  );

  const open = await VendorBill.find(
    byTenant(req, {
      status: { $in: ['Open', 'Partial', 'Overdue'] },
      $expr: { $lt: ['$amountPaid', '$amount'] },
    })
  )
    .populate('vendor', 'code name')
    .sort({ dueDate: 1 })
    .lean();

  const buckets = {
    notDue: [],
    days1_30: [],
    days31_60: [],
    days61_90: [],
    days90plus: [],
  };

  for (const b of open) {
    const bal = b.amount - b.amountPaid;
    if (bal <= 0) continue;
    const due = new Date(b.dueDate);
    const daysPast = Math.floor((now - due) / 86400000);
    const row = {
      _id: b._id,
      billNumber: b.billNumber,
      vendorName: b.vendor?.name || '—',
      balance: bal,
      dueDate: b.dueDate,
      status: b.status,
      daysPastDue: Math.max(0, daysPast),
    };
    if (daysPast <= 0) buckets.notDue.push(row);
    else if (daysPast <= 30) buckets.days1_30.push(row);
    else if (daysPast <= 60) buckets.days31_60.push(row);
    else if (daysPast <= 90) buckets.days61_90.push(row);
    else buckets.days90plus.push(row);
  }

  const sum = (arr) => arr.reduce((s, r) => s + r.balance, 0);
  res.json({
    success: true,
    data: {
      buckets,
      totals: {
        notDue: sum(buckets.notDue),
        days1_30: sum(buckets.days1_30),
        days31_60: sum(buckets.days31_60),
        days61_90: sum(buckets.days61_90),
        days90plus: sum(buckets.days90plus),
        openAP:
          sum(buckets.notDue) +
          sum(buckets.days1_30) +
          sum(buckets.days31_60) +
          sum(buckets.days61_90) +
          sum(buckets.days90plus),
      },
    },
  });
});
