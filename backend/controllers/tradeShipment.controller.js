const TradeShipment = require('../models/TradeShipment');

exports.createTradeShipment = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.purchaseOrder || payload.purchaseOrder === 'none') payload.purchaseOrder = null;
    if (!payload.salesOrder || payload.salesOrder === 'none') payload.salesOrder = null;

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
      .populate('salesOrder', 'orderNumber client') // We may need to populate client inside salesOrder if it's referenced
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
      .populate('salesOrder');
    if (!shipment) return res.status(404).json({ message: 'Not found' });
    res.json(shipment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTradeShipment = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.purchaseOrder || payload.purchaseOrder === 'none') payload.purchaseOrder = null;
    if (!payload.salesOrder || payload.salesOrder === 'none') payload.salesOrder = null;

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
