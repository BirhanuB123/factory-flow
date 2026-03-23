const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkCenter', default: null },
  manufacturer: String,
  serialNumber: String,
  installedAt: Date,
  active: { type: Boolean, default: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

AssetSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Asset', AssetSchema);
