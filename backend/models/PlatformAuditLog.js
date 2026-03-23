const mongoose = require('mongoose');

const PlatformAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    actorEmployeeId: { type: String, default: '' },
    actorName: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, default: '', index: true },
    resourceId: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

PlatformAuditLogSchema.index({ createdAt: -1 });
PlatformAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformAuditLog', PlatformAuditLogSchema);
