const mongoose = require('mongoose');

const ContainerSchema = new mongoose.Schema({
  containerNumber: { type: String, required: true, trim: true },
  sealNumber: { type: String, default: '', trim: true },
  type: { type: String, default: '20ft', trim: true }, // e.g. 20ft, 40ft, LCL
}, { _id: true });

const TradeShipmentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  tradeType: {
    type: String,
    enum: ['import', 'export'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pre_shipment', 'in_transit', 'customs_clearance', 'arrived', 'completed'],
    default: 'pre_shipment',
  },
  referenceNumber: {
    type: String,
    required: true,
    trim: true,
    description: 'Bill of Lading or Air Waybill number',
  },
  vesselOrFlight: {
    type: String,
    default: '',
    trim: true,
  },
  portOfLoading: {
    type: String,
    default: '',
    trim: true,
  },
  portOfDischarge: {
    type: String,
    default: '',
    trim: true,
  },
  etd: {
    type: Date,
    default: null,
  },
  eta: {
    type: Date,
    default: null,
  },
  customsStatus: {
    type: String,
    enum: ['pending', 'submitted', 'cleared', 'held'],
    default: 'pending',
  },
  incoterm: {
    type: String,
    enum: ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'other'],
    default: 'other',
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null,
  },
  salesOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  containerDetails: [ContainerSchema],
  documents: {
    commercialInvoice: { type: Boolean, default: false },
    packingList: { type: Boolean, default: false },
    certificateOfOrigin: { type: Boolean, default: false },
    billOfLading: { type: Boolean, default: false },
    exportPermit: { type: Boolean, default: false }, // for exports
  },
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

TradeShipmentSchema.index({ tenantId: 1, referenceNumber: 1 });
TradeShipmentSchema.index({ tenantId: 1, tradeType: 1 });

module.exports = mongoose.model('TradeShipment', TradeShipmentSchema);
