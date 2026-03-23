const Client = require('../models/Client');
const asyncHandler = require('../middleware/asyncHandler');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Get all clients
// @route   GET /api/clients
exports.getClients = asyncHandler(async (req, res, next) => {
  const clients = await Client.find(byTenant(req));
  res.status(200).json({ success: true, count: clients.length, data: clients });
});

// @desc    Get single client
// @route   GET /api/clients/:id
exports.getClient = asyncHandler(async (req, res, next) => {
  const client = await Client.findOne(byTenant(req, { _id: req.params.id }));
  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  res.status(200).json({ success: true, data: client });
});

// @desc    Create new client
// @route   POST /api/clients
exports.createClient = asyncHandler(async (req, res, next) => {
  const body = { ...req.body, tenantId: req.tenantId };
  if (typeof body.name === 'string') body.name = body.name.trim();
  if (!body.name) {
    return res.status(400).json({ success: false, error: 'Name is required', message: 'Name is required' });
  }
  if (body.email === '') delete body.email;
  const client = await Client.create(body);
  res.status(201).json({ success: true, data: client });
});

// @desc    Update client
// @route   PUT /api/clients/:id
exports.updateClient = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body.tenantId;
  if (typeof body.name === 'string') {
    body.name = body.name.trim();
    if (!body.name) {
      return res.status(400).json({ success: false, error: 'Name is required', message: 'Name is required' });
    }
  }
  if (body.email === '') delete body.email;
  const client = await Client.findOneAndUpdate(byTenant(req, { _id: req.params.id }), body, {
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
  const client = await Client.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
