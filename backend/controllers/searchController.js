const Product = require('../models/Product');
const ProductionJob = require('../models/ProductionJob');
const Client = require('../models/Client');
const asyncHandler = require('../middleware/asyncHandler');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Global search across products, jobs, and clients
// @route   GET /api/search
// @access  Public
exports.globalSearch = asyncHandler(async (req, res, next) => {
  const { q } = req.query;

  if (!q) {
    return res.status(200).json({ success: true, data: [] });
  }

  const regex = new RegExp(q, 'i');

  const [products, jobs, clients] = await Promise.all([
    Product.find(
      byTenant(req, {
        $or: [{ name: regex }, { sku: regex }, { category: regex }],
      })
    ).limit(5),
    ProductionJob.find(
      byTenant(req, {
        $or: [{ jobId: regex }, { status: regex }],
      })
    )
      .limit(5)
      .populate('bom'),
    Client.find(
      byTenant(req, {
        $or: [{ name: regex }, { contactPerson: regex }, { email: regex }],
      })
    ).limit(5),
  ]);

  const results = [
    ...products.map(p => ({ id: p._id, type: 'Product', title: p.name, subtitle: `${p.sku} | ${p.category}`, link: `/inventory?sku=${p.sku}` })),
    ...jobs.map(j => ({ id: j._id, type: 'Job', title: j.jobId, subtitle: `${j.status} | ${j.bom?.name || 'No BOM'}`, link: `/production?job=${j.jobId}` })),
    ...clients.map(c => ({ id: c._id, type: 'Client', title: c.name, subtitle: `${c.contactPerson} | ${c.email}`, link: `/production?client=${c._id}` }))
  ];

  res.status(200).json({ success: true, data: results });
});
