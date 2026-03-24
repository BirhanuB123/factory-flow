const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      index: true,
    },
    eventKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    createdAt: { type: Date, default: Date.now },
    expireAt: { type: Date, required: true },
  },
  { timestamps: false }
);

WebhookEventSchema.index({ provider: 1, eventKey: 1 }, { unique: true });
WebhookEventSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);
