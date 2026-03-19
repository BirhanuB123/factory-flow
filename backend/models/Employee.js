const mongoose = require('mongoose');

const employeeSchema = mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    default: 'employee'
  },
  /** Job title / position (separate from app permission role) */
  jobTitle: {
    type: String,
    default: '',
  },
  department: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'On Leave', 'Offboarded'],
    default: 'Active'
  },
  email: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    required: false
  },
  salary: {
    type: Number,
    required: false,
  },
  /** TIN for payroll / tax reporting */
  tinNumber: {
    type: String,
    default: '',
    trim: true,
  },
  pensionMemberId: {
    type: String,
    default: '',
    trim: true,
  },
  password: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const bcrypt = require('bcryptjs');

// Match user entered password to hashed password in database
employeeSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt (async hook: do not call next — Mongoose 8+)
employeeSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
