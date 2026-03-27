const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let BOM;
let Product;
let ProductionJob;
let generateToken;

describe('Production foundation gaps APIs', () => {
  jest.setTimeout(120000);
  let tenantId;
  let adminId;
  let rmId;
  let fgId;
  let jobId;

  beforeAll(async () => {
    jest.resetModules();
    mongoose = require('mongoose');
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    BOM = require('../../models/BOM');
    Product = require('../../models/Product');
    ProductionJob = require('../../models/ProductionJob');
    generateToken = require('../../utils/generateToken');
  });

  afterAll(async () => {
    if (mongoose && mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    const cols = await mongoose.connection.db.listCollections().toArray();
    for (const c of cols) await mongoose.connection.collection(c.name).deleteMany({});
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const t = await Tenant.create({
      key: `prod-gap-${suffix}`,
      legalName: 'Prod Tenant',
      displayName: 'Prod Tenant',
      status: 'active',
    });
    tenantId = t._id;
    const admin = await Employee.create({
      tenantId,
      employeeId: `ADM-${suffix}`,
      name: 'Prod Admin',
      role: 'Admin',
      jobTitle: 'Manager',
      department: 'Production',
      status: 'Active',
      email: `prod-admin-${suffix}@test.local`,
      password: 'testpass123',
    });
    adminId = admin._id;
    const [rm, fg] = await Product.create([
      { tenantId, name: 'Steel', sku: `RM-${suffix}`, stock: 100, price: 2 },
      { tenantId, name: 'Widget', sku: `FG-${suffix}`, stock: 5, price: 20 },
    ]);
    rmId = rm._id;
    fgId = fg._id;
    const bom = await BOM.create({
      tenantId,
      name: 'Widget BOM',
      partNumber: `BOM-${suffix}`,
      status: 'Active',
      outputProduct: fgId,
      components: [{ product: rmId, quantity: 2 }],
      routing: [{ sequence: 10, code: 'CUT', name: 'Cutting', workCenterCode: 'WC-CUT' }],
    });
    const job = await ProductionJob.create({
      tenantId,
      jobId: `JOB-${suffix}`,
      bom: bom._id,
      quantity: 10,
      status: 'In Progress',
      dueDate: new Date(Date.now() + 2 * 86400000),
      operations: [
        {
          sequence: 10,
          code: 'CUT',
          name: 'Cutting',
          workCenterCode: 'WC-CUT',
          status: 'active',
          qualityRequired: true,
          qualityStatus: 'pending',
        },
      ],
    });
    jobId = job._id;
  });

  function auth() {
    return `Bearer ${generateToken({ id: adminId, tenantId, platformRole: 'none' })}`;
  }

  test('supports material issue/return, operation WIP + quality gates, and KPI/capacity endpoints', async () => {
    const issueRes = await request(app)
      .post(`/api/production/${jobId}/materials/issue`)
      .set('Authorization', auth())
      .send({ productId: rmId, quantity: 3, operationIndex: 0, note: 'line feed' });
    expect(issueRes.status).toBe(201);

    const returnRes = await request(app)
      .post(`/api/production/${jobId}/materials/return`)
      .set('Authorization', auth())
      .send({ productId: rmId, quantity: 1, operationIndex: 0, note: 'unused' });
    expect(returnRes.status).toBe(201);

    const wipRes = await request(app)
      .post(`/api/production/${jobId}/operations/0/wip`)
      .set('Authorization', auth())
      .send({ wipInQty: 10, wipOutQty: 9 });
    expect(wipRes.status).toBe(200);

    const blockedComplete = await request(app)
      .post(`/api/production/${jobId}/operations/0/complete`)
      .set('Authorization', auth())
      .send({});
    expect(blockedComplete.status).toBe(400);

    const qaRes = await request(app)
      .post(`/api/production/${jobId}/operations/0/quality`)
      .set('Authorization', auth())
      .send({ status: 'pass' });
    expect(qaRes.status).toBe(200);

    const completeRes = await request(app)
      .post(`/api/production/${jobId}/operations/0/complete`)
      .set('Authorization', auth())
      .send({});
    expect(completeRes.status).toBe(200);

    const costRes = await request(app)
      .patch(`/api/production/${jobId}/costing`)
      .set('Authorization', auth())
      .send({ plannedLaborCost: 100, actualLaborCost: 120, plannedOverheadCost: 20, actualOverheadCost: 25 });
    expect(costRes.status).toBe(200);
    expect(costRes.body.data.costSummary.variance).toBeGreaterThanOrEqual(0);

    const capRes = await request(app)
      .get('/api/production/capacity/plan')
      .set('Authorization', auth());
    expect(capRes.status).toBe(200);
    expect(Array.isArray(capRes.body.data)).toBe(true);

    const kpiRes = await request(app)
      .get('/api/production/kpis')
      .set('Authorization', auth());
    expect(kpiRes.status).toBe(200);
    expect(typeof kpiRes.body.data.throughputQty).toBe('number');
  });
});
