const Lead = require('../models/Lead');
const Quote = require('../models/Quote');
const Client = require('../models/Client');
const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');
const { byTenant } = require('../utils/tenantQuery');

// --- Leads ---

// @desc    Get all leads
// @route   GET /api/crm/leads
exports.getLeads = asyncHandler(async (req, res, next) => {
  const leads = await Lead.find(byTenant(req));
  res.status(200).json({ success: true, count: leads.length, data: leads });
});

// @desc    Get single lead
// @route   GET /api/crm/leads/:id
exports.getLead = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findOne(byTenant(req, { _id: req.params.id }));
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }
  res.status(200).json({ success: true, data: lead });
});

// @desc    Create lead
// @route   POST /api/crm/leads
exports.createLead = asyncHandler(async (req, res, next) => {
  const body = { ...req.body, tenantId: req.tenantId };
  const lead = await Lead.create(body);
  res.status(201).json({ success: true, data: lead });
});

// @desc    Update lead
// @route   PUT /api/crm/leads/:id
exports.updateLead = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body.tenantId;
  const lead = await Lead.findOneAndUpdate(byTenant(req, { _id: req.params.id }), body, {
    new: true,
    runValidators: true
  });
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }
  res.status(200).json({ success: true, data: lead });
});

// @desc    Delete lead
// @route   DELETE /api/crm/leads/:id
exports.deleteLead = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }
  res.status(200).json({ success: true, data: {} });
});

// @desc    Convert lead to client
// @route   POST /api/crm/leads/:id/convert
exports.convertLeadToClient = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findOne(byTenant(req, { _id: req.params.id }));
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  const clientData = {
    tenantId: req.tenantId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address || '', // Might need to add address to Lead model if needed
    industry: lead.industry || '' // Might need to add industry to Lead model if needed
  };

  const client = await Client.create(clientData);

  lead.status = 'Won';
  lead.convertedToClientId = client._id;
  await lead.save();

  res.status(200).json({ success: true, data: { lead, client } });
});

// --- Quotes ---

// @desc    Get all quotes
// @route   GET /api/crm/quotes
exports.getQuotes = asyncHandler(async (req, res, next) => {
  const quotes = await Quote.find(byTenant(req)).populate('client').populate('lead').populate('items.product');
  res.status(200).json({ success: true, count: quotes.length, data: quotes });
});

// @desc    Get single quote
// @route   GET /api/crm/quotes/:id
exports.getQuote = asyncHandler(async (req, res, next) => {
  const quote = await Quote.findOne(byTenant(req, { _id: req.params.id })).populate('client').populate('lead').populate('items.product');
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  res.status(200).json({ success: true, data: quote });
});

// @desc    Create quote
// @route   POST /api/crm/quotes
exports.createQuote = asyncHandler(async (req, res, next) => {
  const body = { ...req.body, tenantId: req.tenantId };
  
  // Generate quote number if not provided
  if (!body.quoteNumber) {
    body.quoteNumber = `QT-${Date.now()}`;
  }

  const quote = await Quote.create(body);
  const populated = await Quote.findById(quote._id).populate('client').populate('lead').populate('items.product');
  res.status(201).json({ success: true, data: populated });
});

// @desc    Update quote
// @route   PUT /api/crm/quotes/:id
exports.updateQuote = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body.tenantId;
  const quote = await Quote.findOneAndUpdate(byTenant(req, { _id: req.params.id }), body, {
    new: true,
    runValidators: true
  }).populate('client').populate('lead').populate('items.product');
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  res.status(200).json({ success: true, data: quote });
});

// @desc    Delete quote
// @route   DELETE /api/crm/quotes/:id
exports.deleteQuote = asyncHandler(async (req, res, next) => {
  const quote = await Quote.findOneAndDelete(byTenant(req, { _id: req.params.id }));
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  res.status(200).json({ success: true, data: {} });
});

// @desc    Convert quote to order
// @route   POST /api/crm/quotes/:id/convert
exports.convertQuoteToOrder = asyncHandler(async (req, res, next) => {
  const quote = await Quote.findOne(byTenant(req, { _id: req.params.id }));
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }

  if (!quote.client && quote.lead) {
      // If quote is linked to a lead but no client, convert lead to client first or throw error
      // For now, let's assume conversion should have happened or we handle it here.
      // Let's call the lead conversion logic internally.
      const lead = await Lead.findOne(byTenant(req, { _id: quote.lead }));
      if (lead) {
          const clientData = {
              tenantId: req.tenantId,
              name: lead.name,
              email: lead.email,
              phone: lead.phone
          };
          const client = await Client.create(clientData);
          quote.client = client._id;
          lead.status = 'Won';
          lead.convertedToClientId = client._id;
          await lead.save();
      } else {
          return res.status(400).json({ success: false, message: 'Lead not found for conversion' });
      }
  }

  if (!quote.client) {
      return res.status(400).json({ success: false, message: 'Client is required to create an order' });
  }

  const orderData = {
    tenantId: req.tenantId,
    client: quote.client,
    items: quote.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      price: item.price
    })),
    totalAmount: quote.totalAmount,
    status: 'pending'
  };

  const order = await Order.create(orderData);

  quote.status = 'Accepted';
  quote.convertedToOrderId = order._id;
  await quote.save();

  res.status(200).json({ success: true, data: { quote, order } });
});
