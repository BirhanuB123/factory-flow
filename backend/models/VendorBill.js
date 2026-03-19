const mongoose = require('mongoose');

const LineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitCost: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { _id: true }
);

const VendorBillSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true, trim: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    lines: [LineSchema],
    amount: { type: Number, required: true },
    taxableAmount: { type: Number, default: null },
    vatRate: { type: Number, default: null },
    vatAmount: { type: Number, default: null },
    purchaseWhtRate: { type: Number, default: null },
    purchaseWhtAmount: { type: Number, default: null },
    supplyType: {
      type: String,
      enum: ['local_vat_registered', 'local_unregistered', 'import'],
      default: 'local_vat_registered',
    },
    vatRecoverable: { type: Boolean, default: true },
    amountPaid: { type: Number, default: 0 },
    billDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Open', 'Partial', 'Paid', 'Overdue'],
      default: 'Open',
    },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VendorBill', VendorBillSchema);
