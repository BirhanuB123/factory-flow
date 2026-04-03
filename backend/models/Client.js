const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    validate: {
      validator(v) {
        if (v == null || v === '') return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
      },
      message: 'Please add a valid email',
    },
  },
  phone: String,
  address: String,
  /** Tax Identification Number (TIN) — Ethiopia / compliance */
  tin: { type: String, default: '', trim: true },
  vatRegistered: { type: Boolean, default: true },
  industry: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ClientSchema.pre('validate', function normalizeClientKeys(next) {
  if (typeof this.email === 'string') this.email = this.email.trim().toLowerCase();
  if (typeof this.tin === 'string') this.tin = this.tin.trim().toUpperCase();
  next();
});

ClientSchema.index(
  { tenantId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $ne: '' } } }
);
ClientSchema.index(
  { tenantId: 1, tin: 1 },
  { unique: true, partialFilterExpression: { tin: { $type: 'string', $ne: '' } } }
);

module.exports = mongoose.model('Client', ClientSchema);
