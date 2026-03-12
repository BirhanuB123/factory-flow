const express = require('express');
const router = express.Router();
const {
  getOrders,
  createOrder
} = require('../controllers/orderController');

router.route('/')
  .get(getOrders)
  .post(createOrder);

module.exports = router;
