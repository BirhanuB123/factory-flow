const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'Please add an SKU'],
    unique: true
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

module.exports = mongoose.model('Product', ProductSchema);
