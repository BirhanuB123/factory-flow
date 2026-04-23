const asyncHandler = require('../middleware/asyncHandler');
const PosSession = require('../models/PosSession');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { applyMovement } = require('../services/stockService');
const mongoose = require('mongoose');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Open a POS session
// @route   POST /api/pos/session/open
// @access  Private
exports.openSession = asyncHandler(async (req, res) => {
  const { openingBalance, note } = req.body;

  // Check if there is already an open session for this user
  const activeSession = await PosSession.findOne(byTenant(req, { 
    user: req.user.id, 
    status: 'open' 
  }));

  if (activeSession) {
    return res.status(400).json({
      success: false,
      message: 'You already have an open POS session'
    });
  }

  const session = await PosSession.create({
    tenantId: req.tenantId,
    user: req.user.id,
    openingBalance,
    note
  });

  res.status(201).json({
    success: true,
    data: session
  });
});

// @desc    Get current active POS session
// @route   GET /api/pos/session/active
// @access  Private
exports.getActiveSession = asyncHandler(async (req, res) => {
  const session = await PosSession.findOne(byTenant(req, { 
    user: req.user.id, 
    status: 'open' 
  }));

  if (!session) {
    return res.status(200).json({
      success: true,
      data: null
    });
  }

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    Close a POS session
// @route   POST /api/pos/session/close
// @access  Private
exports.closeSession = asyncHandler(async (req, res) => {
  const { actualClosingBalance, note } = req.body;

  const session = await PosSession.findOne(byTenant(req, { 
    user: req.user.id, 
    status: 'open' 
  }));

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'No open POS session found'
    });
  }

  session.status = 'closed';
  session.endTime = Date.now();
  session.actualClosingBalance = actualClosingBalance;
  session.difference = actualClosingBalance - (session.openingBalance + session.summary.totalSales);
  session.note = note || session.note;

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

const { initializeTransaction } = require('../services/paymentService');

// @desc    Process a POS sale
// @route   POST /api/pos/sale
// @access  Private
exports.processSale = asyncHandler(async (req, res) => {
  const { items, totalAmount, paymentDetails, clientId, discountPercent } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const posSession = await PosSession.findOne(byTenant(req, { 
      user: req.user.id, 
      status: 'open' 
    })).session(session);

    if (!posSession) {
      throw new Error('No open POS session found. Please open a session first.');
    }

    const isChapa = paymentDetails.method === 'chapa';
    const txRef = isChapa ? `SALE_${req.tenantId}_${Date.now()}` : null;
    let checkoutUrl = null;

    if (isChapa) {
      // Initialize Chapa transaction
      const name = String(req.user?.name || '').trim();
      const [firstName = 'Customer', ...rest] = name.split(/\s+/).filter(Boolean);
      const lastName = rest.join(' ') || 'ERP';
      
      const payload = {
        amount: totalAmount.toFixed(2),
        currency: 'ETB', // Default to ETB for now, can be made dynamic
        email: req.user.email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        callback_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/webhook`,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pos?status=success&tx_ref=${txRef}`,
        customization: {
          title: "POS Sale",
          description: `Payment for Order at ${new Date().toLocaleString()}`,
        },
        meta: {
          tenantId: req.tenantId,
          orderSource: 'pos',
          posSessionId: posSession._id
        }
      };

      const chapaData = await initializeTransaction(payload);
      checkoutUrl = chapaData.checkout_url;
    }

    // 1. Create the Order
    // If Chapa, status is pending, otherwise delivered
    const orderStatus = isChapa ? 'pending' : 'delivered';
    const paymentStatus = isChapa ? 'pending' : 'completed';

    const order = await Order.create([{
      tenantId: req.tenantId,
      client: clientId || null, 
      items,
      totalAmount,
      discountPercent: discountPercent || 0,
      status: orderStatus,
      source: 'pos',
      posSession: posSession._id,
      paymentDetails: {
        ...paymentDetails,
        txRef,
        paymentStatus
      }
    }], { session });

    // 2. Apply stock movements (ONLY for non-Chapa/immediate payments)
    // For Chapa, we do this in the webhook after confirmation
    if (!isChapa) {
      for (const item of items) {
        await applyMovement(session, {
          tenantId: req.tenantId,
          productId: item.product,
          delta: -item.quantity,
          movementType: 'issue',
          referenceType: 'Order',
          referenceId: order[0]._id,
          note: `POS Sale: ${order[0]._id}`
        });
      }

      // 3. Update POS session summary (Immediate)
      const method = paymentDetails.method;
      const saleAmount = totalAmount;

      if (method === 'cash') posSession.summary.cashSales += saleAmount;
      else if (method === 'card') posSession.summary.cardSales += saleAmount;
      else if (method === 'mobile') posSession.summary.mobileSales += saleAmount;
      
      posSession.summary.totalSales += saleAmount;
      await posSession.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: order[0],
      checkoutUrl // This will be null for non-chapa payments
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Search products for POS
// @route   GET /api/pos/products
// @access  Private
exports.getPosProducts = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const q = byTenant(req);

  if (search) {
    q.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: search }
    ];
  }

  const products = await Product.find(q)
    .select('name sku barcode price stock unit category')
    .limit(50);

  res.status(200).json({
    success: true,
    data: products
  });
});
