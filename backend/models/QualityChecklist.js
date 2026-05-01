const mongoose = require('mongoose');

const QualityChecklistItemSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  responseType: {
    type: String,
    enum: ['boolean', 'numeric', 'text'],
    default: 'boolean',
  },
  required: { type: Boolean, default: true },
  minValue: Number,
  maxValue: Number,
}, { _id: false });

const QualityChecklistSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  description: String,
  inspectionType: {
    type: String,
    enum: ['incoming', 'in_process', 'final'],
    default: 'final',
  },
  items: [QualityChecklistItemSchema],
  active: { type: Boolean, default: true },
}, { timestamps: true });

QualityChecklistSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('QualityChecklist', QualityChecklistSchema);
