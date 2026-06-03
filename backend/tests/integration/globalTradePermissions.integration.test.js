/**
 * Verifies Global Trade read/manage permissions through the mounted API routes.
 *
 *   npm test -- tests/integration/globalTradePermissions.integration.test.js
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let TradeShipment;
let Vendor;
let VendorBill;
let generateToken;

describe('Global Trade permissions', () => {
  jest.setTimeout(120000);

  let tenantId;
  let viewerId;
  let managerId;
  let shipmentId;
  let vendorId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    TradeShipment = require('../../models/TradeShipment');
    Vendor = require('../../models/Vendor');
    VendorBill = require('../../models/VendorBill');
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
      key: `gtp-${suffix}`,
      legalName: 'Global Trade Permission Tenant',
      displayName: 'Global Trade Permissions',
      status: 'active',
    });
    tenantId = tenant._id;

    const [viewer, manager] = await Employee.create([
      {
        tenantId,
        platformRole: 'none',
        employeeId: `GTP-VIEW-${suffix}`,
        name: 'Global Trade Viewer',
        role: 'finance_viewer',
        jobTitle: '',
        department: 'Finance',
        status: 'Active',
        email: `gt-viewer-${suffix}@test.local`,
        password: 'testpass123',
      },
      {
        tenantId,
        platformRole: 'none',
        employeeId: `GTP-MGR-${suffix}`,
        name: 'Global Trade Manager',
        role: 'warehouse_head',
        jobTitle: '',
        department: 'Warehouse',
        status: 'Active',
        email: `gt-manager-${suffix}@test.local`,
        password: 'testpass123',
      },
    ]);
    viewerId = viewer._id;
    managerId = manager._id;

    const shipment = await TradeShipment.create({
      tenantId,
      tradeType: 'import',
      status: 'pre_shipment',
      referenceNumber: `BL-${suffix}`,
      vesselOrFlight: 'MV Test',
      portOfLoading: 'Djibouti',
      portOfDischarge: 'Modjo',
    });
    shipmentId = shipment._id;

    const vendor = await Vendor.create({
      tenantId,
      code: `CLR-${suffix.slice(-8)}`,
      name: 'Clearing Agent',
      paymentTermsDays: 15,
    });
    vendorId = vendor._id;
  });

  function authFor(userId) {
    return `Bearer ${generateToken({
      id: userId,
      tenantId,
      platformRole: 'none',
    })}`;
  }

  function newShipmentPayload(suffix = Date.now()) {
    return {
      tradeType: 'export',
      status: 'in_transit',
      referenceNumber: `AWB-${suffix}`,
      vesselOrFlight: 'ET Test',
      portOfLoading: 'Addis Ababa',
      portOfDischarge: 'Nairobi',
      incoterm: 'FOB',
    };
  }

  test('viewer can list and open Global Trade shipments', async () => {
    const listRes = await request(app)
      .get('/api/trade')
      .set('Authorization', authFor(viewerId));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].referenceNumber).toMatch(/^BL-/);

    const detailRes = await request(app)
      .get(`/api/trade/${shipmentId}`)
      .set('Authorization', authFor(viewerId));

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.referenceNumber).toMatch(/^BL-/);
  });

  test('viewer cannot create, update, delete, or log expenses', async () => {
    const auth = authFor(viewerId);

    const createRes = await request(app)
      .post('/api/trade')
      .set('Authorization', auth)
      .send(newShipmentPayload('viewer-create'));

    const updateRes = await request(app)
      .put(`/api/trade/${shipmentId}`)
      .set('Authorization', auth)
      .send({ notes: 'viewer update should fail' });

    const expenseRes = await request(app)
      .post(`/api/trade/${shipmentId}/expenses`)
      .set('Authorization', auth)
      .send({
        expenseType: 'clearing',
        amount: 100,
        vendorId,
      });

    const deleteRes = await request(app)
      .delete(`/api/trade/${shipmentId}`)
      .set('Authorization', auth);

    for (const res of [createRes, updateRes, expenseRes, deleteRes]) {
      expect(res.status).toBe(403);
      expect(String(res.body.message || '')).toMatch(/shipments:manage/i);
    }

    expect(await TradeShipment.countDocuments({ tenantId })).toBe(1);
    expect(await VendorBill.countDocuments({ tenantId })).toBe(0);
  });

  test('manager can create, update, log expenses, and delete Global Trade shipments', async () => {
    const auth = authFor(managerId);

    const createRes = await request(app)
      .post('/api/trade')
      .set('Authorization', auth)
      .send(newShipmentPayload('manager-create'));

    expect(createRes.status).toBe(201);
    expect(createRes.body.referenceNumber).toBe('AWB-manager-create');

    const createdId = createRes.body._id;
    const updateRes = await request(app)
      .put(`/api/trade/${createdId}`)
      .set('Authorization', auth)
      .send({ notes: 'manager update succeeded', customsStatus: 'submitted' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.notes).toBe('manager update succeeded');
    expect(updateRes.body.customsStatus).toBe('submitted');

    const expenseRes = await request(app)
      .post(`/api/trade/${createdId}/expenses`)
      .set('Authorization', auth)
      .send({
        expenseType: 'clearing',
        amount: 275,
        vendorId,
        billNumber: 'VB-GTP-001',
      });

    expect(expenseRes.status).toBe(201);
    expect(expenseRes.body.vendorBill.billNumber).toBe('VB-GTP-001');
    expect(expenseRes.body.shipment.expenses).toHaveLength(1);

    const deleteRes = await request(app)
      .delete(`/api/trade/${createdId}`)
      .set('Authorization', auth);

    expect(deleteRes.status).toBe(200);
    expect(await TradeShipment.exists({ _id: createdId, tenantId })).toBeNull();
    expect(await VendorBill.countDocuments({ tenantId, billNumber: 'VB-GTP-001' })).toBe(1);
  });
});
