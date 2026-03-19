const mongoose = require('mongoose');

const TimeLogSchema = new mongoose.Schema(
  {
    minutes: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobOperationSchema = new mongoose.Schema(
  {
    sequence: { type: Number, default: 10 },
    code: { type: String, default: 'OP' },
    name: { type: String, required: true },
    workCenterCode: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'active', 'done', 'skipped'],
      default: 'pending',
    },
    plannedSetupMin: { type: Number, default: 0 },
    plannedRunMin: { type: Number, default: 0 },
    actualLaborMin: { type: Number, default: 0 },
    scrapQty: { type: Number, default: 0 },
    reworkQty: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
    timeLogs: [TimeLogSchema],
  },
  { _id: false }
);

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
  /** Set when status Completed and inventory (consume/output) has been posted */
  inventoryPosted: {
    type: Boolean,
    default: false,
  },
  sourceOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  sourceLineIndex: {
    type: Number,
    default: null,
  },
  materialsReserved: {
    type: Boolean,
    default: false,
  },
  operations: [JobOperationSchema],
  /** Public token for barcode / traveler URL (no auth on traveler print) — optional protect in prod */
  travelerToken: { type: String, unique: true, sparse: true, index: true },
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
