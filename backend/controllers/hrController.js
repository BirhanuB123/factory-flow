const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const LeaveRequest = require('../models/LeaveRequest');
const Department = require('../models/Department');
const Position = require('../models/Position');
const Notification = require('../models/Notification');
const AttendanceCorrectionRequest = require('../models/AttendanceCorrectionRequest');
const { byTenant } = require('../utils/tenantQuery');
const { assertPayrollMonthEditable } = require('../utils/payrollMonthGuard');

const ANNUAL_LEAVE_ENTITLEMENT_BY_TYPE = Object.freeze({
  annual: 21,
  sick: 10,
  maternity: 120,
  paternity: 10,
  other: 0,
});

function toDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseHHMM(v) {
  if (!v) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function recalcAttendanceMetrics(row) {
  const cin = parseHHMM(row.checkIn);
  const cout = parseHHMM(row.checkOut);
  row.workMinutes = 0;
  row.lateMinutes = 0;
  row.overtimeMinutes = 0;
  row.overtimeApprovalStatus = 'none';
  if (cin != null && cout != null && cout > cin) {
    row.workMinutes = cout - cin;
    row.lateMinutes = Math.max(0, cin - (8 * 60));
    row.overtimeMinutes = Math.max(0, row.workMinutes - (8 * 60));
    row.overtimeApprovalStatus = row.overtimeMinutes > 0 ? 'pending' : 'none';
  }
}

function leaveDaysInclusive(startDate, endDate) {
  const ms = toDateOnly(endDate).getTime() - toDateOnly(startDate).getTime();
  return Math.round(((ms / 86400000) + 1) * 2) / 2;
}

async function approvedLeaveDaysInYear(req, employeeId, leaveType, year) {
  const y = Number(year);
  const from = new Date(Date.UTC(y, 0, 1));
  const to = new Date(Date.UTC(y + 1, 0, 1));
  const q = byTenant(req, {
    employee: employeeId,
    status: 'approved',
    startDate: { $lt: to },
    endDate: { $gte: from },
  });
  if (leaveType) q.leaveType = leaveType;
  const rows = await LeaveRequest.find(q).select('days').lean();
  return rows.reduce((s, r) => s + (Number(r.days) || 0), 0);
}

// @desc    Get all employees
// @route   GET /api/hr/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find(byTenant(req))
    .populate('manager', 'name employeeId role')
    .populate('departmentId', 'code name')
    .populate('positionId', 'code title');
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

async function validateOrgRefs(req, payload, options = {}) {
  const { employeeIdBeingUpdated = null } = options;
  const out = {
    departmentId: undefined,
    positionId: undefined,
    manager: undefined,
    departmentNameFromRef: undefined,
    positionTitleFromRef: undefined,
  };

  if (payload.departmentId !== undefined) {
    if (!payload.departmentId) {
      out.departmentId = null;
    } else {
      const d = await Department.findOne(byTenant(req, { _id: payload.departmentId, active: true })).lean();
      if (!d) {
        const err = new Error('Department not found for this company');
        err.statusCode = 400;
        throw err;
      }
      out.departmentId = d._id;
      out.departmentNameFromRef = d.name;
    }
  }

  if (payload.positionId !== undefined) {
    if (!payload.positionId) {
      out.positionId = null;
    } else {
      const p = await Position.findOne(byTenant(req, { _id: payload.positionId, active: true })).lean();
      if (!p) {
        const err = new Error('Position not found for this company');
        err.statusCode = 400;
        throw err;
      }
      out.positionId = p._id;
      out.positionTitleFromRef = p.title;
      if (
        out.departmentId !== undefined &&
        out.departmentId &&
        p.department &&
        String(p.department) !== String(out.departmentId)
      ) {
        const err = new Error('Position does not belong to selected department');
        err.statusCode = 400;
        throw err;
      }
      if (out.departmentId === undefined && p.department) {
        out.departmentId = p.department;
      }
    }
  }

  if (payload.manager !== undefined) {
    if (!payload.manager) {
      out.manager = null;
    } else {
      if (employeeIdBeingUpdated && String(payload.manager) === String(employeeIdBeingUpdated)) {
        const err = new Error('Employee cannot report to themselves');
        err.statusCode = 400;
        throw err;
      }
      const mgr = await Employee.findOne(byTenant(req, { _id: payload.manager })).select('_id status').lean();
      if (!mgr || mgr.status === 'Offboarded') {
        const err = new Error('Manager not found or inactive for this company');
        err.statusCode = 400;
        throw err;
      }
      out.manager = mgr._id;
    }
  }

  return out;
}

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
    departmentId,
    positionId,
    manager,
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

  const orgRefs = await validateOrgRefs(
    req,
    { departmentId, positionId, manager },
    { employeeIdBeingUpdated: null }
  );

  const employee = await Employee.create({
    tenantId: req.tenantId,
    employeeId,
    name,
    role: appRole,
    jobTitle: orgRefs.positionTitleFromRef || jobTitle,
    department: orgRefs.departmentNameFromRef || department,
    departmentId: orgRefs.departmentId,
    positionId: orgRefs.positionId,
    manager: orgRefs.manager,
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
    departmentId,
    positionId,
    manager,
  } = req.body;

  const orgRefs = await validateOrgRefs(
    req,
    { departmentId, positionId, manager },
    { employeeIdBeingUpdated: req.params.id }
  );

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
  if (orgRefs.departmentId !== undefined) set.departmentId = orgRefs.departmentId;
  if (orgRefs.positionId !== undefined) set.positionId = orgRefs.positionId;
  if (orgRefs.manager !== undefined) set.manager = orgRefs.manager;
  if (orgRefs.departmentNameFromRef) set.department = orgRefs.departmentNameFromRef;
  if (orgRefs.positionTitleFromRef) set.jobTitle = orgRefs.positionTitleFromRef;

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
      departmentId: updatedEmployee.departmentId,
      positionId: updatedEmployee.positionId,
      manager: updatedEmployee.manager,
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
  const day = toDateOnly(date || new Date());
  if (!day) {
    res.status(400);
    throw new Error('Invalid attendance date');
  }

  const empOk = await Employee.exists(byTenant(req, { _id: employee }));
  if (!empOk) {
    res.status(400);
    throw new Error('Employee not found for this company');
  }

  const exists = await Attendance.exists(byTenant(req, { employee, date: day }));
  if (exists) {
    const err = new Error('Attendance already logged for this employee on this date');
    err.statusCode = 400;
    throw err;
  }

  let workMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let overtimeApprovalStatus = 'none';
  const cin = parseHHMM(checkIn);
  const cout = parseHHMM(checkOut);
  if (cin != null && cout != null && cout > cin) {
    workMinutes = cout - cin;
    lateMinutes = Math.max(0, cin - (8 * 60));
    overtimeMinutes = Math.max(0, workMinutes - (8 * 60));
    overtimeApprovalStatus = overtimeMinutes > 0 ? 'pending' : 'none';
  }

  let attendance;
  try {
    attendance = await Attendance.create({
      tenantId: req.tenantId,
      employee,
      date: day,
      status,
      checkIn,
      checkOut,
      workMinutes,
      lateMinutes,
      overtimeMinutes,
      overtimeApprovalStatus,
      notes,
    });
  } catch (e) {
    const dup =
      (e && e.code === 11000) ||
      (e && e.cause && e.cause.code === 11000) ||
      (e && e.errorResponse && e.errorResponse.code === 11000) ||
      String(e && e.message ? e.message : '').includes('duplicate key');
    if (dup) {
      const err = new Error('Attendance already logged for this employee on this date');
      err.statusCode = 400;
      throw err;
    }
    throw e;
  }

  if (attendance) {
    res.status(201).json(attendance);
  } else {
    res.status(400);
    throw new Error('Invalid attendance data');
  }
});

const reviewAttendanceOvertime = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!['approved', 'rejected'].includes(String(status || '').toLowerCase())) {
    res.status(400);
    throw new Error('status must be approved or rejected');
  }
  if (!req.user || !['Admin', 'hr_head'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Only Admin or HR Head can review overtime');
  }
  const attendance = await Attendance.findOne(byTenant(req, { _id: req.params.id }));
  if (!attendance) {
    res.status(404);
    throw new Error('Attendance not found');
  }
  if ((attendance.overtimeMinutes || 0) <= 0) {
    res.status(400);
    throw new Error('No overtime minutes to review');
  }
  attendance.overtimeApprovalStatus = String(status).toLowerCase();
  attendance.overtimeApprovedBy = req.user._id;
  attendance.overtimeApprovedAt = new Date();
  if (note) {
    attendance.notes = `${attendance.notes ? `${attendance.notes} | ` : ''}OT review: ${String(note)}`.slice(0, 1000);
  }
  await attendance.save();
  res.json(attendance);
});

const getLeaves = asyncHandler(async (req, res) => {
  const q = byTenant(req);
  if (req.query.employeeId) q.employee = req.query.employeeId;
  if (req.query.status) q.status = String(req.query.status).toLowerCase();
  if (req.query.from || req.query.to) {
    q.startDate = {};
    if (req.query.from) {
      const d = toDateOnly(req.query.from);
      if (d) q.startDate.$gte = d;
    }
    if (req.query.to) {
      const d = toDateOnly(req.query.to);
      if (d) q.startDate.$lte = d;
    }
    if (!Object.keys(q.startDate).length) delete q.startDate;
  }
  const rows = await LeaveRequest.find(q)
    .populate('employee', 'name employeeId department status')
    .populate('reviewedBy', 'name employeeId role')
    .sort({ startDate: -1, createdAt: -1 });
  res.json(rows);
});

const createLeave = asyncHandler(async (req, res) => {
  const { employee, leaveType, startDate, endDate, reason } = req.body;
  const from = toDateOnly(startDate);
  const to = toDateOnly(endDate);
  if (!from || !to || to < from) {
    res.status(400);
    throw new Error('Invalid leave period');
  }
  const emp = await Employee.findOne(byTenant(req, { _id: employee }));
  if (!emp) {
    res.status(400);
    throw new Error('Employee not found for this company');
  }
  const lt = String(leaveType || 'annual').toLowerCase();
  const allowed = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'];
  if (!allowed.includes(lt)) {
    res.status(400);
    throw new Error('Invalid leave type');
  }
  const days = leaveDaysInclusive(from, to);
  if (days <= 0) {
    res.status(400);
    throw new Error('Leave days must be greater than 0');
  }
  const row = await LeaveRequest.create({
    tenantId: req.tenantId,
    employee: emp._id,
    leaveType: lt,
    startDate: from,
    endDate: to,
    days,
    status: 'pending',
    reason: reason || '',
    createdBy: req.user?._id || null,
  });
  const out = await LeaveRequest.findOne(byTenant(req, { _id: row._id })).populate(
    'employee',
    'name employeeId department status'
  );
  res.status(201).json(out);
});

const reviewLeave = asyncHandler(async (req, res) => {
  const { status, reviewNote } = req.body;
  const next = String(status || '').toLowerCase();
  if (!['approved', 'rejected', 'cancelled'].includes(next)) {
    res.status(400);
    throw new Error('Invalid review status');
  }
  if (!req.user || !['Admin', 'hr_head'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Only Admin or HR Head can review leave');
  }
  const row = await LeaveRequest.findOne(byTenant(req, { _id: req.params.id }));
  if (!row) {
    res.status(404);
    throw new Error('Leave request not found');
  }
  if (row.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending leave can be reviewed');
  }
  if (next === 'approved' && row.leaveType !== 'unpaid') {
    const year = row.startDate.getUTCFullYear();
    const used = await approvedLeaveDaysInYear(req, row.employee, row.leaveType, year);
    const entitlement = ANNUAL_LEAVE_ENTITLEMENT_BY_TYPE[row.leaveType] || 0;
    if (entitlement > 0 && used + row.days > entitlement + 0.0001) {
      res.status(400);
      throw new Error(
        `Insufficient ${row.leaveType} balance: used ${used}, request ${row.days}, entitlement ${entitlement}`
      );
    }
  }
  row.status = next;
  row.reviewNote = reviewNote || '';
  row.reviewedBy = req.user._id;
  row.reviewedAt = new Date();
  await row.save();

  // Notify employee about leave decision (persistent bell notification + self-service visibility).
  await Notification.create({
    tenantId: req.tenantId,
    userId: row.employee,
    title: next === 'approved' ? 'Leave request approved' : next === 'rejected' ? 'Leave request rejected' : 'Leave request updated',
    description: `Your ${row.leaveType} leave (${row.days} day(s)) was ${next}.`,
    type: next === 'approved' ? 'success' : next === 'rejected' ? 'warning' : 'info',
  });

  if (next === 'approved') {
    const onLeaveNow =
      row.startDate <= new Date() &&
      row.endDate >= new Date();
    if (onLeaveNow) {
      await Employee.updateOne(byTenant(req, { _id: row.employee }), {
        $set: { status: 'On Leave' },
      });
    }
  }

  const out = await LeaveRequest.findOne(byTenant(req, { _id: row._id }))
    .populate('employee', 'name employeeId department status')
    .populate('reviewedBy', 'name employeeId role');
  res.json(out);
});

const getLeaveBalance = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne(byTenant(req, { _id: req.params.employeeId })).lean();
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const types = ['annual', 'sick', 'maternity', 'paternity', 'other'];
  const balances = {};
  for (const type of types) {
    const entitlement = ANNUAL_LEAVE_ENTITLEMENT_BY_TYPE[type] || 0;
    const used = await approvedLeaveDaysInYear(req, employee._id, type, year);
    balances[type] = {
      entitlement,
      used,
      remaining: Math.max(0, entitlement - used),
    };
  }
  const unpaidUsed = await approvedLeaveDaysInYear(req, employee._id, 'unpaid', year);
  balances.unpaid = {
    entitlement: null,
    used: unpaidUsed,
    remaining: null,
  };
  res.json({
    employee: {
      _id: employee._id,
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department,
      status: employee.status,
    },
    year,
    balances,
  });
});

const getAttendanceCorrections = asyncHandler(async (req, res) => {
  const q = byTenant(req);
  if (req.query.status) q.status = String(req.query.status).toLowerCase();
  if (req.query.employeeId) q.employee = req.query.employeeId;
  const rows = await AttendanceCorrectionRequest.find(q)
    .populate('employee', 'name employeeId department')
    .populate('reviewedBy', 'name employeeId role')
    .sort({ status: 1, attendanceDate: -1, createdAt: -1 });
  res.json(rows);
});

const reviewAttendanceCorrection = asyncHandler(async (req, res) => {
  const next = String(req.body.status || '').toLowerCase();
  if (!['approved', 'rejected', 'cancelled'].includes(next)) {
    const err = new Error('Invalid review status');
    err.statusCode = 400;
    throw err;
  }
  if (!req.user || !['Admin', 'hr_head'].includes(req.user.role)) {
    const err = new Error('Only Admin or HR Head can review correction requests');
    err.statusCode = 403;
    throw err;
  }
  const row = await AttendanceCorrectionRequest.findOne(byTenant(req, { _id: req.params.id }));
  if (!row) {
    const err = new Error('Attendance correction request not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('Only pending correction can be reviewed');
    err.statusCode = 400;
    throw err;
  }

  row.status = next;
  row.reviewNote = String(req.body.reviewNote || '');
  row.reviewedBy = req.user._id;
  row.reviewedAt = new Date();
  await row.save();

  if (next === 'approved') {
    let att = await Attendance.findOne(
      byTenant(req, { employee: row.employee, date: toDateOnly(row.attendanceDate) })
    );
    if (!att) {
      att = await Attendance.create({
        tenantId: req.tenantId,
        employee: row.employee,
        date: toDateOnly(row.attendanceDate),
        status: row.requestedStatus,
        checkIn: row.requestedCheckIn || '',
        checkOut: row.requestedCheckOut || '',
        notes: `Created from correction request ${row._id}`,
        workMinutes: 0,
        lateMinutes: 0,
        overtimeMinutes: 0,
        overtimeApprovalStatus: 'none',
      });
    } else {
      att.status = row.requestedStatus;
      att.checkIn = row.requestedCheckIn || '';
      att.checkOut = row.requestedCheckOut || '';
      att.notes = `${att.notes ? `${att.notes} | ` : ''}Updated from correction request ${row._id}`;
    }
    recalcAttendanceMetrics(att);
    await att.save();
  }

  await Notification.create({
    tenantId: req.tenantId,
    userId: row.employee,
    title:
      next === 'approved'
        ? 'Attendance correction approved'
        : next === 'rejected'
          ? 'Attendance correction rejected'
          : 'Attendance correction updated',
    description: `Your attendance correction for ${new Date(row.attendanceDate).toLocaleDateString()} was ${next}.`,
    type: next === 'approved' ? 'success' : next === 'rejected' ? 'warning' : 'info',
  });

  const out = await AttendanceCorrectionRequest.findOne(byTenant(req, { _id: row._id }))
    .populate('employee', 'name employeeId department')
    .populate('reviewedBy', 'name employeeId role');
  res.json(out);
});

const getDepartments = asyncHandler(async (req, res) => {
  const rows = await Department.find(byTenant(req)).sort({ active: -1, name: 1 }).lean();
  res.json(rows);
});

const createDepartment = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!code || !name) {
    const err = new Error('Department code and name are required');
    err.statusCode = 400;
    throw err;
  }
  const exists = await Department.findOne(byTenant(req, { code })).lean();
  if (exists) {
    const err = new Error('Department code already exists');
    err.statusCode = 400;
    throw err;
  }
  const row = await Department.create({
    tenantId: req.tenantId,
    code,
    name,
    description,
    active: req.body.active !== false,
  });
  res.status(201).json(row);
});

const updateDepartment = asyncHandler(async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) patch.name = String(req.body.name || '').trim();
  if (req.body.description !== undefined) patch.description = String(req.body.description || '').trim();
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.code !== undefined) patch.code = String(req.body.code || '').trim().toUpperCase();
  const row = await Department.findOneAndUpdate(byTenant(req, { _id: req.params.id }), patch, {
    new: true,
    runValidators: true,
  });
  if (!row) {
    const err = new Error('Department not found');
    err.statusCode = 404;
    throw err;
  }
  res.json(row);
});

const getPositions = asyncHandler(async (req, res) => {
  const q = byTenant(req);
  if (req.query.departmentId) q.department = req.query.departmentId;
  const rows = await Position.find(q)
    .populate('department', 'code name')
    .populate('reportsToPosition', 'code title')
    .sort({ active: -1, title: 1 })
    .lean();
  res.json(rows);
});

const createPosition = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const title = String(req.body.title || '').trim();
  const department = req.body.department || null;
  const reportsToPosition = req.body.reportsToPosition || null;
  if (!code || !title) {
    const err = new Error('Position code and title are required');
    err.statusCode = 400;
    throw err;
  }
  const exists = await Position.findOne(byTenant(req, { code })).lean();
  if (exists) {
    const err = new Error('Position code already exists');
    err.statusCode = 400;
    throw err;
  }
  if (department) {
    const d = await Department.findOne(byTenant(req, { _id: department, active: true })).lean();
    if (!d) {
      const err = new Error('Department not found for this company');
      err.statusCode = 400;
      throw err;
    }
  }
  if (reportsToPosition) {
    const rp = await Position.findOne(byTenant(req, { _id: reportsToPosition, active: true })).lean();
    if (!rp) {
      const err = new Error('reportsToPosition not found for this company');
      err.statusCode = 400;
      throw err;
    }
  }
  const row = await Position.create({
    tenantId: req.tenantId,
    code,
    title,
    department,
    reportsToPosition,
    active: req.body.active !== false,
  });
  const out = await Position.findOne(byTenant(req, { _id: row._id }))
    .populate('department', 'code name')
    .populate('reportsToPosition', 'code title');
  res.status(201).json(out);
});

const updatePosition = asyncHandler(async (req, res) => {
  const patch = {};
  if (req.body.title !== undefined) patch.title = String(req.body.title || '').trim();
  if (req.body.code !== undefined) patch.code = String(req.body.code || '').trim().toUpperCase();
  if (req.body.active !== undefined) patch.active = !!req.body.active;
  if (req.body.department !== undefined) {
    if (!req.body.department) {
      patch.department = null;
    } else {
      const d = await Department.findOne(byTenant(req, { _id: req.body.department, active: true })).lean();
      if (!d) {
        const err = new Error('Department not found for this company');
        err.statusCode = 400;
        throw err;
      }
      patch.department = d._id;
    }
  }
  if (req.body.reportsToPosition !== undefined) {
    if (!req.body.reportsToPosition) {
      patch.reportsToPosition = null;
    } else {
      if (String(req.body.reportsToPosition) === String(req.params.id)) {
        const err = new Error('Position cannot report to itself');
        err.statusCode = 400;
        throw err;
      }
      const p = await Position.findOne(byTenant(req, { _id: req.body.reportsToPosition, active: true })).lean();
      if (!p) {
        const err = new Error('reportsToPosition not found for this company');
        err.statusCode = 400;
        throw err;
      }
      patch.reportsToPosition = p._id;
    }
  }

  const row = await Position.findOneAndUpdate(byTenant(req, { _id: req.params.id }), patch, {
    new: true,
    runValidators: true,
  })
    .populate('department', 'code name')
    .populate('reportsToPosition', 'code title');
  if (!row) {
    const err = new Error('Position not found');
    err.statusCode = 404;
    throw err;
  }
  res.json(row);
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
  res.json({ success: true, data: payroll });
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
  reviewAttendanceOvertime,
  getLeaves,
  createLeave,
  reviewLeave,
  getLeaveBalance,
  getAttendanceCorrections,
  reviewAttendanceCorrection,
  getDepartments,
  createDepartment,
  updateDepartment,
  getPositions,
  createPosition,
  updatePosition,
  getPayroll,
  createPayroll
};
