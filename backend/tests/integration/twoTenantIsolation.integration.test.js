/**
 * End-to-end tenant isolation against a real MongoDB (in-memory).
 *
 * Run alone (recommended — avoids mocked model cache from other test files):
 *   npm run test:integration
 *
 * Or: npm test -- tests/integration/twoTenantIsolation.integration.test.js
 *
 * Requires: mongodb-memory-server (devDependency). First run may download MongoDB binaries.
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let Product;
let generateToken;

describe('Two-tenant integration (MongoMemoryServer)', () => {
  jest.setTimeout(120000);

  let tenantAId;
  let tenantBId;
  let userAId;
  let productAId;
  let productBId;
  let superAdminId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    Product = require('../../models/Product');
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

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tenantAKey = `int-a-${suffix}`;
    const tenantBKey = `int-b-${suffix}`;

    const [ta, tb] = await Tenant.create([
      {
        key: tenantAKey,
        legalName: 'Tenant A Inc',
        displayName: 'Tenant A',
        status: 'active',
      },
      {
        key: tenantBKey,
        legalName: 'Tenant B Inc',
        displayName: 'Tenant B',
        status: 'active',
      },
    ]);
    tenantAId = ta._id;
    tenantBId = tb._id;

    const [userA, superUser] = await Employee.create([
      {
        tenantId: tenantAId,
        platformRole: 'none',
        employeeId: 'INT-A-001',
        name: 'User A',
        role: 'Admin',
        jobTitle: '',
        department: 'Ops',
        status: 'Active',
        email: 'usera-int@test.local',
        password: 'testpass123',
      },
      {
        tenantId: tenantAId,
        platformRole: 'super_admin',
        employeeId: 'SA-INT-001',
        name: 'Super Admin',
        role: 'Admin',
        jobTitle: '',
        department: 'Platform',
        status: 'Active',
        email: 'sa-int@test.local',
        password: 'testpass123',
      },
    ]);
    userAId = userA._id;
    superAdminId = superUser._id;

    await Employee.create({
      tenantId: tenantBId,
      platformRole: 'none',
      employeeId: 'INT-B-001',
      name: 'User B',
      role: 'Admin',
      jobTitle: '',
      department: 'Ops',
      status: 'Active',
      email: 'userb-int@test.local',
      password: 'testpass123',
    });

    const [pa, pb] = await Product.create([
      {
        tenantId: tenantAId,
        name: 'Product A',
        sku: 'SKU-A-INT',
        price: 10,
        stock: 0,
      },
      {
        tenantId: tenantBId,
        name: 'Product B',
        sku: 'SKU-B-INT',
        price: 20,
        stock: 0,
      },
    ]);
    productAId = pa._id;
    productBId = pb._id;
  });

  function authA() {
    return `Bearer ${generateToken({
      id: userAId,
      tenantId: tenantAId,
      platformRole: 'none',
    })}`;
  }

  function authSuper() {
    return `Bearer ${generateToken({
      id: superAdminId,
      tenantId: tenantAId,
      platformRole: 'super_admin',
    })}`;
  }

  test('tenant A cannot read tenant B product by id (404)', async () => {
    const res = await request(app)
      .get(`/api/products/${productBId}`)
      .set('Authorization', authA());

    expect(res.status).toBe(404);
  });

  test('tenant A can read own product (200)', async () => {
    const res = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', authA());

    expect(res.status).toBe(200);
    expect(res.body.data.sku).toBe('SKU-A-INT');
  });

  test('super admin with x-tenant-id can read tenant B product', async () => {
    const res = await request(app)
      .get(`/api/products/${productBId}`)
      .set('Authorization', authSuper())
      .set('x-tenant-id', String(tenantBId));

    expect(res.status).toBe(200);
    expect(res.body.data.sku).toBe('SKU-B-INT');
  });

  test('normal tenant user with mismatched x-tenant-id is rejected (403)', async () => {
    const res = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', authA())
      .set('x-tenant-id', String(tenantBId));

    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/tenant mismatch/i);
  });

  test('super admin can use tenant API when home tenant is suspended', async () => {
    await Tenant.updateOne({ _id: tenantAId }, { $set: { status: 'suspended', statusReason: 'Test' } });

    const res = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', authSuper());

    expect(res.status).toBe(200);
    expect(res.body.data.sku).toBe('SKU-A-INT');
  });

  test('suspended tenant blocks API for normal user (403)', async () => {
    await Tenant.updateOne({ _id: tenantAId }, { $set: { status: 'suspended' } });

    const res = await request(app)
      .get(`/api/products/${productAId}`)
      .set('Authorization', authA());

    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/suspended/i);
  });

  test('suspended tenant blocks login for normal user (403)', async () => {
    await Tenant.updateOne(
      { _id: tenantAId },
      { $set: { status: 'suspended', statusReason: 'Trial expired' } }
    );

    const res = await request(app).post('/api/auth/login').send({
      employeeId: 'INT-A-001',
      password: 'testpass123',
    });

    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/suspended/i);
  });
});
