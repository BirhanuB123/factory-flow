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
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      unique: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    lines: [CogsLineSchema],
    totalCogs: { type: Number, required: true },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CogsEntry', CogsEntrySchema);
