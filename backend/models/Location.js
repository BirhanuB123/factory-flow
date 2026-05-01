const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a location name'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['Warehouse', 'Zone', 'Bin', 'Production', 'Receiving'],
    default: 'Warehouse',
  },
  parentLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

LocationSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Location', LocationSchema);
