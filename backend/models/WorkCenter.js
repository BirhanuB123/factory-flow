const mongoose = require('mongoose');

const WorkCenterSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  /** Rough-cut capacity (hours per calendar day) */
  hoursPerDay: { type: Number, default: 8, min: 0.5, max: 24 },
  active: { type: Boolean, default: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

WorkCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('WorkCenter', WorkCenterSchema);
