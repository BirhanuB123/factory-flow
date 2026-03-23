const mongoose = require('mongoose');

const PlatformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
      trim: true,
      lowercase: true,
    },
    globalAnnouncement: {
      enabled: { type: Boolean, default: false },
      level: { type: String, enum: ['info', 'warning', 'maintenance'], default: 'info' },
      message: { type: String, default: '', trim: true, maxlength: 5000 },
      updatedAt: { type: Date, default: null },
      updatedByEmployeeId: { type: String, default: '', trim: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
