const mongoose = require('mongoose');

const payrollMonthCloseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    closedAt: { type: Date, required: true },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
  },
  { timestamps: true }
);

payrollMonthCloseSchema.index({ tenantId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollMonthClose', payrollMonthCloseSchema);
