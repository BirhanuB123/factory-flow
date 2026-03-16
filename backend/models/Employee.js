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
    enum: ['employee', 'Admin', 'finance_head', 'hr_head'],
    default: 'employee'
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
    required: false
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

// Encrypt password using bcrypt
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
