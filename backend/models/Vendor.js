const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    paymentTermsDays: { type: Number, default: 30 },
    taxId: { type: String, default: '' },
    tin: { type: String, default: '', trim: true },
    vatRegistered: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', VendorSchema);
