const mongoose = require('mongoose');

const LineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantityOrdered: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0 },
  },
  { _id: true }
);

const PurchaseOrderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    poNumber: { type: String, required: true, trim: true },
    supplierName: { type: String, required: true, trim: true },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    /** import → vendor bills without local VAT on PO receipt billing */
    supplyType: {
      type: String,
      enum: ['local', 'import'],
      default: 'local',
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'partial_received', 'received', 'cancelled'],
      default: 'draft',
    },
    lines: [LineSchema],
    notes: { type: String, default: '' },
    /** Landed cost in functional currency (ETB) — allocated to lines on receive */
    importFreight: { type: Number, default: 0, min: 0 },
    importDuty: { type: Number, default: 0, min: 0 },
    importClearing: { type: Number, default: 0, min: 0 },
    landedCostAllocation: {
      type: String,
      enum: ['none', 'by_value', 'by_quantity'],
      default: 'none',
    },
    /** Invoice line currency; stock cost = unitCost × fxRateToFunctional + allocated landed */
    invoiceCurrency: { type: String, default: 'ETB', trim: true, uppercase: true },
    fxRateToFunctional: { type: Number, default: 1, min: 0 },
    lcReference: { type: String, default: '', trim: true },
    lcBank: { type: String, default: '', trim: true },
    lcAmount: { type: Number, default: null },
    lcCurrency: { type: String, default: '', trim: true, uppercase: true },
    lcExpiry: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PurchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
