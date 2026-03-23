const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const Client = require('../models/Client');
const Shipment = require('../models/Shipment');
const CogsEntry = require('../models/CogsEntry');
const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');
const { unitCostForSale } = require('../services/costingService');
const {
  getTaxSettings,
  computeSalesInvoiceTax,
} = require('../services/ethiopiaTaxService');
const { byTenant } = require('../utils/tenantQuery');

// @desc    Get all transactions (combined invoices and expenses)
// @route   GET /api/finance/transactions
exports.getTransactions = asyncHandler(async (req, res, next) => {
  const invoices = await Invoice.find(byTenant(req)).populate('client', 'name');
  const expenses = await Expense.find(byTenant(req));

  const formattedInvoices = invoices.map(inv => ({
    id: inv.invoiceId,
    sourceId: inv._id.toString(),
    category: 'Client Payment',
    amount: inv.amount,
    date: inv.dueDate.toISOString().split('T')[0],
    status: inv.status,
    type: 'Income',
    description: inv.description || `Invoice for ${inv.client ? inv.client.name : 'Unknown Client'}`,
    grossBeforeWht: inv.grossBeforeWht != null ? inv.grossBeforeWht : undefined,
    vatAmount: inv.vatAmount != null ? inv.vatAmount : undefined,
    salesWhtAmount: inv.salesWhtAmount != null ? inv.salesWhtAmount : undefined,
  }));

  const formattedExpenses = expenses.map(exp => ({
    id: `EXP-${exp._id.toString().slice(-4).toUpperCase()}`,
    category: exp.category,
    amount: exp.amount,
    date: exp.date.toISOString().split('T')[0],
    status: exp.status,
    type: 'Expense',
    description: exp.description
  }));

  const transactions = [...formattedInvoices, ...formattedExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.status(200).json(transactions);
});

// @desc    Create new invoice
// @route   POST /api/finance/invoices
exports.createInvoice = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  if (
    body.applyEthiopiaSalesTax &&
    body.client &&
    body.amount != null &&
    body.amountTaxable == null
  ) {
    const client = await Client.findOne(byTenant(req, { _id: body.client }));
    const settings = await getTaxSettings(req.tenantId);
    const tax = computeSalesInvoiceTax(Number(body.amount), client, settings);
    body.amountTaxable = tax.taxableAmount;
    body.vatRate = tax.vatRate;
    body.vatAmount = tax.vatAmount;
    body.salesWhtRate = tax.salesWhtRate;
    body.salesWhtAmount = tax.salesWhtAmount;
    body.grossBeforeWht = tax.grossBeforeWht;
    body.amount = tax.netPayable;
    body.sellerTinSnapshot = settings.companyTIN || '';
    body.buyerTinSnapshot = client?.tin || '';
    delete body.applyEthiopiaSalesTax;
  }
  delete body.tenantId;
  const invoice = await Invoice.create({ ...body, tenantId: req.tenantId });
  res.status(201).json({ success: true, data: invoice });
});

// @desc    Create new expense
// @route   POST /api/finance/expenses
exports.createExpense = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body.tenantId;
  const expense = await Expense.create({ ...body, tenantId: req.tenantId });
  res.status(201).json({ success: true, data: expense });
});

// @desc    Get finance stats
// @route   GET /api/finance/stats
exports.getFinanceStats = asyncHandler(async (req, res, next) => {
  const invoices = await Invoice.find(byTenant(req, { status: 'Paid' }));
  const expenses = await Expense.find(byTenant(req));

  const revenue = invoices.reduce(
    (acc, inv) => acc + (inv.grossBeforeWht != null ? inv.grossBeforeWht : inv.amount),
    0
  );
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const pendingInvoices = await Invoice.find(byTenant(req, { status: 'Pending' }));
  const pendingAmount = pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0);

  res.status(200).json({
    revenue,
    expenses: totalExpenses,
    profit: revenue - totalExpenses,
    pending: pendingAmount
  });
});

exports.createInvoiceFromOrder = asyncHandler(async (req, res) => {
  const { orderId, dueDate, invoiceId, shippedAt, shipmentId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'orderId required' });
  }
  const order = await Order.findOne(byTenant(req, { _id: orderId })).populate('items.product');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.approvalStatus === 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Order is pending approval; cannot invoice yet',
    });
  }
  if (order.approvalStatus === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'Order was rejected',
    });
  }

  let shipment = null;
  let invoiceAmount = Number(order.totalAmount) || 0;
  const disc = Number(order.discountPercent) || 0;
  const discountFactor = disc > 0 ? 1 - disc / 100 : 1;

  if (shipmentId) {
    shipment = await Shipment.findOne(byTenant(req, { _id: shipmentId }));
    if (!shipment || String(shipment.order) !== String(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not found or does not belong to this order',
      });
    }
    if (shipment.status !== 'shipped') {
      return res.status(400).json({
        success: false,
        message: 'Shipment must be in shipped status before invoicing',
      });
    }
    const dupShip = await Invoice.findOne(
      byTenant(req, {
        order: orderId,
        shipment: shipment._id,
      })
    );
    if (dupShip) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this shipment',
        data: dupShip,
      });
    }
    invoiceAmount = 0;
    for (const ln of shipment.lines) {
      const item = order.items[ln.lineIndex];
      if (!item) {
        return res.status(400).json({
          success: false,
          message: `Shipment references invalid line ${ln.lineIndex}`,
        });
      }
      invoiceAmount += Number(item.price) * Number(ln.quantity);
    }
    invoiceAmount = Math.round(invoiceAmount * discountFactor * 100) / 100;
  } else {
    const shippedShipments = await Shipment.countDocuments(
      byTenant(req, {
        order: orderId,
        status: 'shipped',
      })
    );
    if (shippedShipments > 0) {
      return res.status(400).json({
        success: false,
        message:
          'This order has shipped packages. Create invoices per shipment (pass shipmentId).',
      });
    }
    const dupFull = await Invoice.findOne(
      byTenant(req, {
        order: orderId,
        $or: [{ shipment: null }, { shipment: { $exists: false } }],
      })
    );
    if (dupFull) {
      return res.status(400).json({
        success: false,
        message:
          'A full-order invoice exists. Use shipmentId for partial invoices, or invoice per shipment only.',
        data: dupFull,
      });
    }
    invoiceAmount = Math.round(invoiceAmount * discountFactor * 100) / 100;
  }

  const invId =
    invoiceId || `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const due = dueDate
    ? new Date(dueDate)
    : new Date(Date.now() + 30 * 86400000);
  const shipDate = shippedAt
    ? new Date(shippedAt)
    : shipment?.shippedAt || null;

  const client = await Client.findOne(byTenant(req, { _id: order.client }));
  const settings = await getTaxSettings(req.tenantId);
  const tax = computeSalesInvoiceTax(invoiceAmount, client, settings);

  const invoice = await Invoice.create({
    tenantId: req.tenantId,
    client: order.client,
    invoiceId: invId,
    amount: tax.netPayable,
    amountTaxable: tax.taxableAmount,
    vatRate: tax.vatRate,
    vatAmount: tax.vatAmount,
    salesWhtRate: tax.salesWhtRate,
    salesWhtAmount: tax.salesWhtAmount,
    grossBeforeWht: tax.grossBeforeWht,
    sellerTinSnapshot: settings.companyTIN || '',
    buyerTinSnapshot: client?.tin || '',
    dueDate: due,
    description: shipment
      ? `Shipment ${shipment.shipmentNumber} — order (${order._id.toString().slice(-8)})`
      : `Invoice for order (${order._id.toString().slice(-8)})`,
    order: order._id,
    invoiceDate: new Date(),
    shippedAt: shipDate,
    shipment: shipment ? shipment._id : null,
    status: 'Pending',
  });

  const cogsLines = [];
  let totalCogs = 0;
  if (shipment) {
    for (const ln of shipment.lines) {
      const item = order.items[ln.lineIndex];
      const prod = item.product;
      const pdoc =
        prod && typeof prod === 'object' && prod._id
          ? prod
          : await Product.findOne(byTenant(req, { _id: item.product }));
      const uc = unitCostForSale(pdoc);
      const q = Number(ln.quantity);
      const ext = Math.round(uc * q * 10000) / 10000;
      totalCogs += ext;
      cogsLines.push({
        product: item.product,
        sku: pdoc?.sku || '',
        quantity: q,
        unitCost: uc,
        extCost: ext,
      });
    }
  } else {
    for (const item of order.items) {
      const prod = item.product;
      const pdoc =
        prod && typeof prod === 'object' && prod._id
          ? prod
          : await Product.findOne(byTenant(req, { _id: item.product }));
      const uc = unitCostForSale(pdoc);
      const q = Number(item.quantity);
      const ext = Math.round(uc * q * discountFactor * 10000) / 10000;
      totalCogs += ext;
      cogsLines.push({
        product: item.product,
        sku: pdoc?.sku || '',
        quantity: q,
        unitCost: uc,
        extCost: ext,
      });
    }
  }
  totalCogs = Math.round(totalCogs * 100) / 100;
  await CogsEntry.create({
    tenantId: req.tenantId,
    invoice: invoice._id,
    order: order._id,
    lines: cogsLines,
    totalCogs,
  });

  const populated = await Invoice.findOne(byTenant(req, { _id: invoice._id }))
    .populate('client', 'name')
    .populate('order')
    .populate('shipment');
  res.status(201).json({ success: true, data: populated });
});

exports.getCogsForInvoice = asyncHandler(async (req, res) => {
  const entry = await CogsEntry.findOne(
    byTenant(req, { invoice: req.params.invoiceId })
  )
    .populate('invoice', 'invoiceId amount')
    .lean();
  if (!entry) {
    return res.status(404).json({ success: false, message: 'No COGS entry for this invoice' });
  }
  res.json({ success: true, data: entry });
});

exports.getARAging = asyncHandler(async (req, res) => {
  const now = new Date();
  await Invoice.updateMany(
    byTenant(req, { status: 'Pending', dueDate: { $lt: now } }),
    { $set: { status: 'Overdue' } }
  );

  const open = await Invoice.find(
    byTenant(req, { status: { $in: ['Pending', 'Overdue'] } })
  )
    .populate('client', 'name')
    .sort({ dueDate: 1 })
    .lean();

  const buckets = {
    notDue: [],
    days1_30: [],
    days31_60: [],
    days61_90: [],
    days90plus: [],
  };

  const sum = (arr) => arr.reduce((s, r) => s + r.amount, 0);

  for (const inv of open) {
    const due = new Date(inv.dueDate);
    const daysPast = Math.floor((now - due) / 86400000);
    const row = {
      _id: inv._id,
      invoiceId: inv.invoiceId,
      clientName: inv.client?.name || '—',
      amount: inv.amount,
      dueDate: inv.dueDate,
      status: inv.status,
      order: inv.order,
      daysPastDue: Math.max(0, daysPast),
    };
    if (daysPast <= 0) buckets.notDue.push(row);
    else if (daysPast <= 30) buckets.days1_30.push(row);
    else if (daysPast <= 60) buckets.days31_60.push(row);
    else if (daysPast <= 90) buckets.days61_90.push(row);
    else buckets.days90plus.push(row);
  }

  res.json({
    success: true,
    data: {
      buckets,
      totals: {
        notDue: sum(buckets.notDue),
        days1_30: sum(buckets.days1_30),
        days31_60: sum(buckets.days31_60),
        days61_90: sum(buckets.days61_90),
        days90plus: sum(buckets.days90plus),
        openAR:
          sum(buckets.notDue) +
          sum(buckets.days1_30) +
          sum(buckets.days31_60) +
          sum(buckets.days61_90) +
          sum(buckets.days90plus),
      },
    },
  });
});
