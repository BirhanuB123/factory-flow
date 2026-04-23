const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const PosSession = require('../models/PosSession');
const { applyMovement } = require('../services/stockService');
const { verifyTimestampedHmac } = require('../utils/webhookSecurity');
const { consumeWebhookEvent } = require('../utils/webhookIdempotency');
const { markTenantPaidByTxRef } = require('./chapaBillingController');
const { verifyTransaction } = require('../services/paymentService');

const idempotencyTtlMs = () => Math.max(60_000, Number(process.env.BILLING_WEBHOOK_IDEMPOTENCY_TTL_MS) || 24 * 60 * 60 * 1000);

/**
 * Unified Chapa Webhook Handler
 */
exports.chapaWebhook = asyncHandler(async (req, res) => {
  // 1. Security Verification
  const hmacSecret = String(process.env.CHAPA_WEBHOOK_HMAC_SECRET || '').trim();
  if (hmacSecret) {
    const verify = verifyTimestampedHmac({
      req,
      secret: hmacSecret,
      signatureHeaders: ['x-chapa-webhook-signature', 'x-webhook-signature', 'chapa-signature'],
      timestampHeaders: ['x-chapa-webhook-timestamp', 'x-webhook-timestamp', 'chapa-timestamp'],
    });
    if (!verify.ok) {
      return res.status(401).json({ success: false, message: `Invalid signature (${verify.reason})` });
    }
  }

  const txRef = String(req.body?.tx_ref || req.body?.data?.tx_ref || '').trim();
  if (!txRef) {
    return res.status(400).json({ success: false, message: 'Missing tx_ref' });
  }

  // 2. Idempotency
  const eventId = String(req.body?.id || req.body?.event_id || txRef).trim();
  const idempotency = await consumeWebhookEvent('chapa', eventId, idempotencyTtlMs());
  if (!idempotency.accepted) {
    return res.json({ success: true, duplicate: true });
  }

  // 3. Routing
  if (txRef.startsWith('ff_')) {
    // It's a subscription payment
    const result = await markTenantPaidByTxRef(txRef);
    return res.json({ success: true, type: 'subscription', ok: result.ok });
  } else if (txRef.startsWith('SALE_')) {
    // It's a POS sale
    const result = await handlePosSalePayment(txRef);
    return res.json({ success: true, type: 'pos_sale', ok: result.ok });
  }

  res.json({ success: true, message: 'Unknown tx_ref prefix' });
});

/**
 * Handle POS sale payment confirmation
 */
async function handlePosSalePayment(txRef) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ 'paymentDetails.txRef': txRef }).session(session);
    if (!order) {
      throw new Error(`Order not found for txRef: ${txRef}`);
    }

    if (order.paymentDetails.paymentStatus === 'completed') {
      await session.commitTransaction();
      return { ok: true, already_processed: true };
    }

    // Verify with Chapa API to be sure (optional but safer)
    const chapaData = await verifyTransaction(txRef);
    if (chapaData.status !== 'success') {
      order.paymentDetails.paymentStatus = 'failed';
      await order.save({ session });
      await session.commitTransaction();
      return { ok: false, status: chapaData.status };
    }

    // Update Order
    order.paymentDetails.paymentStatus = 'completed';
    order.paymentDetails.chapaId = chapaData.id;
    order.status = 'delivered';
    await order.save({ session });

    // Update POS Session
    const posSession = await PosSession.findById(order.posSession).session(session);
    if (posSession) {
      posSession.summary.mobileSales += order.totalAmount; // Chapa is often mobile/digital
      posSession.summary.totalSales += order.totalAmount;
      await posSession.save({ session });
    }

    // Apply stock movements
    for (const item of order.items) {
      await applyMovement(session, {
        tenantId: order.tenantId,
        productId: item.product,
        delta: -item.quantity,
        movementType: 'issue',
        referenceType: 'Order',
        referenceId: order._id,
        note: `POS Sale (Chapa): ${order._id}`
      });
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error handling POS sale payment webhook:', error);
    return { ok: false, error: error.message };
  }
}
