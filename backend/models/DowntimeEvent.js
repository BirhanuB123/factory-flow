const mongoose = require('mongoose');

const DowntimeEventSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  startedAt: { type: Date, required: true },
  endedAt: Date,
  reasonCode: { type: String, default: 'other' },
  description: String,
  reportedBy: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DowntimeEvent', DowntimeEventSchema);
