const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let PlatformAuditLog;
let generateToken;
let originalFetch;

describe('Chapa verify integration (MongoMemoryServer)', () => {
  jest.setTimeout(120000);

  let tenantId;
  let userId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');
    originalFetch = global.fetch;

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST_FAKE';

    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    PlatformAuditLog = require('../../models/PlatformAuditLog');
    generateToken = require('../../utils/generateToken');
  });

  afterAll(async () => {
    global.fetch = originalFetch;
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

    const tenant = await Tenant.create({
      key: `chapa-tenant-${Date.now()}`,
      legalName: 'Chapa Tenant PLC',
      displayName: 'Chapa Tenant',
      status: 'trial',
      plan: 'starter',
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    tenantId = tenant._id;

    const user = await Employee.create({
      tenantId,
      platformRole: 'none',
      employeeId: `CHAPA-${Date.now()}`,
      name: 'Tenant Admin',
      role: 'Admin',
      department: 'Operations',
      status: 'Active',
      email: 'tenant-admin@test.local',
      password: 'testpass123',
    });
    userId = user._id;
  });

  function authHeader() {
    return `Bearer ${generateToken({ id: userId, tenantId, platformRole: 'none' })}`;
  }

  test('verifies Chapa transaction and activates tenant subscription', async () => {
    const txRef = `ff_${String(tenantId)}_${Date.now()}_abc12345`;

    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toContain(`/transaction/verify/${encodeURIComponent(txRef)}`);
      return {
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            id: 'chapa_tx_001',
            status: 'success',
            amount: '1499.00',
            currency: 'ETB',
            customer: { email: 'billing@test.local' },
            meta: { tenantId: String(tenantId), plan: 'pro' },
          },
        }),
      };
    });

    const res = await request(app)
      .get(`/api/billing/chapa/verify/${txRef}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.billingProvider).toBe('chapa');
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.plan).toBe('pro');

    const updated = await Tenant.findById(tenantId).lean();
    expect(updated.status).toBe('active');
    expect(updated.statusReason).toBe('');
    expect(updated.billingProvider).toBe('chapa');
    expect(updated.billingCustomerId).toBe('chapa_tx_001');
    expect(updated.plan).toBe('pro');

    const audit = await PlatformAuditLog.findOne({
      action: 'tenant.billing.chapa_payment',
      resourceId: String(tenantId),
    }).lean();
    expect(audit).toBeTruthy();
    expect(audit.details?.txRef).toBe(txRef);
  });
});
