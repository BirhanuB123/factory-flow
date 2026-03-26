const mongoose = require('mongoose');
const TaxSettings = require('../models/TaxSettings');

async function getTaxSettings(tenantId) {
  if (!tenantId) {
    throw new Error('getTaxSettings: tenantId is required');
  }
  const tid = new mongoose.Types.ObjectId(tenantId);
  let doc = await TaxSettings.findOne({ tenantId: tid, key: 'default' });
  if (!doc) {
    doc = await TaxSettings.create({ tenantId: tid, key: 'default' });
  }
  return doc;
}

function sanitizeInvoicePrefix(raw) {
  const s = String(raw ?? 'INV')
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .slice(0, 20);
  return s || 'INV';
}

/**
 * Atomically allocate the next sales invoice number for the tenant (TaxSettings default row).
 * @returns {Promise<string>} e.g. INV-000042
 */
async function allocateNextInvoiceNumber(tenantId) {
  const tid = new mongoose.Types.ObjectId(tenantId);
  await TaxSettings.updateOne(
    { tenantId: tid, key: 'default' },
    { $setOnInsert: { tenantId: tid, key: 'default' } },
    { upsert: true }
  );
  const updated = await TaxSettings.findOneAndUpdate(
    { tenantId: tid, key: 'default' },
    { $inc: { nextInvoiceSequence: 1 } },
    { new: true }
  ).lean();
  if (!updated) {
    throw new Error('allocateNextInvoiceNumber: TaxSettings not found');
  }
  const prefix = sanitizeInvoicePrefix(updated.invoiceSeriesPrefix);
  const seq = Math.max(1, Number(updated.nextInvoiceSequence) || 1);
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function pickCategoryRates(settings, taxCategory) {
  const key = String(taxCategory || '').trim().toLowerCase();
  if (!key) return null;
  const rows = Array.isArray(settings?.whtCategoryRates) ? settings.whtCategoryRates : [];
  return (
    rows.find((r) => String(r?.key || '').trim().toLowerCase() === key) ||
    rows.find((r) => String(r?.label || '').trim().toLowerCase() === key) ||
    null
  );
}

/**
 * @param {number} taxableBase - ex-VAT sales amount
 * @param {{ vatRegistered?: boolean }} client
 * @param {object} settings - TaxSettings lean or doc
 * @param {{ taxCategory?: string, forceVatRate?: number, forceWhtRate?: number, isVatExempt?: boolean }} [options]
 * @returns {{ taxableAmount, vatRate, vatAmount, salesWhtRate, salesWhtAmount, grossBeforeWht, netPayable }}
 */
function computeSalesInvoiceTax(taxableBase, client, settings, options = {}) {
  const categoryRate = pickCategoryRates(settings, options.taxCategory);
  const defaultVatRate = Number(settings.defaultVatRatePercent) || 0;
  const defaultWhtRate =
    (categoryRate && Number(categoryRate.salesRatePercent)) ||
    Number(settings.salesWithholdingRatePercent) ||
    0;
  const vatAllowed = settings.sellerVatRegistered !== false;
  let vatRate = vatAllowed ? defaultVatRate : 0;
  if (options.isVatExempt) vatRate = 0;
  if (Number.isFinite(Number(options.forceVatRate))) vatRate = Math.max(0, Number(options.forceVatRate));
  let whtRate = defaultWhtRate;
  if (Number.isFinite(Number(options.forceWhtRate))) whtRate = Math.max(0, Number(options.forceWhtRate));
  let taxable = round2(taxableBase);
  if (settings.salesPriceBasis === 'inclusive_vat' && vatRate > 0) {
    taxable = round2(taxableBase / (1 + vatRate / 100));
  }
  const vatAmount = round2((taxable * vatRate) / 100);
  const grossBeforeWht = round2(taxable + vatAmount);
  let whtBase = taxable;
  if (settings.salesWhtBase === 'total_incl_vat') {
    whtBase = grossBeforeWht;
  }
  const salesWhtAmount = round2((whtBase * whtRate) / 100);
  const netPayable = round2(grossBeforeWht - salesWhtAmount);
  return {
    taxableAmount: taxable,
    vatRate,
    vatAmount,
    salesWhtRate: whtRate,
    salesWhtAmount,
    grossBeforeWht,
    netPayable,
  };
}

/**
 * Purchase: local supplier invoice (ex-VAT lines), optional WHT on payment.
 */
function computePurchaseBillTax(taxableTotal, settings, options = {}) {
  const { supplyType = 'local_vat_registered', applyVat = true, applyWht = true } = options;
  const categoryRate = pickCategoryRates(settings, options.taxCategory);
  let vatRate =
    supplyType === 'import' || supplyType === 'local_unregistered' ? 0 : Number(settings.defaultVatRatePercent) || 0;
  if (options.isVatExempt) vatRate = 0;
  if (Number.isFinite(Number(options.forceVatRate))) vatRate = Math.max(0, Number(options.forceVatRate));
  const taxable = round2(taxableTotal);
  const vatAmount =
    applyVat && vatRate > 0 ? round2((taxable * vatRate) / 100) : 0;
  const gross = round2(taxable + vatAmount);
  let whtRate =
    applyWht && supplyType !== 'import'
      ? (categoryRate && Number(categoryRate.purchaseRatePercent)) ||
        Number(settings.purchaseWithholdingRatePercent) ||
        0
      : 0;
  if (Number.isFinite(Number(options.forceWhtRate))) whtRate = Math.max(0, Number(options.forceWhtRate));
  const purchaseWhtAmount = round2((taxable * whtRate) / 100);
  const vatRecoverable = supplyType === 'local_vat_registered' && vatAmount > 0;
  return {
    taxableAmount: taxable,
    vatRate,
    vatAmount,
    totalGross: gross,
    purchaseWhtRate: whtRate,
    purchaseWhtAmount,
    netCashToVendor: round2(gross - purchaseWhtAmount),
    vatRecoverable,
    supplyType,
  };
}

module.exports = {
  getTaxSettings,
  allocateNextInvoiceNumber,
  sanitizeInvoicePrefix,
  computeSalesInvoiceTax,
  computePurchaseBillTax,
  round2,
};
