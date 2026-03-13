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
    required: true
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
  }
}, {
  timestamps: true
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
