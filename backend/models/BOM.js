const mongoose = require('mongoose');

const BOMSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a BOM name'],
    trim: true
  },
  partNumber: {
    type: String,
    required: [true, 'Please add a part number'],
  },
  revision: {
    type: String,
    default: 'Rev A'
  },
  status: {
    type: String,
    enum: ['Active', 'Draft', 'Archived'],
    default: 'Draft'
  },
  /** Finished good produced when this BOM is built (one unit per assembly) */
  outputProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  /** BOM valid from this date (inclusive); omit/null = no start limit */
  effectiveFrom: {
    type: Date,
    default: null,
  },
  /** BOM valid until this date (inclusive); omit/null = no end */
  effectiveTo: {
    type: Date,
    default: null,
  },
  components: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [0, 'Quantity cannot be negative']
      }
    }
  ],
  /** Shop routing: sequence defines order on traveler / work orders */
  routing: [
    {
      sequence: { type: Number, default: 10 },
      code: { type: String, default: 'OP' },
      name: { type: String, required: true },
      workCenterCode: { type: String, default: '' },
      setupMinutes: { type: Number, default: 0, min: 0 },
      runMinutesPerUnit: { type: Number, default: 0, min: 0 },
      leadTimeDays: { type: Number, default: 0, min: 0 },
    },
  ],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
BOMSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

BOMSchema.index({ tenantId: 1, partNumber: 1 }, { unique: true });

module.exports = mongoose.model('BOM', BOMSchema);
