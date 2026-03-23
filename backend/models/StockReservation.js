const mongoose = require('mongoose');

const StockReservationSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: [0.0001, 'Quantity must be positive'],
  },
  status: {
    type: String,
    enum: ['active', 'released', 'consumed'],
    default: 'active',
    index: true,
  },
  refType: {
    type: String,
    enum: ['Order', 'ProductionJob'],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  /** Sales order line index when refType === Order */
  lineIndex: {
    type: Number,
    default: null,
  },
  note: { type: String, default: '' },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

StockReservationSchema.index({ tenantId: 1, refType: 1, refId: 1, status: 1 });
StockReservationSchema.index({ tenantId: 1, product: 1, status: 1 });

module.exports = mongoose.model('StockReservation', StockReservationSchema);
