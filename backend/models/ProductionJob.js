const mongoose = require('mongoose');

const ProductionJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: [true, 'Please add a Job ID'],
    unique: true
  },
  bom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM',
    required: [true, 'Please add a BOM']
  },
  quantity: {
    type: Number,
    required: [true, 'Please add a quantity'],
    min: [1, 'Quantity must be at least 1']
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add a due date']
  },
  assignedTo: String,
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

ProductionJobSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('ProductionJob', ProductionJobSchema);
