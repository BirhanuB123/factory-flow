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

/** Xero-style sales invoice export. */
exports.xeroInvoicesCsv = asyncHandler(async (req, res) => {
  const inv = await Invoice.find(byTenant(req))
    .populate('client', 'name email')
    .sort({ invoiceDate: -1 })
    .limit(2000)
    .lean();

  const rows = inv.map((i) => ({
    ContactName: i.client?.name || 'Customer',
    EmailAddress: i.client?.email || '',
    InvoiceNumber: i.invoiceId,
    Reference: i.description || '',
    InvoiceDate: i.invoiceDate ? new Date(i.invoiceDate).toISOString().slice(0, 10) : '',
    DueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '',
    Description: i.description || 'Sales Invoice',
    Quantity: 1,
    UnitAmount: i.amount,
    AccountCode: '200', // Default Sales account for Xero
    TaxType: i.vatAmount > 0 ? 'Tax on Sales' : 'None',
    Status: i.status === 'Paid' ? 'PAID' : 'DRAFT',
  }));

  const keys = [
    'ContactName', 'EmailAddress', 'InvoiceNumber', 'Reference', 
    'InvoiceDate', 'DueDate', 'Description', 'Quantity', 
    'UnitAmount', 'AccountCode', 'TaxType', 'Status'
  ];
  
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="xero-sales-invoices.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

/** Xero-style purchase bills export. */
exports.xeroBillsCsv = asyncHandler(async (req, res) => {
  const bills = await VendorBill.find(byTenant(req))
    .populate('vendor', 'name email')
    .sort({ billDate: -1 })
    .limit(2000)
    .lean();

  const rows = bills.map((b) => ({
    ContactName: b.vendor?.name || 'Vendor',
    EmailAddress: b.vendor?.email || '',
    InvoiceNumber: b.billNumber,
    Reference: b.notes || '',
    InvoiceDate: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : '',
    DueDate: b.dueDate ? new Date(b.dueDate).toISOString().slice(0, 10) : '',
    Description: b.notes || 'Purchase Bill',
    Quantity: 1,
    UnitAmount: b.amount,
    AccountCode: '300', // Default Purchases account for Xero
    TaxType: 'Tax on Purchases',
    Status: b.status === 'Paid' ? 'PAID' : 'DRAFT',
  }));

  const keys = [
    'ContactName', 'EmailAddress', 'InvoiceNumber', 'Reference', 
    'InvoiceDate', 'DueDate', 'Description', 'Quantity', 
    'UnitAmount', 'AccountCode', 'TaxType', 'Status'
  ];
  
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="xero-purchase-bills.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

/** QuickBooks-style bill export. */
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
    Item: 'Services',
  }));

  const keys = ['Vendor', 'RefNumber', 'TxnDate', 'DueDate', 'Amount', 'Memo', 'Item'];
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="qb-bills.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});

/** QuickBooks-style expenses export. */
exports.qbExpensesCsv = asyncHandler(async (req, res) => {
  const exps = await Expense.find(byTenant(req)).sort({ date: -1 }).limit(2000).lean();

  const rows = exps.map((e) => ({
    Date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
    Account: e.category || 'General Expense',
    Amount: e.amount,
    Memo: e.description || '',
    PaymentMethod: e.paymentMethod || 'Cash',
  }));

  const keys = ['Date', 'Account', 'Amount', 'Memo', 'PaymentMethod'];
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','));
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="qb-expenses.csv"');
  res.send('\uFEFF' + [header, ...lines].join('\r\n'));
});
