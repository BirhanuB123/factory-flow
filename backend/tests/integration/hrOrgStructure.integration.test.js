const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let generateToken;

describe('HR org structure foundation', () => {
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

  test('can create department and position, then assign employee manager hierarchy', async () => {
    const depRes = await request(app)
      .post('/api/hr/departments')
      .set('Authorization', authAdmin())
      .send({ code: 'PROD', name: 'Production' });
    expect(depRes.status).toBe(201);

    const posLead = await request(app)
      .post('/api/hr/positions')
      .set('Authorization', authAdmin())
      .send({ code: 'LEAD', title: 'Team Lead', department: depRes.body._id });
    expect(posLead.status).toBe(201);

    const posOp = await request(app)
      .post('/api/hr/positions')
      .set('Authorization', authAdmin())
      .send({
        code: 'OP1',
        title: 'Operator I',
        department: depRes.body._id,
        reportsToPosition: posLead.body._id,
      });
    expect(posOp.status).toBe(201);

    const manager = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', authAdmin())
      .send({
        employeeId: 'EMP-MGR',
        name: 'Manager',
        role: 'Team Lead',
        department: 'Production',
        status: 'Active',
        password: 'factory123',
        email: 'manager@test.local',
        departmentId: depRes.body._id,
        positionId: posLead.body._id,
      });
    expect(manager.status).toBe(201);

    const worker = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', authAdmin())
      .send({
        employeeId: 'EMP-WRK',
        name: 'Worker',
        role: 'Operator I',
        department: 'Production',
        status: 'Active',
        password: 'factory123',
        email: 'worker@test.local',
        departmentId: depRes.body._id,
        positionId: posOp.body._id,
        manager: manager.body._id,
      });
    expect(worker.status).toBe(201);

    const list = await request(app).get('/api/hr/employees').set('Authorization', authAdmin());
    expect(list.status).toBe(200);
    const w = list.body.find((x) => x.employeeId === 'EMP-WRK');
    expect(w).toBeTruthy();
    expect(String(w.manager?._id || w.manager)).toBe(String(manager.body._id));
    expect(String(w.departmentId?._id || w.departmentId)).toBe(String(depRes.body._id));
    expect(String(w.positionId?._id || w.positionId)).toBe(String(posOp.body._id));
  });
});
