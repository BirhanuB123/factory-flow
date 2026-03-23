const express = require('express');
const { billingWebhookSync, stripeWebhook } = require('../controllers/billingWebhookController');

const router = express.Router();

router.post('/stripe', stripeWebhook);
router.post('/sync', billingWebhookSync);

module.exports = router;
