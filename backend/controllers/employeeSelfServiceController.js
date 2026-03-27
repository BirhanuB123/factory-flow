const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceCorrectionRequest = require('../models/AttendanceCorrectionRequest');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const { byTenant } = require('../utils/tenantQuery');

function assertEmployeeRole(req) {
  if (!req.user || req.user.role !== 'employee') {
    const err = new Error('Employee self-service only');
    err.statusCode = 403;
    throw err;
  }
}

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

function nowHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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

async function notifyHrApprovers(req, payload) {
  const approvers = await Employee.find(
    byTenant(req, {
      role: { $in: ['Admin', 'hr_head'] },
      status: { $ne: 'Offboarded' },
    })
  )
    .select('_id')
    .lean();
  if (!approvers.length) return;
  await Notification.insertMany(
    approvers.map((a) => ({
      tenantId: req.tenantId,
      userId: a._id,
      title: payload.title,
      description: payload.description,
      type: payload.type || 'info',
    }))
  );
}

exports.submitAttendance = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const { date, status, checkIn, checkOut, notes } = req.body || {};
  const day = toDateOnly(date || new Date());
  if (!day) {
    const err = new Error('Invalid attendance date');
    err.statusCode = 400;
    throw err;
  }
  const today = toDateOnly(new Date());
  if (day.getTime() > today.getTime()) {
    const err = new Error('Future attendance is not allowed');
    err.statusCode = 400;
    throw err;
  }
  const allowed = ['Present', 'Absent', 'Late', 'On Leave'];
  const st = String(status || 'Present');
  if (!allowed.includes(st)) {
    const err = new Error('Invalid attendance status');
    err.statusCode = 400;
    throw err;
  }
  const exists = await Attendance.exists(byTenant(req, { employee: req.user._id, date: day }));
  if (exists) {
    const err = new Error('Attendance already exists for this date');
    err.statusCode = 400;
    throw err;
  }
  const row = await Attendance.create({
    tenantId: req.tenantId,
    employee: req.user._id,
    date: day,
    status: st,
    checkIn: String(checkIn || ''),
    checkOut: String(checkOut || ''),
    notes: String(notes || '').trim(),
    workMinutes: 0,
    lateMinutes: 0,
    overtimeMinutes: 0,
    overtimeApprovalStatus: 'none',
  });
  recalcAttendanceMetrics(row);
  await row.save();
  res.status(201).json({ success: true, data: row });
});

exports.getMyAttendance = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const q = byTenant(req, { employee: req.user._id });
  if (req.query.from || req.query.to) {
    q.date = {};
    if (req.query.from) {
      const d = toDateOnly(req.query.from);
      if (d) q.date.$gte = d;
    }
    if (req.query.to) {
      const d = toDateOnly(req.query.to);
      if (d) q.date.$lte = d;
    }
    if (!Object.keys(q.date).length) delete q.date;
  }
  const rows = await Attendance.find(q).sort({ date: -1 }).limit(120).lean();
  res.json(rows);
});

exports.getMyAttendanceToday = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const day = toDateOnly(new Date());
  const row = await Attendance.findOne(byTenant(req, { employee: req.user._id, date: day })).lean();
  res.json({ success: true, data: row || null });
});

exports.checkIn = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const day = toDateOnly(new Date());
  const existing = await Attendance.findOne(byTenant(req, { employee: req.user._id, date: day }));
  if (existing && existing.checkIn) {
    const err = new Error('Already checked in for today');
    err.statusCode = 400;
    throw err;
  }
  if (existing && !existing.checkIn) {
    existing.checkIn = nowHHMM();
    existing.status = existing.status || 'Present';
    existing.notes = req.body?.notes ? String(req.body.notes) : existing.notes;
    await existing.save();
    return res.json({ success: true, data: existing });
  }
  const row = await Attendance.create({
    tenantId: req.tenantId,
    employee: req.user._id,
    date: day,
    status: 'Present',
    checkIn: nowHHMM(),
    checkOut: '',
    notes: req.body?.notes ? String(req.body.notes) : '',
    workMinutes: 0,
    lateMinutes: 0,
    overtimeMinutes: 0,
    overtimeApprovalStatus: 'none',
  });
  res.status(201).json({ success: true, data: row });
});

exports.checkOut = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const day = toDateOnly(new Date());
  const row = await Attendance.findOne(byTenant(req, { employee: req.user._id, date: day }));
  if (!row || !row.checkIn) {
    const err = new Error('Check in first');
    err.statusCode = 400;
    throw err;
  }
  if (row.checkOut) {
    const err = new Error('Already checked out for today');
    err.statusCode = 400;
    throw err;
  }
  row.checkOut = nowHHMM();
  if (req.body?.notes) row.notes = String(req.body.notes);
  recalcAttendanceMetrics(row);
  await row.save();
  res.json({ success: true, data: row });
});

exports.getMyLeaves = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const rows = await LeaveRequest.find(byTenant(req, { employee: req.user._id }))
    .sort({ startDate: -1, createdAt: -1 })
    .lean();
  res.json({ success: true, data: rows });
});

exports.requestMyLeave = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const leaveType = String(req.body.leaveType || 'annual').toLowerCase();
  const startDate = toDateOnly(req.body.startDate);
  const endDate = toDateOnly(req.body.endDate);
  if (!startDate || !endDate || endDate < startDate) {
    const err = new Error('Invalid leave period');
    err.statusCode = 400;
    throw err;
  }
  const allowed = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'];
  if (!allowed.includes(leaveType)) {
    const err = new Error('Invalid leave type');
    err.statusCode = 400;
    throw err;
  }
  const days = Math.round((((endDate.getTime() - startDate.getTime()) / 86400000) + 1) * 2) / 2;
  const row = await LeaveRequest.create({
    tenantId: req.tenantId,
    employee: req.user._id,
    leaveType,
    startDate,
    endDate,
    days,
    status: 'pending',
    reason: String(req.body.reason || ''),
    createdBy: req.user._id,
  });
  await notifyHrApprovers(req, {
    title: 'Leave request needs approval',
    description: `${req.user.name || req.user.employeeId} submitted ${leaveType} leave for ${days} day(s).`,
    type: 'warning',
  });
  res.status(201).json({ success: true, data: row });
});

exports.updateMyPendingLeave = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const row = await LeaveRequest.findOne(
    byTenant(req, { _id: req.params.id, employee: req.user._id })
  );
  if (!row) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('Only pending leave request can be edited');
    err.statusCode = 400;
    throw err;
  }
  const leaveType = req.body.leaveType ? String(req.body.leaveType).toLowerCase() : row.leaveType;
  const allowed = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'];
  if (!allowed.includes(leaveType)) {
    const err = new Error('Invalid leave type');
    err.statusCode = 400;
    throw err;
  }
  const startDate = req.body.startDate ? toDateOnly(req.body.startDate) : row.startDate;
  const endDate = req.body.endDate ? toDateOnly(req.body.endDate) : row.endDate;
  if (!startDate || !endDate || endDate < startDate) {
    const err = new Error('Invalid leave period');
    err.statusCode = 400;
    throw err;
  }
  const days = Math.round((((endDate.getTime() - startDate.getTime()) / 86400000) + 1) * 2) / 2;
  row.leaveType = leaveType;
  row.startDate = startDate;
  row.endDate = endDate;
  row.days = days;
  if (req.body.reason !== undefined) row.reason = String(req.body.reason || '');
  await row.save();
  res.json({ success: true, data: row });
});

exports.cancelMyPendingLeave = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const row = await LeaveRequest.findOne(
    byTenant(req, { _id: req.params.id, employee: req.user._id })
  );
  if (!row) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('Only pending leave request can be cancelled');
    err.statusCode = 400;
    throw err;
  }
  row.status = 'cancelled';
  await row.save();
  res.json({ success: true, data: row });
});

exports.getMyAttendanceCorrections = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const rows = await AttendanceCorrectionRequest.find(
    byTenant(req, { employee: req.user._id })
  )
    .sort({ attendanceDate: -1, createdAt: -1 })
    .lean();
  res.json({ success: true, data: rows });
});

exports.createMyAttendanceCorrection = asyncHandler(async (req, res) => {
  assertEmployeeRole(req);
  const attendanceDate = toDateOnly(req.body.attendanceDate);
  if (!attendanceDate) {
    const err = new Error('attendanceDate is required');
    err.statusCode = 400;
    throw err;
  }
  const today = toDateOnly(new Date());
  if (attendanceDate.getTime() > today.getTime()) {
    const err = new Error('Cannot request correction for future date');
    err.statusCode = 400;
    throw err;
  }
  const requestedStatus = String(req.body.requestedStatus || 'Present');
  const allowed = ['Present', 'Absent', 'Late', 'On Leave'];
  if (!allowed.includes(requestedStatus)) {
    const err = new Error('Invalid requestedStatus');
    err.statusCode = 400;
    throw err;
  }

  const activeExisting = await AttendanceCorrectionRequest.findOne(
    byTenant(req, {
      employee: req.user._id,
      attendanceDate,
      status: 'pending',
    })
  ).lean();
  if (activeExisting) {
    const err = new Error('Pending correction already exists for this date');
    err.statusCode = 400;
    throw err;
  }

  const row = await AttendanceCorrectionRequest.create({
    tenantId: req.tenantId,
    employee: req.user._id,
    attendanceDate,
    requestedStatus,
    requestedCheckIn: String(req.body.requestedCheckIn || ''),
    requestedCheckOut: String(req.body.requestedCheckOut || ''),
    reason: String(req.body.reason || ''),
    status: 'pending',
  });
  await notifyHrApprovers(req, {
    title: 'Attendance correction needs approval',
    description: `${req.user.name || req.user.employeeId} requested correction for ${attendanceDate.toISOString().slice(0, 10)}.`,
    type: 'warning',
  });
  res.status(201).json({ success: true, data: row });
});
