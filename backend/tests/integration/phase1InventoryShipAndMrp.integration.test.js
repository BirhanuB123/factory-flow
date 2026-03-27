/**
 * Phase 1: shipment posts stock issue; MRP suggestions are tenant-scoped.
 *
 *   npm test -- tests/integration/phase1InventoryShipAndMrp.integration.test.js
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let app;
let Tenant;
let Employee;
let Product;
let Client;
let Order;
let Shipment;
let BOM;
let generateToken;

describe('Phase 1 — ship stock + MRP tenant scope', () => {
  jest.setTimeout(120000);

  let tenantAId;
  let tenantBId;
  let userAId;
  let productSellAId;
  let productSellBId;
  let productRmAId;
  let productRmBId;
  let clientAId;

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
    Client = require('../../models/Client');
    Order = require('../../models/Order');
    Shipment = require('../../models/Shipment');
    BOM = require('../../models/BOM');
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
    const [ta, tb] = await Tenant.create([
      {
        key: `p1-a-${suffix}`,
        legalName: 'Tenant A',
        displayName: 'A',
        status: 'active',
      },
      {
        key: `p1-b-${suffix}`,
        legalName: 'Tenant B',
        displayName: 'B',
        status: 'active',
      },
    ]);
    tenantAId = ta._id;
    tenantBId = tb._id;

    const [userA] = await Employee.create([
      {
        tenantId: tenantAId,
        platformRole: 'none',
        employeeId: 'P1-A-001',
        name: 'User A',
        role: 'Admin',
        jobTitle: '',
        department: 'Ops',
        status: 'Active',
        email: `p1a-${suffix}@test.local`,
        password: 'testpass123',
      },
    ]);
    userAId = userA._id;

    const [rmA, fgA, rmB, fgB] = await Product.create([
      {
        tenantId: tenantAId,
        name: 'RM A',
        sku: `RM-A-${suffix}`,
        price: 1,
        stock: 100,
      },
      {
        tenantId: tenantAId,
        name: 'FG A',
        sku: `FG-A-${suffix}`,
        price: 50,
        stock: 20,
      },
      {
        tenantId: tenantBId,
        name: 'RM B',
        sku: `RM-B-${suffix}`,
        price: 1,
        stock: 100,
      },
      {
        tenantId: tenantBId,
        name: 'FG B',
        sku: `FG-B-${suffix}`,
        price: 50,
        stock: 15,
      },
    ]);
    productRmAId = rmA._id;
    productSellAId = fgA._id;
    productRmBId = rmB._id;
    productSellBId = fgB._id;

    await BOM.create([
      {
        tenantId: tenantAId,
        name: 'BOM A',
        partNumber: `BOM-A-${suffix}`,
        status: 'Active',
        outputProduct: productSellAId,
        components: [{ product: productRmAId, quantity: 1 }],
      },
      {
        tenantId: tenantBId,
        name: 'BOM B',
        partNumber: `BOM-B-${suffix}`,
        status: 'Active',
        outputProduct: productSellBId,
        components: [{ product: productRmBId, quantity: 1 }],
      },
    ]);

    const [cl] = await Client.create([
      {
        tenantId: tenantAId,
        name: 'Client A',
      },
    ]);
    clientAId = cl._id;
  });

  function authA() {
    return `Bearer ${generateToken({
      id: userAId,
      tenantId: tenantAId,
      platformRole: 'none',
    })}`;
  }

  test('shipShipment decrements product stock and records issue movement', async () => {
    const StockMovement = require('../../models/StockMovement');

    const order = await Order.create({
      tenantId: tenantAId,
      client: clientAId,
      items: [
        {
          product: productSellAId,
          quantity: 5,
          price: 50,
          shippedQty: 0,
        },
      ],
      totalAmount: 250,
      approvalStatus: 'none',
      status: 'pending',
    });

    const ship = await Shipment.create({
      tenantId: tenantAId,
      shipmentNumber: `SH-P1-${Date.now()}`,
      order: order._id,
      lines: [{ lineIndex: 0, quantity: 2 }],
      status: 'draft',
    });

    const res = await request(app)
      .post(`/api/shipments/${ship._id}/ship`)
      .set('Authorization', authA())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const p = await Product.findById(productSellAId).lean();
    expect(p.stock).toBe(18);

    const moves = await StockMovement.find({
      tenantId: tenantAId,
      product: productSellAId,
      movementType: 'issue',
      referenceType: 'Shipment',
      referenceId: ship._id,
    }).lean();
    expect(moves.length).toBe(1);
    expect(moves[0].delta).toBe(-2);

    const ord = await Order.findById(order._id).lean();
    expect(ord.items[0].shippedQty).toBe(2);
  });

  test('MRP suggestions only include orders for current tenant', async () => {
    const orderB = await Order.create({
      tenantId: tenantBId,
      client: (await Client.create({ tenantId: tenantBId, name: 'Client B' }))._id,
      items: [
        {
          product: productSellBId,
          quantity: 10,
          price: 50,
          shippedQty: 0,
        },
      ],
      totalAmount: 500,
      approvalStatus: 'none',
      status: 'pending',
    });

    await Order.create({
      tenantId: tenantAId,
      client: clientAId,
      items: [
        {
          product: productSellAId,
          quantity: 4,
          price: 50,
          shippedQty: 0,
        },
      ],
      totalAmount: 200,
      approvalStatus: 'none',
      status: 'processing',
    });

    const res = await request(app)
      .get('/api/mrp/suggestions')
      .set('Authorization', authA());

    expect(res.status).toBe(200);
    const rows = res.body.data || [];
    const orderIds = [...new Set(rows.map((r) => String(r.orderId)))];
    expect(orderIds.length).toBeGreaterThan(0);
    expect(orderIds.every((id) => id !== String(orderB._id))).toBe(true);
  });
});
