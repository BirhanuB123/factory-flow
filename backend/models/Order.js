const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
      },
      price: {
        type: Number,
        required: true
      },
      shippedQty: {
        type: Number,
        default: 0,
        min: 0,
      },
      productionJob: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductionJob',
        default: null
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  approvalStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  pendingApprovalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalRequest',
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  source: {
    type: String,
    enum: ['erp', 'pos'],
    default: 'erp'
  },
  posSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PosSession',
    default: null
  },
  tradeType: {
    type: String,
    enum: ['local', 'export'],
    default: 'local'
  },
  invoiceCurrency: {
    type: String,
    default: 'ETB',
    trim: true,
    uppercase: true
  },
  fxRateToFunctional: {
    type: Number,
    default: 1,
    min: 0
  },
  incoterm: {
    type: String,
    enum: ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'none'],
    default: 'none'
  },
  paymentDetails: {
    method: { type: String, enum: ['cash', 'card', 'mobile', 'chapa', 'other'], default: 'cash' },
    amountTendered: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    txRef: { type: String, default: null },
    chapaId: { type: String, default: null },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
  },
  orderDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
