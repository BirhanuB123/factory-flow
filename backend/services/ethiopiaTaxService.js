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

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {number} taxableBase - ex-VAT sales amount
 * @param {{ vatRegistered?: boolean }} client
 * @param {object} settings - TaxSettings lean or doc
 * @returns {{ taxableAmount, vatRate, vatAmount, salesWhtRate, salesWhtAmount, grossBeforeWht, netPayable }}
 */
function computeSalesInvoiceTax(taxableBase, client, settings) {
  const vatRate = Number(settings.defaultVatRatePercent) || 0;
  const whtRate = Number(settings.salesWithholdingRatePercent) || 0;
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
  const vatRate =
    supplyType === 'import' || supplyType === 'local_unregistered' ? 0 : Number(settings.defaultVatRatePercent) || 0;
  const taxable = round2(taxableTotal);
  const vatAmount =
    applyVat && vatRate > 0 ? round2((taxable * vatRate) / 100) : 0;
  const gross = round2(taxable + vatAmount);
  const whtRate =
    applyWht && supplyType !== 'import' ? Number(settings.purchaseWithholdingRatePercent) || 0 : 0;
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
  computeSalesInvoiceTax,
  computePurchaseBillTax,
  round2,
};
