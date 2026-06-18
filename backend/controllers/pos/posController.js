const asyncHandler = require('../../middleware/asyncHandler');
const PosSession = require('../../models/PosSession');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Invoice = require('../../models/Invoice');
const JournalEntry = require('../../models/JournalEntry');
const { applyMovement } = require('../../services/stockService');
const { createPosSaleJournal } = require('../../services/posJournalService');
const { createPosInvoice } = require('../../services/posInvoiceService');
const mongoose = require('mongoose');
const { byTenant } = require('../../utils/tenantQuery');

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
  session.closingBalance = session.openingBalance + session.summary.cashSales;
  session.actualClosingBalance = actualClosingBalance;
  session.difference = actualClosingBalance - session.closingBalance;
  session.note = note || session.note;

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

const { initializeTransaction } = require('../../services/paymentService');

// @desc    Process a POS sale
// @route   POST /api/pos/sale
// @access  Private
exports.processSale = asyncHandler(async (req, res) => {
  const { items, totalAmount, paymentDetails, clientId, discountPercent, payments: splitPayments } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let invoice = null;

    const posSession = await PosSession.findOne(byTenant(req, {
      user: req.user.id,
      status: 'open'
    })).session(session);

    if (!posSession) {
      throw new Error('No open POS session found. Please open a session first.');
    }

    const isSplit = paymentDetails.method === 'split';
    if (isSplit) {
      if (!Array.isArray(splitPayments) || splitPayments.length < 2) {
        throw new Error('Split payment requires at least two payment entries');
      }
      const round2 = (n) => Math.round(Number(n) * 100) / 100;
      const splitSum = round2(splitPayments.reduce((s, p) => s + Number(p.amount || 0), 0));
      if (Math.abs(splitSum - totalAmount) > 0.02) {
        throw new Error(`Split payment amounts (${splitSum}) must equal the order total (${totalAmount})`);
      }
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
      paymentDetails: { ...paymentDetails, txRef, paymentStatus },
      payments: isSplit ? splitPayments : [],
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

      if (isSplit) {
        for (const p of splitPayments) {
          if (p.method === 'cash') posSession.summary.cashSales += p.amount;
          else if (p.method === 'card') posSession.summary.cardSales += p.amount;
          else posSession.summary.mobileSales += p.amount;
        }
      } else {
        if (method === 'cash') posSession.summary.cashSales += totalAmount;
        else if (method === 'card') posSession.summary.cardSales += totalAmount;
        else if (method === 'mobile') posSession.summary.mobileSales += totalAmount;
      }

      posSession.summary.totalSales += totalAmount;
      posSession.summary.discountTotal += totalAmount * ((discountPercent || 0) / 100);
      await posSession.save({ session });

      // Post GL journal entry (passes splitPayments so each method gets its own DR line)
      await createPosSaleJournal({ tenantId: req.tenantId, order: order[0], splitPayments: isSplit ? splitPayments : undefined, mongoSession: session });

      // Create formal invoice
      invoice = await createPosInvoice({ tenantId: req.tenantId, order: order[0], mongoSession: session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: order[0],
      invoice,
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

// @desc    Get today's POS sales (for history panel)
// @route   GET /api/pos/sales
// @access  Private
exports.getSales = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const orders = await Order.find(byTenant(req, {
    source: 'pos',
    orderDate: { $gte: startOfDay },
    status: { $ne: 'cancelled' },
  }))
    .sort({ orderDate: -1 })
    .limit(100)
    .lean();

  const orderIds = orders.map((o) => o._id);
  const invoices = await Invoice.find(byTenant(req, { order: { $in: orderIds } }))
    .select('order invoiceId')
    .lean();

  const invoiceMap = {};
  for (const inv of invoices) {
    invoiceMap[String(inv.order)] = inv.invoiceId;
  }

  const data = orders.map((o) => ({
    ...o,
    invoiceId: invoiceMap[String(o._id)] || null,
  }));

  res.json({ success: true, data });
});

// @desc    Void a completed POS sale
// @route   POST /api/pos/sale/:id/void
// @access  Private
exports.voidSale = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const order = await Order.findOne(
      byTenant(req, { _id: req.params.id, source: 'pos' })
    ).session(mongoSession);

    if (!order) throw new Error('POS order not found');
    if (order.status === 'cancelled') throw new Error('Order is already voided');
    if (order.paymentDetails?.paymentStatus !== 'completed') {
      throw new Error('Only completed sales can be voided');
    }

    // 1. Reverse stock — return items back to shelf
    for (const item of order.items) {
      await applyMovement(mongoSession, {
        tenantId: req.tenantId,
        productId: item.product,
        delta: +item.quantity,
        movementType: 'sale_return',
        referenceType: 'Order',
        referenceId: order._id,
        note: `POS Void: ${order._id}`,
      });
    }

    // 2. Reverse GL — swap debit/credit on every line of the original journal
    const originalJournal = await JournalEntry.findOne(
      byTenant(req, { source: 'pos', sourceRef: String(order._id) })
    ).session(mongoSession);

    if (originalJournal) {
      const reversedLines = originalJournal.lines.map((l) => ({
        account: l.account,
        debit: l.credit,
        credit: l.debit,
        memo: `Void: ${l.memo}`,
      }));
      await JournalEntry.create(
        [{
          tenantId: req.tenantId,
          entryDate: new Date(),
          memo: `Void POS Sale — ${String(order._id).slice(-8).toUpperCase()}${reason ? ` (${reason})` : ''}`,
          source: 'pos',
          sourceRef: `void:${order._id}`,
          lines: reversedLines,
        }],
        { session: mongoSession }
      );
    }

    // 3. Mark invoice void
    await Invoice.findOneAndUpdate(
      byTenant(req, { order: order._id }),
      { $set: { status: 'Void' } },
      { session: mongoSession }
    );

    // 4. Subtract from POS session summary (only if session still open)
    const posSession = await PosSession.findById(order.posSession).session(mongoSession);
    if (posSession?.status === 'open') {
      const method = order.paymentDetails?.method;
      const amount = order.totalAmount;
      posSession.summary.totalSales = Math.max(0, posSession.summary.totalSales - amount);
      if (method === 'cash') posSession.summary.cashSales = Math.max(0, posSession.summary.cashSales - amount);
      else if (method === 'card') posSession.summary.cardSales = Math.max(0, posSession.summary.cardSales - amount);
      else if (method === 'mobile' || method === 'chapa') posSession.summary.mobileSales = Math.max(0, posSession.summary.mobileSales - amount);
      await posSession.save({ session: mongoSession });
    }

    // 5. Cancel the order
    order.status = 'cancelled';
    order.paymentDetails.paymentStatus = 'refunded';
    await order.save({ session: mongoSession });

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    res.json({ success: true, data: order });
  } catch (error) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Daily Z-report — today's sales summary
// @route   GET /api/pos/reports/daily
// @access  Private
exports.getDailyReport = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [deliveredOrders, voidedOrders] = await Promise.all([
    Order.find(byTenant(req, {
      source: 'pos',
      orderDate: { $gte: startOfDay },
      status: 'delivered',
      'paymentDetails.paymentStatus': 'completed',
    })).lean(),
    Order.find(byTenant(req, {
      source: 'pos',
      orderDate: { $gte: startOfDay },
      status: 'cancelled',
      'paymentDetails.paymentStatus': 'refunded',
    })).lean(),
  ]);

  let totalRevenue = 0;
  let cashSales = 0;
  let cardSales = 0;
  let mobileSales = 0;
  let discountTotal = 0;
  const productTotals = {};

  for (const order of deliveredOrders) {
    totalRevenue += order.totalAmount;
    const method = order.paymentDetails?.method;
    if (method === 'cash') cashSales += order.totalAmount;
    else if (method === 'card') cardSales += order.totalAmount;
    else mobileSales += order.totalAmount;
    discountTotal += order.totalAmount * ((order.discountPercent || 0) / 100);

    for (const item of order.items) {
      const pid = String(item.product);
      if (!productTotals[pid]) productTotals[pid] = { quantity: 0, revenue: 0 };
      productTotals[pid].quantity += item.quantity;
      productTotals[pid].revenue += item.quantity * item.price;
    }
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  const topIds = Object.entries(productTotals)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([id]) => id);

  const topProductDocs = await Product.find({ _id: { $in: topIds } }).select('name sku').lean();
  const productMap = Object.fromEntries(topProductDocs.map((p) => [String(p._id), p]));

  const topProducts = topIds.map((id) => ({
    name: productMap[id]?.name || 'Unknown',
    sku: productMap[id]?.sku || '',
    quantity: productTotals[id].quantity,
    revenue: round2(productTotals[id].revenue),
  }));

  const voidedAmount = voidedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  res.json({
    success: true,
    data: {
      date: startOfDay.toISOString().split('T')[0],
      transactionCount: deliveredOrders.length,
      totalRevenue: round2(totalRevenue),
      cashSales: round2(cashSales),
      cardSales: round2(cardSales),
      mobileSales: round2(mobileSales),
      discountTotal: round2(discountTotal),
      voidCount: voidedOrders.length,
      voidedAmount: round2(voidedAmount),
      topProducts,
    },
  });
});

// @desc    Session reconciliation report
// @route   GET /api/pos/reports/session/:id
// @access  Private
exports.getSessionReport = asyncHandler(async (req, res) => {
  const posSession = await PosSession.findOne(byTenant(req, { _id: req.params.id }))
    .populate('user', 'name email')
    .lean();

  if (!posSession) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const voidedOrders = await Order.find(byTenant(req, {
    posSession: posSession._id,
    status: 'cancelled',
    'paymentDetails.paymentStatus': 'refunded',
  })).lean();

  const round2 = (n) => Math.round(n * 100) / 100;
  const voidedAmount = round2(voidedOrders.reduce((sum, o) => sum + o.totalAmount, 0));

  res.json({
    success: true,
    data: {
      ...posSession,
      voidCount: voidedOrders.length,
      voidedAmount,
    },
  });
});
