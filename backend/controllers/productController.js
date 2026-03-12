const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all products
// @route   GET /api/products
exports.getProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find();
  res.status(200).json({ success: true, count: products.length, data: products });
});

// @desc    Get single product
// @route   GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.status(200).json({ success: true, data: product });
});

// @desc    Create new product
// @route   POST /api/products
exports.createProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

// @desc    Update product
// @route   PUT /api/products/:id
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.status(200).json({ success: true, data: product });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.status(200).json({ success: true, data: {} });
});
