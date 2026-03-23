const mongoose = require('mongoose');

const QualityInspectionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  inspectionType: {
    type: String,
    enum: ['incoming', 'in_process', 'final'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'pass', 'fail', 'waived'],
    default: 'pending',
  },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  poLineIndex: Number,
  productionJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionJob', default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  lotNumber: String,
  quantityInspected: Number,
  notes: String,
  inspectedAt: Date,
  inspector: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QualityInspection', QualityInspectionSchema);
