const mongoose = require('mongoose');

const WithholdingCertificateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    certificateNumber: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['on_sales', 'on_purchase'],
      required: true,
    },
    issueDate: { type: Date, default: Date.now },
    taxPeriod: { type: String, default: '' },
    payerTIN: { type: String, default: '' },
    payerName: { type: String, default: '' },
    payeeTIN: { type: String, default: '' },
    payeeName: { type: String, default: '' },
    baseAmount: { type: Number, required: true },
    ratePercent: { type: Number, required: true },
    withheldAmount: { type: Number, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    vendorBill: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorBill', default: null },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true }
);

WithholdingCertificateSchema.index({ tenantId: 1, certificateNumber: 1 }, { unique: true });

module.exports = mongoose.model('WithholdingCertificate', WithholdingCertificateSchema);
