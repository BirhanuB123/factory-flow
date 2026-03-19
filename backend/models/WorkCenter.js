const mongoose = require('mongoose');

const WorkCenterSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  /** Rough-cut capacity (hours per calendar day) */
  hoursPerDay: { type: Number, default: 8, min: 0.5, max: 24 },
  active: { type: Boolean, default: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WorkCenter', WorkCenterSchema);
