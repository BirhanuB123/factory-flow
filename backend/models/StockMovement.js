const mongoose = require('mongoose');

const MOVEMENT_TYPES = [
  'opening_balance',
  'receipt',
  'issue',
  'adjustment',
  'production_consume',
  'production_output',
  'production_issue',
  'production_return',
];

const StockMovementSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  /** Positive = stock increase, negative = decrease */
  delta: {
    type: Number,
    required: true,
  },
  movementType: {
    type: String,
    enum: MOVEMENT_TYPES,
    required: true,
  },
  referenceType: {
    type: String,
    enum: ['ProductionJob', 'Product', 'Manual', 'PurchaseOrder', 'Shipment', null],
    default: null,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  note: { type: String, default: '' },
  lotNumber: { type: String, default: '' },
  batchNumber: { type: String, default: '' },
  /** Snapshot of on-hand after this movement */
  balanceAfter: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

StockMovementSchema.index({ createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, product: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', StockMovementSchema);
module.exports.MOVEMENT_TYPES = MOVEMENT_TYPES;
