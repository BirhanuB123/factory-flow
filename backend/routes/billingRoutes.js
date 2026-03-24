const express = require('express');
const { initializeChapaCheckout, verifyChapaPayment } = require('../controllers/chapaBillingController');

const router = express.Router();

router.post('/chapa/checkout', initializeChapaCheckout);
router.get('/chapa/verify/:txRef', verifyChapaPayment);

module.exports = router;
