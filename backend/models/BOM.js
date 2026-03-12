const mongoose = require('mongoose');

const BOMSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a BOM name'],
    trim: true
  },
  partNumber: {
    type: String,
    required: [true, 'Please add a part number'],
    unique: true
  },
  revision: {
    type: String,
    default: 'Rev A'
  },
  status: {
    type: String,
    enum: ['Active', 'Draft', 'Archived'],
    default: 'Draft'
  },
  components: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [0, 'Quantity cannot be negative']
      }
    }
  ],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
BOMSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BOM', BOMSchema);
