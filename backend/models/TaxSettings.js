const mongoose = require('mongoose');

const WhtCategoryRateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, default: '' },
    salesRatePercent: { type: Number, default: null },
    purchaseRatePercent: { type: Number, default: null },
  },
  { _id: false }
);

/** Ethiopia-oriented tax profile — one `key: 'default'` row per tenant. */
const TaxSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: { type: String, default: 'default' },
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
    /** If false, seller does not charge VAT by default (unless overridden per transaction). */
    sellerVatRegistered: { type: Boolean, default: true },
    /** Optional per-category rate table for exceptional WHT rules. */
    whtCategoryRates: { type: [WhtCategoryRateSchema], default: [] },
    /** Placeholder for future e-invoicing / digital reporting integration. */
    eInvoicingNotes: { type: String, default: '' },
    /** Prefix for sales tax invoices (alphanumeric + hyphen), e.g. INV or TX-SALES. */
    invoiceSeriesPrefix: { type: String, default: 'INV', trim: true },
    /**
     * Increments atomically when allocating invoiceId. First issued number is 1 → INV-000001.
     * Represents the last issued sequence index (0 = none issued yet).
     */
    nextInvoiceSequence: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TaxSettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('TaxSettings', TaxSettingsSchema);
