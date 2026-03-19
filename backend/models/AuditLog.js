const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.Mixed },
    summary: { type: String, default: '' },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
