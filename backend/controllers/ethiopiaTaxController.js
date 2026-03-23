const asyncHandler = require('../middleware/asyncHandler');
const Invoice = require('../models/Invoice');
const VendorBill = require('../models/VendorBill');
const WithholdingCertificate = require('../models/WithholdingCertificate');
const { byTenant } = require('../utils/tenantQuery');
const {
  getTaxSettings,
} = require('../services/ethiopiaTaxService');
const { formatEthiopianLong, formatEthiopianNumeric } = require('../utils/ethiopianDate');

exports.getEthiopiaTaxSettings = asyncHandler(async (req, res) => {
  const data = await getTaxSettings(req.tenantId);
  res.json({ success: true, data });
});

exports.updateEthiopiaTaxSettings = asyncHandler(async (req, res) => {
  const allowed = [
    'companyLegalName',
    'companyTIN',
    'companyAddress',
    'companyPhone',
    'currency',
    'defaultVatRatePercent',
    'salesWithholdingRatePercent',
    'salesWhtBase',
    'purchaseWithholdingRatePercent',
    'salesPriceBasis',
    'eInvoicingNotes',
  ];
  const s = await getTaxSettings(req.tenantId);
  for (const k of allowed) {
    if (req.body[k] !== undefined) s[k] = req.body[k];
  }
  await s.save();
  res.json({ success: true, data: s });
});

function esc(x) {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Printable tax invoice (browser print). */
exports.getTaxInvoiceHtml = asyncHandler(async (req, res) => {
  const inv = await Invoice.findOne(byTenant(req, { _id: req.params.id })).populate('client');
  if (!inv) {
    res.status(404).setHeader('Content-Type', 'text/plain');
    return res.send('Invoice not found');
  }
  const settings = await getTaxSettings(req.tenantId);
  const c = inv.client;
  const cur = settings.currency || 'ETB';
  const taxable = inv.amountTaxable != null ? inv.amountTaxable : inv.amount;
  const vat = inv.vatAmount != null ? inv.vatAmount : 0;
  const wht = inv.salesWhtAmount != null ? inv.salesWhtAmount : 0;
  const gross = inv.grossBeforeWht != null ? inv.grossBeforeWht : taxable + vat;
  const net = inv.amount;

  const idate = new Date(inv.invoiceDate);
  const ethInv = formatEthiopianLong(idate);
  const ethInvN = formatEthiopianNumeric(idate);
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Tax Invoice ${esc(inv.invoiceId)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:16px;color:#111}
  h1{font-size:1.25rem;margin:0 0 8px}
  .am{font-family:'Noto Sans Ethiopic',sans-serif;font-size:14px}
  .muted{color:#555;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ccc;padding:8px;text-align:left}
  th{background:#f5f5f5;font-size:11px;text-transform:uppercase}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .total{font-weight:700}
  @media print{.no-print{display:none}}
</style></head><body>
  <p class="no-print"><a href="#" onclick="window.print()">Print</a></p>
  <h1>TAX INVOICE <span class="am">/ ግብር ደረሰኝ ተቀባይነት ያለው ሂሳብ</span></h1>
  <p class="muted">Ethiopia-oriented layout — verify rates & TIN with ERCA / current law.</p>
  <p><strong>${esc(settings.companyLegalName || 'Company')}</strong><br/>
  <span class="am">የግብር ከፋይ ቁጥር (TIN)</span>: ${esc(settings.companyTIN || '—')}<br/>
  ${esc(settings.companyAddress || '')}<br/>
  ${esc(settings.companyPhone || '')}</p>
  <hr/>
  <p><strong>Invoice / ደረሰኝ:</strong> ${esc(inv.invoiceId)}<br/>
  <strong>Date / ቀን (G.C.):</strong> ${idate.toLocaleDateString('en-GB')} &nbsp;
  <strong>Ethiopian / ኢ.ሣ:</strong> ${esc(ethInv)} <span class="muted">(${esc(ethInvN)})</span><br/>
  <strong>Due / ክፍያ መክፈያ:</strong> ${new Date(inv.dueDate).toLocaleDateString('en-GB')}</p>
  <p><strong>Bill to / ለ</strong><br/>
  ${esc(c?.name)}<br/>
  TIN: ${esc(inv.buyerTinSnapshot || c?.tin || '—')}<br/>
  ${esc(c?.address || '')}</p>
  <table>
    <tr><th>Description<br/><span class="am">መግለጫ</span></th><th class="num">Taxable (${cur})</th><th class="num">VAT ${inv.vatRate != null ? inv.vatRate + '%' : ''}</th><th class="num">WHT</th></tr>
    <tr>
      <td>${esc(inv.description || 'Supply of goods/services')}</td>
      <td class="num">${taxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td class="num">${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td class="num">${wht.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
    </tr>
  </table>
  <table style="margin-top:8px;max-width:400px;margin-left:auto">
    <tr><td>Subtotal (taxable)</td><td class="num">${taxable.toFixed(2)}</td></tr>
    <tr><td>Output VAT</td><td class="num">${vat.toFixed(2)}</td></tr>
    <tr><td>Total before WHT</td><td class="num">${gross.toFixed(2)}</td></tr>
    <tr><td>Sales withholding</td><td class="num">(${wht.toFixed(2)})</td></tr>
    <tr class="total"><td>Net receivable</td><td class="num">${net.toFixed(2)} ${cur}</td></tr>
  </table>
  <p class="muted" style="margin-top:24px">${esc(settings.eInvoicingNotes || '')}</p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

exports.issueSalesWithholdingCertificate = asyncHandler(async (req, res) => {
  const inv = await Invoice.findOne(byTenant(req, { _id: req.params.id })).populate('client');
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invoice not found' });
  }
  const wht = Number(inv.salesWhtAmount) || 0;
  if (wht <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invoice has no sales withholding amount; check tax settings and re-issue invoice from order if needed.',
    });
  }
  const settings = await getTaxSettings(req.tenantId);
  const period = `${new Date(inv.invoiceDate).getFullYear()}-${String(new Date(inv.invoiceDate).getMonth() + 1).padStart(2, '0')}`;
  const prefix = `WHT-S-${period}-`;
  const n = await WithholdingCertificate.countDocuments(
    byTenant(req, {
      certificateNumber: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    })
  );
  const certNo = `${prefix}${String(n + 1).padStart(4, '0')}`;
  const base =
    inv.amountTaxable != null
      ? inv.amountTaxable
      : (inv.grossBeforeWht != null ? inv.grossBeforeWht - (inv.vatAmount || 0) : inv.amount);
  const cert = await WithholdingCertificate.create({
    tenantId: req.tenantId,
    certificateNumber: certNo,
    type: 'on_sales',
    taxPeriod: period,
    payerTIN: inv.buyerTinSnapshot || inv.client?.tin || '',
    payerName: inv.client?.name || '',
    payeeTIN: settings.companyTIN || '',
    payeeName: settings.companyLegalName || '',
    baseAmount: base,
    ratePercent: inv.salesWhtRate || settings.salesWithholdingRatePercent,
    withheldAmount: wht,
    invoice: inv._id,
    recordedBy: req.user._id,
    notes: req.body.notes || '',
  });
  res.status(201).json({ success: true, data: cert });
});

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function sendCsv(res, filename, rows) {
  if (!rows.length) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send('\uFEFF');
  }
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(','), ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + lines.join('\r\n'));
}

/** Output VAT / sales register — field names for accountant mapping. */
exports.reportVatSalesCsv = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const list = await Invoice.find(
    byTenant(req, {
      invoiceDate: { $gte: from, $lte: to },
    })
  )
    .populate('client', 'name tin')
    .sort({ invoiceDate: 1 })
    .lean();
  const rows = list.map((inv) => ({
    invoiceId: inv.invoiceId,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
    invoiceDate_ethiopian: inv.invoiceDate ? formatEthiopianNumeric(inv.invoiceDate) : '',
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
    buyerName: inv.client?.name || '',
    buyerTIN: inv.buyerTinSnapshot || inv.client?.tin || '',
    taxableAmount_ETB: inv.amountTaxable != null ? inv.amountTaxable : inv.amount,
    vatRate_pct: inv.vatRate ?? '',
    outputVat_ETB: inv.vatAmount ?? 0,
    salesWithholding_ETB: inv.salesWhtAmount ?? 0,
    grossBeforeWht_ETB: inv.grossBeforeWht ?? '',
    netReceivable_ETB: inv.amount,
    status: inv.status,
    mapTo_vat_return: 'Output VAT column → outputVat_ETB; Taxable sales → taxableAmount_ETB',
  }));
  sendCsv(res, `vat-sales-register-${from.toISOString().slice(0, 10)}.csv`, rows);
});

exports.reportVatPurchasesCsv = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const list = await VendorBill.find(
    byTenant(req, {
      billDate: { $gte: from, $lte: to },
    })
  )
    .populate('vendor', 'name tin code')
    .sort({ billDate: 1 })
    .lean();
  const rows = list.map((b) => ({
    billNumber: b.billNumber,
    billDate: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : '',
    billDate_ethiopian: b.billDate ? formatEthiopianNumeric(b.billDate) : '',
    vendorName: b.vendor?.name || '',
    vendorTIN: b.vendor?.tin || '',
    supplyType: b.supplyType || '',
    taxableAmount_ETB: b.taxableAmount != null ? b.taxableAmount : b.amount,
    vatRate_pct: b.vatRate ?? '',
    inputVat_ETB: b.vatAmount ?? 0,
    vatRecoverable_YN: b.vatRecoverable !== false ? 'Y' : 'N',
    grossPayable_ETB: b.amount,
    purchaseWithholding_ETB: b.purchaseWhtAmount ?? 0,
    mapTo_vat_return: 'inputVat_ETB if vatRecoverable; import/local per supplyType',
  }));
  sendCsv(res, `vat-purchases-register-${from.toISOString().slice(0, 10)}.csv`, rows);
});

exports.reportWithholdingSalesCsv = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const list = await Invoice.find(
    byTenant(req, {
      invoiceDate: { $gte: from, $lte: to },
      salesWhtAmount: { $gt: 0 },
    })
  )
    .populate('client', 'name tin')
    .sort({ invoiceDate: 1 })
    .lean();
  const settings = await getTaxSettings(req.tenantId);
  const rows = list.map((inv) => ({
    invoiceId: inv.invoiceId,
    date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
    withheldFrom_party: inv.client?.name || '',
    withheldFrom_TIN: inv.buyerTinSnapshot || inv.client?.tin || '',
    supplier_party: settings.companyLegalName || '',
    supplier_TIN: settings.companyTIN || '',
    whtBase_ETB: inv.amountTaxable != null ? inv.amountTaxable : '',
    rate_pct: inv.salesWhtRate || settings.salesWithholdingRatePercent,
    withheldAmount_ETB: inv.salesWhtAmount,
    note: 'Amount withheld by customer from payment to you',
  }));
  sendCsv(res, `withholding-sales-${from.toISOString().slice(0, 10)}.csv`, rows);
});

exports.reportWithholdingPurchasesCsv = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const list = await VendorBill.find(
    byTenant(req, {
      billDate: { $gte: from, $lte: to },
      purchaseWhtAmount: { $gt: 0 },
    })
  )
    .populate('vendor', 'name tin')
    .sort({ billDate: 1 })
    .lean();
  const settings = await getTaxSettings(req.tenantId);
  const rows = list.map((b) => ({
    billNumber: b.billNumber,
    date: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : '',
    vendorName: b.vendor?.name || '',
    vendorTIN: b.vendor?.tin || '',
    payer_party: settings.companyLegalName || '',
    payer_TIN: settings.companyTIN || '',
    whtBase_ETB: b.taxableAmount != null ? b.taxableAmount : '',
    rate_pct: b.purchaseWhtRate || settings.purchaseWithholdingRatePercent,
    withheldAmount_ETB: b.purchaseWhtAmount,
    note: 'Amount you withhold when paying vendor',
  }));
  sendCsv(res, `withholding-purchases-${from.toISOString().slice(0, 10)}.csv`, rows);
});

exports.listWithholdingCertificates = asyncHandler(async (req, res) => {
  const list = await WithholdingCertificate.find(byTenant(req))
    .sort({ issueDate: -1 })
    .limit(200)
    .populate('invoice', 'invoiceId')
    .lean();
  res.json({ success: true, data: list });
});
