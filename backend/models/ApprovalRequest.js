const mongoose = require('mongoose');

const ApprovalRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['order_discount', 'order_large'],
      required: true,
    },
    entityType: { type: String, default: 'Order' },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'entityType' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    decidedAt: { type: Date, default: null },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApprovalRequest', ApprovalRequestSchema);
