const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Please add a client']
  },
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    /** Net amount receivable after VAT and sales WHT (Ethiopia-style). */
  },
  amountTaxable: { type: Number, default: null },
  vatRate: { type: Number, default: null },
  vatAmount: { type: Number, default: null },
  salesWhtRate: { type: Number, default: null },
  salesWhtAmount: { type: Number, default: null },
  grossBeforeWht: { type: Number, default: null },
  sellerTinSnapshot: { type: String, default: '' },
  buyerTinSnapshot: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Overdue'],
    default: 'Pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  description: {
    type: String
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  shippedAt: {
    type: Date,
    default: null,
  },
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
