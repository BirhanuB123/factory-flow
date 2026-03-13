const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Please add a category']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending'],
    default: 'Paid'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
