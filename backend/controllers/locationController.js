const asyncHandler = require('../middleware/asyncHandler');
const Location = require('../models/Location');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Get all locations
// @route   GET /api/inventory/locations
// @access  Private (Tenant)
exports.getLocations = asyncHandler(async (req, res) => {
  const locations = await Location.find(byTenant(req)).populate('parentLocation', 'name');
  res.status(200).json({ success: true, count: locations.length, data: locations });
});

// @desc    Create a location
// @route   POST /api/inventory/locations
// @access  Private (Tenant)
exports.createLocation = asyncHandler(async (req, res) => {
  const { name, type, parentLocation } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Location name is required' });
  }

  const existing = await Location.findOne(byTenant(req, { name: name.trim() }));
  if (existing) {
    return res.status(400).json({ success: false, message: 'Location with this name already exists' });
  }

  const location = await Location.create({
    tenantId: req.tenantId,
    name: name.trim(),
    type: type || 'Warehouse',
    parentLocation: parentLocation || null,
  });

  const populated = await Location.findById(location._id).populate('parentLocation', 'name');
  res.status(201).json({ success: true, data: populated });
});

// @desc    Update a location
// @route   PUT /api/inventory/locations/:id
// @access  Private (Tenant)
exports.updateLocation = asyncHandler(async (req, res) => {
  let location = await Location.findOne(byTenant(req, { _id: req.params.id }));

  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  const { name, type, parentLocation } = req.body;

  if (name && name.trim() !== location.name) {
    const existing = await Location.findOne(byTenant(req, { name: name.trim(), _id: { $ne: location._id } }));
    if (existing) {
      return res.status(400).json({ success: false, message: 'Location with this name already exists' });
    }
    location.name = name.trim();
  }

  if (type) location.type = type;
  if (parentLocation !== undefined) location.parentLocation = parentLocation || null;

  await location.save();
  location = await Location.findById(location._id).populate('parentLocation', 'name');

  res.status(200).json({ success: true, data: location });
});

// @desc    Delete a location
// @route   DELETE /api/inventory/locations/:id
// @access  Private (Tenant)
exports.deleteLocation = asyncHandler(async (req, res) => {
  const location = await Location.findOne(byTenant(req, { _id: req.params.id }));

  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  // Optional: Check if there's stock in this location before deleting
  const LotBalance = require('../models/LotBalance');
  const hasStock = await LotBalance.findOne({ locationId: location._id, quantity: { $gt: 0 } });
  if (hasStock) {
    return res.status(400).json({ success: false, message: 'Cannot delete location that contains stock.' });
  }

  await location.deleteOne();
  res.status(200).json({ success: true, data: {} });
});
