const mongoose = require('mongoose');

const NonConformanceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  ncNumber: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  source: {
    type: String,
    enum: ['incoming', 'in_process', 'final', 'customer', 'audit'],
    default: 'in_process',
  },
  inspection: { type: mongoose.Schema.Types.ObjectId, ref: 'QualityInspection', default: null },
  productionJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionJob', default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  lotNumber: String,
  disposition: {
    type: String,
    enum: ['open', 'scrap', 'rework', 'use_as_is', 'return'],
    default: 'open',
  },
  capaStatus: {
    type: String,
    enum: ['none', 'planned', 'in_progress', 'closed'],
    default: 'none',
  },
  capaNotes: String,
  createdAt: { type: Date, default: Date.now },
  closedAt: Date,
});

NonConformanceSchema.index({ tenantId: 1, ncNumber: 1 }, { unique: true });

module.exports = mongoose.model('NonConformance', NonConformanceSchema);
