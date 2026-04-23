const mongoose = require('mongoose');

const PosSessionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: Date,
  openingBalance: {
    type: Number,
    required: true,
  },
  closingBalance: Number, // Calculated based on transactions
  actualClosingBalance: Number, // Entered by user
  difference: Number,
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
  note: String,
  summary: {
    totalSales: { type: Number, default: 0 },
    cashSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    mobileSales: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
  }
}, { timestamps: true });

module.exports = mongoose.model('PosSession', PosSessionSchema);
