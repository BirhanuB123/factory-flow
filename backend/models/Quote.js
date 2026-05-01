const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  quoteNumber: {
    type: String,
    required: true
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
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected'],
    default: 'Draft'
  },
  validUntil: {
    type: Date
  },
  convertedToOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

QuoteSchema.index({ tenantId: 1, quoteNumber: 1 }, { unique: true });

module.exports = mongoose.model('Quote', QuoteSchema);
