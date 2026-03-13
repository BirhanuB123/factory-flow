const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all transactions (combined invoices and expenses)
// @route   GET /api/finance/transactions
exports.getTransactions = asyncHandler(async (req, res, next) => {
  const invoices = await Invoice.find().populate('client', 'name');
  const expenses = await Expense.find();

  const formattedInvoices = invoices.map(inv => ({
    id: inv.invoiceId,
    category: 'Client Payment',
    amount: inv.amount,
    date: inv.dueDate.toISOString().split('T')[0],
    status: inv.status,
    type: 'Income',
    description: inv.description || `Invoice for ${inv.client ? inv.client.name : 'Unknown Client'}`
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
  const invoice = await Invoice.create(req.body);
  res.status(201).json({ success: true, data: invoice });
});

// @desc    Create new expense
// @route   POST /api/finance/expenses
exports.createExpense = asyncHandler(async (req, res, next) => {
  const expense = await Expense.create(req.body);
  res.status(201).json({ success: true, data: expense });
});

// @desc    Get finance stats
// @route   GET /api/finance/stats
exports.getFinanceStats = asyncHandler(async (req, res, next) => {
  const invoices = await Invoice.find({ status: 'Paid' });
  const expenses = await Expense.find();

  const revenue = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const pendingInvoices = await Invoice.find({ status: 'Pending' });
  const pendingAmount = pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0);

  res.status(200).json({
    revenue,
    expenses: totalExpenses,
    profit: revenue - totalExpenses,
    pending: pendingAmount
  });
});
