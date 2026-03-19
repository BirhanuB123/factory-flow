const mongoose = require('mongoose');

const PmScheduleSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  title: { type: String, required: true },
  frequencyDays: { type: Number, required: true, min: 1 },
  nextDueDate: { type: Date, required: true },
  lastCompletedAt: Date,
  active: { type: Boolean, default: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PmSchedule', PmScheduleSchema);
