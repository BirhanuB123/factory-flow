const mongoose = require('mongoose');

const DowntimeEventSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  startedAt: { type: Date, required: true },
  endedAt: Date,
  reasonCode: { type: String, default: 'other' },
  description: String,
  reportedBy: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DowntimeEvent', DowntimeEventSchema);
