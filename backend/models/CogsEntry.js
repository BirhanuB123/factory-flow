const mongoose = require('mongoose');

const CogsLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: String,
    quantity: Number,
    unitCost: Number,
    extCost: Number,
  },
  { _id: false }
);

/** COGS recognized when invoice is created (at selling price context: cost layer) */
const CogsEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    lines: [CogsLineSchema],
    totalCogs: { type: Number, required: true },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CogsEntrySchema.index({ tenantId: 1, invoice: 1 }, { unique: true });

module.exports = mongoose.model('CogsEntry', CogsEntrySchema);
