const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let generateToken;

describe('Employee Invitation Flow', () => {
  jest.setTimeout(120000);

  let tenantId;
  let adminId;

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
      key: `org-${suffix}`,
      legalName: 'Org Tenant',
      displayName: 'Org Tenant',
      status: 'active',
    });
    tenantId = t._id;

    const admin = await Employee.create({
      tenantId,
      employeeId: `ADM-${suffix}`,
      name: 'Admin User',
      role: 'Admin',
      jobTitle: 'Admin',
      department: 'Admin',
      status: 'Active',
      email: `adm-${suffix}@test.local`,
      password: 'testpass123',
    });
    adminId = admin._id;
  });

  function authAdmin() {
    return `Bearer ${generateToken({ id: adminId, tenantId, platformRole: 'none' })}`;
  }

  test('can create employee, generate invite token, complete registration, and login', async () => {
    // 1. Create a new employee
    const createRes = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', authAdmin())
      .send({
        employeeId: 'EMP-INV1',
        name: 'Jane Doe',
        role: 'finance_head',
        department: 'Finance',
        status: 'Active',
        password: 'temporaryPassword123',
        email: 'jane@test.local',
        salary: 50000,
      });
    expect(createRes.status).toBe(201);
    const empId = createRes.body._id;

    // 2. Generate invite link / token
    const inviteRes = await request(app)
      .post(`/api/hr/employees/${empId}/invite`)
      .set('Authorization', authAdmin());
    expect(inviteRes.status).toBe(200);
    expect(inviteRes.body.success).toBe(true);
    expect(inviteRes.body.inviteUrl).toContain('/invite?token=');

    // Parse the token out of the URL
    const url = new URL(inviteRes.body.inviteUrl);
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();

    // 3. Complete invite / set new password
    const completeRes = await request(app)
      .post('/api/auth/complete-invite')
      .send({
        token,
        newPassword: 'myBrandNewPassword123!',
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);

    // 4. Try logging in with the new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane@test.local',
        password: 'myBrandNewPassword123!',
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.role).toBe('finance_head');
  });
});
