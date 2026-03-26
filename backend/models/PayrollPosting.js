const mongoose = require('mongoose');

const payrollPostingSchema = new mongoose.Schema(
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
    totals: { type: mongoose.Schema.Types.Mixed, default: {} },
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
    },
    postedAt: { type: Date, required: true },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
  },
  { timestamps: true }
);

payrollPostingSchema.index({ tenantId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollPosting', payrollPostingSchema);
