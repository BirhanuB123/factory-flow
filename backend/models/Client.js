const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Client', ClientSchema);
