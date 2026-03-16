const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

// @desc    Get all employees
// @route   GET /api/hr/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find({});
  res.json(employees);
});

// @desc    Create new employee
// @route   POST /api/hr/employees
// @access  Public
const createEmployee = asyncHandler(async (req, res) => {
  const { employeeId, name, role, department, status, email, phone, salary } = req.body;

  const employeeExists = await Employee.findOne({ employeeId });

  if (employeeExists) {
    res.status(400);
    throw new Error('Employee already exists');
  }

  const employee = await Employee.create({
    employeeId,
    name,
    role,
    department,
    status,
    email,
    phone,
    salary
  });

  if (employee) {
    res.status(201).json(employee);
  } else {
    res.status(400);
    throw new Error('Invalid employee data');
  }
});

// @desc    Update employee profile
// @route   PUT /api/hr/employees/:id
// @access  Private/Admin or HR Head
const updateEmployee = asyncHandler(async (req, res) => {
  const { name, role, department, status, email, phone, salary } = req.body;

  const updatedEmployee = await Employee.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        name,
        role,
        department,
        status,
        email,
        phone,
        salary
      }
    },
    { new: true } // Return the updated document
  );

  if (updatedEmployee) {
    res.json({
      _id: updatedEmployee._id,
      employeeId: updatedEmployee.employeeId,
      name: updatedEmployee.name,
      role: updatedEmployee.role,
      department: updatedEmployee.department,
      status: updatedEmployee.status,
      email: updatedEmployee.email,
      phone: updatedEmployee.phone,
      salary: updatedEmployee.salary
    });
  } else {
    res.status(404);
    throw new Error('Employee not found');
  }
});

// @desc    Get all attendance records
// @route   GET /api/hr/attendance
// @access  Public
const getAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.find({}).populate('employee', 'name role');
  res.json(attendance);
});

// @desc    Log attendance
// @route   POST /api/hr/attendance
// @access  Public
const logAttendance = asyncHandler(async (req, res) => {
  const { employee, date, status, checkIn, checkOut, notes } = req.body;

  const attendance = await Attendance.create({
    employee,
    date,
    status,
    checkIn,
    checkOut,
    notes
  });

  if (attendance) {
    res.status(201).json(attendance);
  } else {
    res.status(400);
    throw new Error('Invalid attendance data');
  }
});

// @desc    Get all payroll records
// @route   GET /api/hr/payroll
// @access  Public
const getPayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.find({}).populate('employee', 'name role');
  res.json(payroll);
});

// @desc    Create payroll record
// @route   POST /api/hr/payroll
// @access  Public
const createPayroll = asyncHandler(async (req, res) => {
  const { employee, month, basicSalary, bonuses, deductions, netSalary, paymentStatus, paymentDate } = req.body;

  const payroll = await Payroll.create({
    employee,
    month,
    basicSalary,
    bonuses,
    deductions,
    netSalary,
    paymentStatus,
    paymentDate
  });

  if (payroll) {
    res.status(201).json(payroll);
  } else {
    res.status(400);
    throw new Error('Invalid payroll data');
  }
});

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
  getAttendance,
  logAttendance,
  getPayroll,
  createPayroll
};
