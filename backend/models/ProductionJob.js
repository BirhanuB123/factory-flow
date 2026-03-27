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
    actualMachineMin: { type: Number, default: 0 },
    actualOverheadCost: { type: Number, default: 0 },
    wipInQty: { type: Number, default: 0, min: 0 },
    wipOutQty: { type: Number, default: 0, min: 0 },
    qualityRequired: { type: Boolean, default: false },
    qualityStatus: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'waived'],
      default: 'pending',
    },
    scrapQty: { type: Number, default: 0 },
    reworkQty: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
    timeLogs: [TimeLogSchema],
  },
  { _id: false }
);

const MaterialTxnSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    txnType: { type: String, enum: ['issue', 'return'], required: true },
    operationIndex: { type: Number, default: null },
    note: { type: String, default: '' },
    movementId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProductionJobSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  jobId: {
    type: String,
    required: [true, 'Please add a Job ID'],
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
  workCenterCode: { type: String, default: '' },
  plannedStartDate: { type: Date, default: null },
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
  materialTransactions: [MaterialTxnSchema],
  costing: {
    plannedLaborCost: { type: Number, default: 0 },
    plannedMachineCost: { type: Number, default: 0 },
    plannedOverheadCost: { type: Number, default: 0 },
    actualLaborCost: { type: Number, default: 0 },
    actualMachineCost: { type: Number, default: 0 },
    actualOverheadCost: { type: Number, default: 0 },
  },
  operations: [JobOperationSchema],
  /** Public token for barcode / traveler URL (no auth on traveler print) — optional protect in prod */
  /** Globally unique; sparse unique index on `travelerToken` is defined below (do not set path-level index/sparse). */
  travelerToken: { type: String, default: null },
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

ProductionJobSchema.index({ tenantId: 1, jobId: 1 }, { unique: true });
ProductionJobSchema.index({ travelerToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ProductionJob', ProductionJobSchema);
