const mongoose = require('mongoose');

/**
 * Singleton tax profile for Ethiopia-oriented statutory reporting.
 * One document with key 'default'.
 */
const TaxSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    companyLegalName: { type: String, default: '' },
    companyTIN: { type: String, default: '' },
    companyAddress: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    currency: { type: String, default: 'ETB' },
    /** Standard VAT % (Ethiopia commonly 15% on many supplies — verify with current law). */
    defaultVatRatePercent: { type: Number, default: 15 },
    /** Sales WHT % withheld by buyer from payment to you (varies by supply type). */
    salesWithholdingRatePercent: { type: Number, default: 2 },
    /** WHT base: taxable amount before VAT. */
    salesWhtBase: {
      type: String,
      enum: ['taxable_excl_vat', 'total_incl_vat'],
      default: 'taxable_excl_vat',
    },
    /** Purchase WHT % you withhold when paying local suppliers. */
    purchaseWithholdingRatePercent: { type: Number, default: 3 },
    /** Order/quote line amounts treated as ex-VAT taxable base. */
    salesPriceBasis: {
      type: String,
      enum: ['exclusive_vat', 'inclusive_vat'],
      default: 'exclusive_vat',
    },
    /** Placeholder for future e-invoicing / digital reporting integration. */
    eInvoicingNotes: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TaxSettings', TaxSettingsSchema);
