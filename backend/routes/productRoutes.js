const express = require('express');
const router = express.Router();
console.log('Loading productRoutes.js...');
router.get('/test-internal', (req, res) => res.json({ internal: true }));
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductLots,
} = require('../controllers/productController');

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.get('/:id/lots', getProductLots);

router.route('/:id')
  .get(getProduct)
  .put(updateProduct);

module.exports = router;
