const mongoose = require('mongoose');

const LotBalanceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  lotNumber: {
    type: String,
    default: '',
    trim: true,
  },
  serialNumber: {
    type: String,
    default: '',
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  expirationDate: {
    type: Date,
    default: null,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Primary index for lot/location-level lookup
LotBalanceSchema.index({ tenantId: 1, product: 1, lotNumber: 1, serialNumber: 1, locationId: 1 }, { unique: true });

module.exports = mongoose.model('LotBalance', LotBalanceSchema);
