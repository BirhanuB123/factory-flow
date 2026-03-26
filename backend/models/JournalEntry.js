const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    memo: { type: String, default: '' },
  },
  { _id: false }
);

const journalEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    entryDate: { type: Date, required: true },
    memo: { type: String, default: '' },
    source: {
      type: String,
      enum: ['payroll', 'manual'],
      default: 'manual',
      index: true,
    },
    /** e.g. payroll month YYYY-MM */
    sourceRef: { type: String, default: '', trim: true },
    lines: { type: [journalLineSchema], default: [] },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
  },
  { timestamps: true }
);

journalEntrySchema.index({ tenantId: 1, source: 1, sourceRef: 1 });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
