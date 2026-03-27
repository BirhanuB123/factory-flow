const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let Notification;
let generateToken;

describe('HR leave and attendance phase', () => {
  jest.setTimeout(120000);

  let tenantId;
  let adminId;
  let staffId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    Notification = require('../../models/Notification');
    generateToken = require('../../utils/generateToken');
  });

  afterAll(async () => {
    if (mongoose && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    const cols = await mongoose.connection.db.listCollections().toArray();
    for (const c of cols) {
      await mongoose.connection.collection(c.name).deleteMany({});
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const t = await Tenant.create({
      key: `hr-${suffix}`,
      legalName: 'HR Tenant',
      displayName: 'HR Tenant',
      status: 'active',
    });
    tenantId = t._id;

    const [admin, staff] = await Employee.create([
      {
        tenantId,
        employeeId: `ADM-${suffix}`,
        name: 'Admin HR',
        role: 'Admin',
        jobTitle: 'HR Admin',
        department: 'HR',
        status: 'Active',
        email: `adm-${suffix}@test.local`,
        password: 'testpass123',
      },
      {
        tenantId,
        employeeId: `EMP-${suffix}`,
        name: 'Staff One',
        role: 'employee',
        jobTitle: 'Operator',
        department: 'Production',
        status: 'Active',
        email: `emp-${suffix}@test.local`,
        password: 'testpass123',
      },
    ]);
    adminId = admin._id;
    staffId = staff._id;
  });

  function authAdmin() {
    return `Bearer ${generateToken({
      id: adminId,
      tenantId,
      platformRole: 'none',
    })}`;
  }

  function authEmployee() {
    return `Bearer ${generateToken({
      id: staffId,
      tenantId,
      platformRole: 'none',
    })}`;
  }

  test('leave request can be created, approved, and reflected in leave balance', async () => {
    const createRes = await request(app)
      .post('/api/hr/leaves')
      .set('Authorization', authAdmin())
      .send({
        employee: String(staffId),
        leaveType: 'annual',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        reason: 'Planned leave',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.days).toBe(3);

    const reviewRes = await request(app)
      .patch(`/api/hr/leaves/${createRes.body._id}/review`)
      .set('Authorization', authAdmin())
      .send({ status: 'approved', reviewNote: 'approved by hr' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe('approved');

    const notif = await Notification.findOne({ tenantId, userId: staffId }).lean();
    expect(notif).toBeTruthy();
    expect(String(notif.title || '').toLowerCase()).toMatch(/leave request approved/);

    const notifApi = await request(app)
      .get('/api/notifications')
      .set('Authorization', authEmployee());
    expect(notifApi.status).toBe(200);
    expect(Array.isArray(notifApi.body.data)).toBe(true);
    expect(notifApi.body.data.some((n) => n.userId && String(n.userId) === String(staffId))).toBe(
      true
    );

    const balRes = await request(app)
      .get(`/api/hr/leaves/balance/${staffId}?year=2026`)
      .set('Authorization', authAdmin());

    expect(balRes.status).toBe(200);
    expect(balRes.body.balances.annual.used).toBe(3);
    expect(balRes.body.balances.annual.remaining).toBe(18);
  });

  test('attendance blocks duplicate day and supports overtime review', async () => {
    const log1 = await request(app)
      .post('/api/hr/attendance')
      .set('Authorization', authAdmin())
      .send({
        employee: String(staffId),
        date: '2026-05-01',
        status: 'Present',
        checkIn: '08:10',
        checkOut: '18:20',
        notes: 'Long shift',
      });

    expect(log1.status).toBe(201);
    expect(log1.body.overtimeMinutes).toBe(130);
    expect(log1.body.overtimeApprovalStatus).toBe('pending');

    const dup = await request(app)
      .post('/api/hr/attendance')
      .set('Authorization', authAdmin())
      .send({
        employee: String(staffId),
        date: '2026-05-01',
        status: 'Present',
      });

    expect(dup.status).toBe(400);
    expect(String(dup.body.message || '')).toMatch(/already logged/i);

    const review = await request(app)
      .patch(`/api/hr/attendance/${log1.body._id}/overtime`)
      .set('Authorization', authAdmin())
      .send({ status: 'approved', note: 'Approved OT' });

    expect(review.status).toBe(200);
    expect(review.body.overtimeApprovalStatus).toBe('approved');
    expect(review.body.overtimeApprovedBy).toBeDefined();
  });

  test('HR can review attendance correction and apply attendance update', async () => {
    const corr = await request(app)
      .post('/api/employee/attendance-corrections')
      .set('Authorization', authEmployee())
      .send({
        attendanceDate: '2026-03-05',
        requestedStatus: 'Late',
        requestedCheckIn: '08:50',
        requestedCheckOut: '17:20',
        reason: 'traffic',
      });
    expect(corr.status).toBe(201);

    const review = await request(app)
      .patch(`/api/hr/attendance-corrections/${corr.body.data._id}/review`)
      .set('Authorization', authAdmin())
      .send({ status: 'approved', reviewNote: 'ok' });
    expect(review.status).toBe(200);
    expect(review.body.status).toBe('approved');

    const myAtt = await request(app)
      .get('/api/employee/attendance')
      .set('Authorization', authEmployee());
    expect(myAtt.status).toBe(200);
    expect(Array.isArray(myAtt.body)).toBe(true);
    const row = myAtt.body.find((r) => String(r.date).startsWith('2026-03-05'));
    expect(row).toBeTruthy();
    expect(row.status).toBe('Late');
    expect(row.checkIn).toBe('08:50');
  });
});
