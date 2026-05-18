const TradeShipment = require('../models/TradeShipment');

exports.createTradeShipment = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.purchaseOrder && typeof payload.purchaseOrder === 'object') {
      payload.purchaseOrder = payload.purchaseOrder._id;
    }
    if (payload.salesOrder && typeof payload.salesOrder === 'object') {
      payload.salesOrder = payload.salesOrder._id;
    }
    if (payload.clearingAgent && typeof payload.clearingAgent === 'object') {
      payload.clearingAgent = payload.clearingAgent._id;
    }

    if (!payload.purchaseOrder || payload.purchaseOrder === 'none') payload.purchaseOrder = null;
    if (!payload.salesOrder || payload.salesOrder === 'none') payload.salesOrder = null;
    if (!payload.clearingAgent || payload.clearingAgent === 'none') payload.clearingAgent = null;

    const shipment = new TradeShipment({ ...payload, tenantId: req.user.tenantId });
    await shipment.save();
    res.status(201).json(shipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getTradeShipments = async (req, res) => {
  try {
    const shipments = await TradeShipment.find({ tenantId: req.user.tenantId })
      .populate('purchaseOrder', 'poNumber supplierName')
      .populate('salesOrder', 'orderNumber client')
      .populate('clearingAgent', 'name employeeId email')
      .sort('-createdAt');
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTradeShipmentById = async (req, res) => {
  try {
    const shipment = await TradeShipment.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('purchaseOrder')
      .populate('salesOrder')
      .populate('clearingAgent')
      .populate({
        path: 'expenses',
        populate: { path: 'vendor', select: 'code name' }
      });
      
    if (!shipment) return res.status(404).json({ message: 'Not found' });

    // Dynamically query stock movements for the linked PO or Sales Order
    const StockMovement = require('../models/StockMovement');
    let dynamicReceipts = [];
    if (shipment.purchaseOrder) {
      dynamicReceipts = await StockMovement.find({
        tenantId: req.user.tenantId,
        referenceType: 'PurchaseOrder',
        referenceId: shipment.purchaseOrder
      }).populate('product', 'sku name');
    } else if (shipment.salesOrder) {
      dynamicReceipts = await StockMovement.find({
        tenantId: req.user.tenantId,
        referenceType: 'Order',
        referenceId: shipment.salesOrder
      }).populate('product', 'sku name');
    }

    const shipmentObj = shipment.toObject();
    shipmentObj.dynamicReceipts = dynamicReceipts;

    res.json(shipmentObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTradeShipment = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.purchaseOrder && typeof payload.purchaseOrder === 'object') {
      payload.purchaseOrder = payload.purchaseOrder._id;
    }
    if (payload.salesOrder && typeof payload.salesOrder === 'object') {
      payload.salesOrder = payload.salesOrder._id;
    }
    if (payload.clearingAgent && typeof payload.clearingAgent === 'object') {
      payload.clearingAgent = payload.clearingAgent._id;
    }

    if (!payload.purchaseOrder || payload.purchaseOrder === 'none') payload.purchaseOrder = null;
    if (!payload.salesOrder || payload.salesOrder === 'none') payload.salesOrder = null;
    if (!payload.clearingAgent || payload.clearingAgent === 'none') payload.clearingAgent = null;

    const shipment = await TradeShipment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      payload,
      { new: true, runValidators: true }
    );
    if (!shipment) return res.status(404).json({ message: 'Not found' });
    res.json(shipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteTradeShipment = async (req, res) => {
  try {
    const shipment = await TradeShipment.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!shipment) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logExpense = async (req, res) => {
  try {
    const { expenseType, amount, vendorId, billNumber, billDate, dueDate, notes } = req.body;
    if (!expenseType || !amount || !vendorId) {
      return res.status(400).json({ message: 'expenseType, amount, and vendorId are required' });
    }

    const shipment = await TradeShipment.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

    const Vendor = require('../models/Vendor');
    const VendorBill = require('../models/VendorBill');
    
    const terms = (await Vendor.findOne({ _id: vendorId, tenantId: req.user.tenantId }))?.paymentTermsDays || 30;
    const due = dueDate ? new Date(dueDate) : new Date(Date.now() + terms * 86400000);
    const bn = billNumber || `VB-TRADE-${Date.now()}`;

    // Create a VendorBill for this expense
    const vendorBill = await VendorBill.create({
      tenantId: req.user.tenantId,
      billNumber: bn,
      vendor: vendorId,
      purchaseOrder: shipment.purchaseOrder || null,
      lines: [{
        description: `${expenseType.toUpperCase()} expense for shipment ${shipment.referenceNumber}`,
        quantity: 1,
        unitCost: Number(amount),
        amount: Number(amount)
      }],
      amount: Number(amount),
      taxableAmount: Number(amount),
      vatRate: 0,
      vatAmount: 0,
      purchaseWhtRate: 0,
      purchaseWhtAmount: 0,
      supplyType: 'import',
      vatRecoverable: false,
      dueDate: due,
      billDate: billDate ? new Date(billDate) : new Date(),
      notes: notes || `Logged via Global Trade Shipment: ${shipment.referenceNumber}`,
      status: 'Open'
    });

    // Link this expense to the shipment
    shipment.expenses.push(vendorBill._id);
    await shipment.save();

    // Real-time update of landed costs on PurchaseOrder
    if (shipment.purchaseOrder) {
      const PurchaseOrder = require('../models/PurchaseOrder');
      const po = await PurchaseOrder.findOne({ _id: shipment.purchaseOrder, tenantId: req.user.tenantId });
      if (po) {
        if (expenseType === 'freight') {
          po.importFreight = (po.importFreight || 0) + Number(amount);
        } else if (expenseType === 'duty') {
          po.importDuty = (po.importDuty || 0) + Number(amount);
        } else if (expenseType === 'clearing') {
          po.importClearing = (po.importClearing || 0) + Number(amount);
        }
        await po.save();
      }
    }

    const populatedShipment = await TradeShipment.findOne({ _id: shipment._id, tenantId: req.user.tenantId })
      .populate('purchaseOrder')
      .populate('salesOrder')
      .populate('clearingAgent')
      .populate({
        path: 'expenses',
        populate: { path: 'vendor', select: 'code name' }
      });

    res.status(201).json({
      message: 'Expense logged successfully and Vendor Bill created.',
      vendorBill,
      shipment: populatedShipment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
