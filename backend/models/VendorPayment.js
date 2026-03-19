const mongoose = require('mongoose');

const VendorPaymentSchema = new mongoose.Schema(
  {
    vendorBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorBill',
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paidAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ['check', 'ach', 'wire', 'card', 'other'],
      default: 'ach',
    },
    reference: { type: String, default: '' },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VendorPayment', VendorPaymentSchema);
