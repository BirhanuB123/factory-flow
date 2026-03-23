const mongoose = require('mongoose');

const ShipmentLineSchema = new mongoose.Schema(
  {
    lineIndex: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0.0001 },
    lotNumber: { type: String, default: '' },
  },
  { _id: false }
);

const ShipmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    shipmentNumber: { type: String, required: true, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    lines: [ShipmentLineSchema],
    status: {
      type: String,
      enum: ['draft', 'picked', 'packed', 'shipped'],
      default: 'draft',
    },
    carrier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    shippedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ShipmentSchema.index({ tenantId: 1, shipmentNumber: 1 }, { unique: true });

module.exports = mongoose.model('Shipment', ShipmentSchema);
