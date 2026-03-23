const asyncHandler = require('../middleware/asyncHandler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductionJob = require('../models/ProductionJob');
const Invoice = require('../models/Invoice');
const VendorBill = require('../models/VendorBill');
const { sendManagerDigest } = require('../services/mailService');
const { byTenant } = require('../utils/tenantQuery');

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function sendCsv(res, filename, rows) {
  const header = rows[0] ? Object.keys(rows[0]).join(',') : '';
  const lines = rows.map((r) =>
    Object.values(r)
      .map((v) => csvEscape(v))
      .join(',')
  );
  const body = [header, ...lines].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + body);
}

exports.exportOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find(byTenant(req))
    .populate('client', 'name')
    .sort({ orderDate: -1 })
    .limit(5000)
    .lean();
  const rows = orders.map((o) => ({
    id: o._id,
    client: o.client?.name || '',
    status: o.status,
    total: o.totalAmount,
    discountPct: o.discountPercent || 0,
    approval: o.approvalStatus || 'none',
    orderDate: o.orderDate ? new Date(o.orderDate).toISOString().slice(0, 10) : '',
  }));
  sendCsv(res, `orders-${Date.now()}.csv`, rows);
});

exports.exportInventory = asyncHandler(async (req, res) => {
  const products = await Product.find(byTenant(req)).sort({ sku: 1 }).lean();
  const rows = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    stock: p.stock,
    unitCost: p.unitCost,
    costingMethod: p.costingMethod || 'average',
    barcode: p.barcode || '',
  }));
  sendCsv(res, `inventory-${Date.now()}.csv`, rows);
});

exports.exportProduction = asyncHandler(async (req, res) => {
  const jobs = await ProductionJob.find(byTenant(req)).sort({ createdAt: -1 }).limit(5000).lean();
  const rows = jobs.map((j) => ({
    jobId: j.jobId,
    status: j.status,
    quantity: j.quantity,
    dueDate: j.dueDate ? new Date(j.dueDate).toISOString().slice(0, 10) : '',
  }));
  sendCsv(res, `production-${Date.now()}.csv`, rows);
});

exports.exportAR = asyncHandler(async (req, res) => {
  const inv = await Invoice.find(byTenant(req, { status: { $in: ['Pending', 'Overdue'] } }))
    .populate('client', 'name')
    .lean();
  const rows = inv.map((i) => ({
    invoiceId: i.invoiceId,
    client: i.client?.name || '',
    amount: i.amount,
    status: i.status,
    dueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '',
  }));
  sendCsv(res, `ar-open-${Date.now()}.csv`, rows);
});

exports.exportAP = asyncHandler(async (req, res) => {
  const bills = await VendorBill.find(
    byTenant(req, {
      status: { $in: ['Open', 'Partial', 'Overdue'] },
    })
  )
    .populate('vendor', 'name code')
    .lean();
  const rows = bills.map((b) => ({
    billNumber: b.billNumber,
    vendor: b.vendor?.name || '',
    amount: b.amount,
    paid: b.amountPaid,
    balance: b.amount - b.amountPaid,
    dueDate: b.dueDate ? new Date(b.dueDate).toISOString().slice(0, 10) : '',
    status: b.status,
  }));
  sendCsv(res, `ap-open-${Date.now()}.csv`, rows);
});

/** Stub: trigger digest email to managers (configure SMTP in env). */
exports.postEmailDigest = asyncHandler(async (req, res) => {
  const r = await sendManagerDigest();
  res.json({
    success: true,
    message: r.sent ? 'Digest sent' : r.message || 'Email not configured or skipped',
    data: r,
  });
});
