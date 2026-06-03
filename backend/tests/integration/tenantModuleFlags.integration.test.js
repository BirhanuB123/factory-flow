/**
 * Verifies disabled tenant modules are hard-blocked at the API layer.
 *
 *   npm test -- tests/integration/tenantModuleFlags.integration.test.js
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let generateToken;

describe('Tenant module flags', () => {
  jest.setTimeout(120000);

  let tenantId;
  let userId;

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
    const tenant = await Tenant.create({
      key: `modules-${suffix}`,
      legalName: 'Module Flag Test Tenant',
      displayName: 'Module Flags',
      status: 'active',
    });
    tenantId = tenant._id;

    const user = await Employee.create({
      tenantId,
      platformRole: 'none',
      employeeId: `MOD-${suffix}`,
      name: 'Module Test Admin',
      role: 'Admin',
      jobTitle: '',
      department: 'Ops',
      status: 'Active',
      email: `module-${suffix}@test.local`,
      password: 'testpass123',
    });
    userId = user._id;
  });

  function auth() {
    return `Bearer ${generateToken({
      id: userId,
      tenantId,
      platformRole: 'none',
    })}`;
  }

  async function disableModule(moduleKey) {
    await Tenant.updateOne({ _id: tenantId }, { $set: { [`moduleFlags.${moduleKey}`]: false } });
  }

  test.each([
    ['manufacturing', '/api/production'],
    ['inventory', '/api/products'],
    ['sales', '/api/orders'],
    ['sales', '/api/clients'],
    ['crm', '/api/crm/leads'],
    ['procurement', '/api/purchase-orders'],
    ['finance', '/api/finance/transactions'],
    ['hr', '/api/hr/employees'],
    ['pos', '/api/pos/session/active'],
    ['global_trade', '/api/shipments'],
    ['global_trade', '/api/trade'],
    ['analytics', '/api/analytics/oee'],
    ['analytics', '/api/reports/summary'],
  ])('returns 403 when %s module is disabled for GET %s', async (moduleKey, path) => {
    await disableModule(moduleKey);

    const res = await request(app).get(path).set('Authorization', auth());

    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toContain(moduleKey);
    expect(String(res.body.message || '')).toMatch(/module is disabled/i);
  });
});
