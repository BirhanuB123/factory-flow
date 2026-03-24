const express = require('express');
const { billingWebhookSync, stripeWebhook } = require('../controllers/billingWebhookController');
const { chapaWebhook } = require('../controllers/chapaBillingController');

const router = express.Router();

router.post('/stripe', stripeWebhook);
router.post('/chapa', chapaWebhook);
router.post('/sync', billingWebhookSync);

module.exports = router;
