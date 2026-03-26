const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const { byTenant } = require('../utils/tenantQuery');
const { assertPayrollMonthEditable } = require('../utils/payrollMonthGuard');

// @desc    Get all employees
// @route   GET /api/hr/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find(byTenant(req));
  res.json(employees);
});

// @desc    Create new employee
// @route   POST /api/hr/employees
// @access  Public
const APP_ROLES = [
  'Admin',
  'hr_head',
  'finance_head',
  'finance_viewer',
  'employee',
  'purchasing_head',
  'warehouse_head',
];

const createEmployee = asyncHandler(async (req, res) => {
  const {
    employeeId,
    name,
    role: roleOrTitle,
    accessRole,
    jobTitle: jobTitleBody,
    department,
    status,
    email,
    phone,
    salary,
    password,
    tinNumber,
    pensionMemberId,
  } = req.body;

  const employeeExists = await Employee.findOne(byTenant(req, { employeeId }));

  if (employeeExists) {
    res.status(400);
    throw new Error('Employee already exists');
  }

  let appRole = 'employee';
  let jobTitle = '';

  if (accessRole && APP_ROLES.includes(accessRole)) {
    appRole = accessRole;
    jobTitle = jobTitleBody || (APP_ROLES.includes(roleOrTitle) ? '' : roleOrTitle) || '';
  } else if (roleOrTitle && APP_ROLES.includes(roleOrTitle)) {
    appRole = roleOrTitle;
    jobTitle = jobTitleBody || '';
  } else {
    appRole = 'employee';
    jobTitle = roleOrTitle || jobTitleBody || '';
  }

  const employee = await Employee.create({
    tenantId: req.tenantId,
    employeeId,
    name,
    role: appRole,
    jobTitle,
    department,
    status,
    email,
    phone,
    salary,
    tinNumber: tinNumber != null ? String(tinNumber).trim() : '',
    pensionMemberId: pensionMemberId != null ? String(pensionMemberId).trim() : '',
    password: password || 'factory123', // Default password if not provided, though it should be required
  });

  if (employee) {
    res.status(201).json(employee);
  } else {
    res.status(400);
    throw new Error('Invalid employee data');
  }
});
const updateEmployee = asyncHandler(async (req, res) => {
  const {
    name,
    department,
    status,
    email,
    phone,
    salary,
    jobTitle,
    accessRole,
    role,
    tinNumber,
    pensionMemberId,
  } = req.body;

  const set = {
    name,
    department,
    status,
    email,
    phone,
    salary,
  };
  if (jobTitle !== undefined) set.jobTitle = jobTitle;
  if (role !== undefined && !APP_ROLES.includes(role) && !accessRole) {
    set.jobTitle = role;
  }
  if (req.user.role === 'Admin' && accessRole && APP_ROLES.includes(accessRole)) {
    set.role = accessRole;
  }
  if (tinNumber !== undefined) set.tinNumber = String(tinNumber).trim();
  if (pensionMemberId !== undefined) set.pensionMemberId = String(pensionMemberId).trim();

  const updatedEmployee = await Employee.findOneAndUpdate(
    byTenant(req, { _id: req.params.id }),
    { $set: set },
    { new: true }
  );

  if (updatedEmployee) {
    res.json({
      _id: updatedEmployee._id,
      employeeId: updatedEmployee.employeeId,
      name: updatedEmployee.name,
      role: updatedEmployee.role,
      jobTitle: updatedEmployee.jobTitle,
      department: updatedEmployee.department,
      status: updatedEmployee.status,
      email: updatedEmployee.email,
      phone: updatedEmployee.phone,
      salary: updatedEmployee.salary,
      tinNumber: updatedEmployee.tinNumber,
      pensionMemberId: updatedEmployee.pensionMemberId,
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
  const attendance = await Attendance.find(byTenant(req)).populate('employee', 'name role');
  res.json(attendance);
});

// @desc    Log attendance
// @route   POST /api/hr/attendance
// @access  Public
const logAttendance = asyncHandler(async (req, res) => {
  const { employee, date, status, checkIn, checkOut, notes } = req.body;

  const empOk = await Employee.exists(byTenant(req, { _id: employee }));
  if (!empOk) {
    res.status(400);
    throw new Error('Employee not found for this company');
  }

  const attendance = await Attendance.create({
    tenantId: req.tenantId,
    employee,
    date,
    status,
    checkIn,
    checkOut,
    notes,
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
  const q = byTenant(req);
  if (req.query.month && /^\d{4}-\d{2}$/.test(String(req.query.month))) {
    q.month = String(req.query.month).trim();
  }
  const payroll = await Payroll.find(q)
    .populate('employee', 'name role employeeId department tinNumber')
    .sort({ month: -1, createdAt: -1 });
  res.json(payroll);
});

// @desc    Create payroll record
// @route   POST /api/hr/payroll
// @access  Public
const createPayroll = asyncHandler(async (req, res) => {
  const { employee, month, basicSalary, bonuses, deductions, netSalary, paymentStatus, paymentDate } = req.body;

  if (month) {
    await assertPayrollMonthEditable(req, String(month).trim());
  }

  const empOk = await Employee.exists(byTenant(req, { _id: employee }));
  if (!empOk) {
    res.status(400);
    throw new Error('Employee not found for this company');
  }

  const payroll = await Payroll.create({
    tenantId: req.tenantId,
    employee,
    month,
    basicSalary,
    bonuses,
    deductions,
    netSalary,
    paymentStatus,
    paymentDate,
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
