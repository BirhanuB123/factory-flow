/**
 * Integration tests: manual stock movement + production completion (BOM consume / FG output).
 * Requires MongoDB: set MONGODB_TEST_URI or default mongodb://127.0.0.1:27017/factory_flow_test
 */
const request = require('supertest');
const mongoose = require('mongoose');

const TEST_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/factory_flow_test';

describe('Stock ledger & production completion', () => {
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = '01234567890123456789012345678901';
    process.env.MONGODB_URI = TEST_URI;
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 8000 });
    await mongoose.connection.dropDatabase();

    jest.unmock('../app');
    app = require('../app');

    const Employee = require('../models/Employee');
    await Employee.create({
      employeeId: 'JEST-ADMIN',
      name: 'Jest Admin',
      role: 'Admin',
      department: 'QA',
      password: 'jest-pass-99',
      email: 'jest-admin@factory-flow.test',
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  async function authHeader() {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jest-admin@factory-flow.test', password: 'jest-pass-99' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    return { Authorization: `Bearer ${res.body.token}` };
  }

  it('POST manual receipt increases product stock and creates ledger row', async () => {
    const h = await authHeader();
    const create = await request(app)
      .post('/api/products')
      .set(h)
      .send({
        name: 'Ledger Widget',
        sku: `LW-${Date.now()}`,
        price: 9.99,
        stock: 0,
      });
    expect(create.status).toBe(201);
    const pid = create.body.data._id;

    const mov = await request(app)
      .post('/api/inventory/movements')
      .set(h)
      .send({ productId: pid, kind: 'receipt', quantity: 7, note: 'jest receipt' });
    expect(mov.status).toBe(201);
    expect(mov.body.data.delta).toBe(7);

    const prod = await request(app).get(`/api/products/${pid}`).set(h);
    expect(prod.status).toBe(200);
    expect(prod.body.data.stock).toBe(7);
  });

  it('completing a job consumes BOM components and adds finished goods', async () => {
    const h = await authHeader();
    const ts = Date.now();

    const raw = await request(app)
      .post('/api/products')
      .set(h)
      .send({
        name: 'Raw mat',
        sku: `RAW-${ts}`,
        price: 1,
        stock: 100,
      });
    const fg = await request(app)
      .post('/api/products')
      .set(h)
      .send({
        name: 'Finished',
        sku: `FG-${ts}`,
        price: 50,
        stock: 0,
      });
    expect(raw.status).toBe(201);
    expect(fg.status).toBe(201);
    const rawId = raw.body.data._id;
    const fgId = fg.body.data._id;

    const bom = await request(app)
      .post('/api/boms')
      .set(h)
      .send({
        name: 'Test BOM',
        partNumber: `PN-${ts}`,
        status: 'Active',
        outputProduct: fgId,
        components: [{ product: rawId, quantity: 2 }],
      });
    expect(bom.status).toBe(201);
    const bomId = bom.body.data._id;

    const job = await request(app)
      .post('/api/production')
      .set(h)
      .send({
        jobId: `JOB-${ts}`,
        bom: bomId,
        quantity: 5,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        status: 'In Progress',
      });
    expect(job.status).toBe(201);
    const jobId = job.body.data._id;

    const complete = await request(app)
      .put(`/api/production/${jobId}`)
      .set(h)
      .send({ status: 'Completed' });
    expect(complete.status).toBe(200);
    expect(complete.body.data.inventoryPosted).toBe(true);

    const rawAfter = await request(app).get(`/api/products/${rawId}`).set(h);
    const fgAfter = await request(app).get(`/api/products/${fgId}`).set(h);
    expect(rawAfter.body.data.stock).toBe(90);
    expect(fgAfter.body.data.stock).toBe(5);
  });
});
