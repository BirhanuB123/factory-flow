const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkCenter', default: null },
  manufacturer: String,
  serialNumber: String,
  installedAt: Date,
  active: { type: Boolean, default: true },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Asset', AssetSchema);
