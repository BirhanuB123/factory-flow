const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let generateToken;

describe('Employee self service attendance + leave', () => {
  jest.setTimeout(120000);

  let tenantId;
  let empId;
  let hrId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    generateToken = require('../../utils/generateToken');
  });

  afterAll(async () => {
    if (mongoose && mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    const cols = await mongoose.connection.db.listCollections().toArray();
    for (const c of cols) await mongoose.connection.collection(c.name).deleteMany({});

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const t = await Tenant.create({
      key: `self-${suffix}`,
      legalName: 'Self Tenant',
      displayName: 'Self Tenant',
      status: 'active',
    });
    tenantId = t._id;

    const emp = await Employee.create({
      tenantId,
      employeeId: `EMP-${suffix}`,
      name: 'Self Employee',
      role: 'employee',
      jobTitle: 'Operator',
      department: 'Production',
      status: 'Active',
      email: `emp-${suffix}@test.local`,
      password: 'testpass123',
    });
    empId = emp._id;

    const hr = await Employee.create({
      tenantId,
      employeeId: `HR-${suffix}`,
      name: 'HR Reviewer',
      role: 'hr_head',
      jobTitle: 'HR Head',
      department: 'HR',
      status: 'Active',
      email: `hr-${suffix}@test.local`,
      password: 'testpass123',
    });
    hrId = hr._id;
  });

  function authEmployee() {
    return `Bearer ${generateToken({ id: empId, tenantId, platformRole: 'none' })}`;
  }

  function authHr() {
    return `Bearer ${generateToken({ id: hrId, tenantId, platformRole: 'none' })}`;
  }

  test('employee can check-in/out, manage pending leave, and submit correction request', async () => {
    const inRes = await request(app)
      .post('/api/employee/attendance/check-in')
      .set('Authorization', authEmployee())
      .send({});
    expect(inRes.status).toBe(201);

    const outRes = await request(app)
      .post('/api/employee/attendance/check-out')
      .set('Authorization', authEmployee())
      .send({});
    expect(outRes.status).toBe(200);
    expect((outRes.body.data?.workMinutes || 0) >= 0).toBe(true);

    const leaveRes = await request(app)
      .post('/api/employee/leaves')
      .set('Authorization', authEmployee())
      .send({
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        reason: 'family',
      });
    expect(leaveRes.status).toBe(201);
    expect(leaveRes.body.data.status).toBe('pending');

    const hrNotifsAfterLeave = await request(app)
      .get('/api/notifications')
      .set('Authorization', authHr());
    expect(hrNotifsAfterLeave.status).toBe(200);
    expect((hrNotifsAfterLeave.body.data || []).some((n) => /Leave request needs approval/i.test(String(n.title || '')))).toBe(true);

    const leaveEditRes = await request(app)
      .put(`/api/employee/leaves/${leaveRes.body.data._id}`)
      .set('Authorization', authEmployee())
      .send({
        startDate: '2026-06-03',
        endDate: '2026-06-04',
        reason: 'family update',
      });
    expect(leaveEditRes.status).toBe(200);
    expect(String(leaveEditRes.body.data.reason || '')).toMatch(/family update/i);

    const listRes = await request(app)
      .get('/api/employee/leaves')
      .set('Authorization', authEmployee());
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBe(1);

    const cancelLeave = await request(app)
      .delete(`/api/employee/leaves/${leaveRes.body.data._id}`)
      .set('Authorization', authEmployee());
    expect(cancelLeave.status).toBe(200);
    expect(cancelLeave.body.data.status).toBe('cancelled');

    const manualRes = await request(app)
      .post('/api/employee/attendance')
      .set('Authorization', authEmployee())
      .send({
        date: '2026-03-01',
        status: 'Present',
        checkIn: '08:00',
        checkOut: '17:15',
        notes: 'manual entry',
      });
    expect(manualRes.status).toBe(201);
    expect((manualRes.body.data?.workMinutes || 0) > 0).toBe(true);

    const corrRes = await request(app)
      .post('/api/employee/attendance-corrections')
      .set('Authorization', authEmployee())
      .send({
        attendanceDate: '2026-03-01',
        requestedStatus: 'Late',
        requestedCheckIn: '08:45',
        requestedCheckOut: '17:15',
        reason: 'traffic',
      });
    expect(corrRes.status).toBe(201);
    expect(corrRes.body.data.status).toBe('pending');

    const hrNotifsAfterCorrection = await request(app)
      .get('/api/notifications')
      .set('Authorization', authHr());
    expect(hrNotifsAfterCorrection.status).toBe(200);
    expect((hrNotifsAfterCorrection.body.data || []).some((n) => /Attendance correction needs approval/i.test(String(n.title || '')))).toBe(true);
  });
});
