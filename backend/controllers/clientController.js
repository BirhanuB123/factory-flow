const Client = require('../models/Client');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all clients
// @route   GET /api/clients
exports.getClients = asyncHandler(async (req, res, next) => {
  const clients = await Client.find();
  res.status(200).json({ success: true, count: clients.length, data: clients });
});

// @desc    Get single client
// @route   GET /api/clients/:id
exports.getClient = asyncHandler(async (req, res, next) => {
  const client = await Client.findById(req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  res.status(200).json({ success: true, data: client });
});

// @desc    Create new client
// @route   POST /api/clients
exports.createClient = asyncHandler(async (req, res, next) => {
  const client = await Client.create(req.body);
  res.status(201).json({ success: true, data: client });
});

// @desc    Update client
// @route   PUT /api/clients/:id
exports.updateClient = asyncHandler(async (req, res, next) => {
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  res.status(200).json({ success: true, data: client });
});

// @desc    Delete client
// @route   DELETE /api/clients/:id
exports.deleteClient = asyncHandler(async (req, res, next) => {
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
