const mongoose = require('mongoose');

const SavedViewSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    name: { type: String, required: true, trim: true },
    module: {
      type: String,
      enum: [
        'orders',
        'inventory',
        'production',
        'finance',
        'finance_ar',
        'finance_ap',
        'shipments',
      ],
      required: true,
    },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SavedViewSchema.index({ tenantId: 1, user: 1, module: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SavedView', SavedViewSchema);
