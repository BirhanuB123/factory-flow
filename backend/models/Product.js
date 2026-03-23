const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'Please add an SKU'],
    trim: true,
  },
  description: String,
  category: String,
  price: {
    type: Number,
    required: [true, 'Please add a price']
  },
  unitCost: {
    type: Number,
    default: 0
  },
  costingMethod: {
    type: String,
    enum: ['average', 'standard'],
    default: 'average',
  },
  standardUnitCost: {
    type: Number,
    default: 0,
  },
  barcode: {
    type: String,
    default: '',
    trim: true,
  },
  stock: {
    type: Number,
    default: 0
  },
  reorderPoint: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'pcs'
  },
  supplier: String,
  location: String,
  lastReceived: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);
