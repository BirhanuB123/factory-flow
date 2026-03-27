const mongoose = require('mongoose');

const PositionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    reportsToPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

PositionSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Position', PositionSchema);
