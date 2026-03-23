const asyncHandler = require('../middleware/asyncHandler');
const Invoice = require('../models/Invoice');
const VendorBill = require('../models/VendorBill');
const Expense = require('../models/Expense');
const { byTenant } = require('../utils/tenantQuery');

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

/** Xero-style sales invoice export (minimal columns). */
exports.xeroInvoicesCsv = asyncHandler(async (req, res) => {
  const inv = await Invoice.find(byTenant(req))
    .populate('client', 'name')
    .sort({ invoiceDate: -1 })
    .limit(2000)
    .lean();
  const rows = inv.map((i) => ({
    ContactName: i.client?.name || 'Customer',
    InvoiceNumber: i.invoiceId,
    InvoiceDate: i.invoiceDate
      ? new Date(i.invoiceDate).toISOString().slice(0, 10)
      : '',
    DueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '',
    Total: i.amount,
    Status: i.status,
  }));
  const keys = ['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Total', 'Status'];
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="xero-invoices.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

/** QuickBooks-style bill export (vendor AP). */
exports.quickBooksBillsCsv = asyncHandler(async (req, res) => {
  const bills = await VendorBill.find(byTenant(req))
    .populate('vendor', 'name')
    .sort({ billDate: -1 })
    .limit(2000)
    .lean();
  const rows = bills.map((b) => ({
    Vendor: b.vendor?.name || '',
    RefNumber: b.billNumber,
    TxnDate: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : '',
    DueDate: b.dueDate ? new Date(b.dueDate).toISOString().slice(0, 10) : '',
    Amount: b.amount,
    Memo: b.notes || '',
  }));
  const keys = ['Vendor', 'RefNumber', 'TxnDate', 'DueDate', 'Amount', 'Memo'];
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="qb-bills.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

exports.qbExpensesCsv = asyncHandler(async (req, res) => {
  const exps = await Expense.find(byTenant(req)).sort({ date: -1 }).limit(2000).lean();
  const rows = exps.map((e) => ({
    Date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
    Account: e.category || 'Expense',
    Amount: e.amount,
    Memo: e.description || '',
  }));
  const keys = ['Date', 'Account', 'Amount', 'Memo'];
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="qb-expenses.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});
