/**
 * Integration tests for Batch and Serial tracking.
 * 
 * Run: npm test -- tests/integration/batchSerialTracking.integration.test.js
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;
let app;
let Tenant;
let Employee;
let Product;
let StockMovement;
let PurchaseOrder;
let LotBalance;
let generateToken;

describe('Batch and Serial Tracking Integration', () => {
  jest.setTimeout(60000);

  let tenantId;
  let adminToken;
  let batchProductId;
  let serialProductId;
  let noneProductId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);

    app = require('../../app');
    Tenant = require('../../models/Tenant');
    Employee = require('../../models/Employee');
    Product = require('../../models/Product');
    StockMovement = require('../../models/StockMovement');
    PurchaseOrder = require('../../models/PurchaseOrder');
    LotBalance = require('../../models/LotBalance');
    generateToken = require('../../utils/generateToken');

    const tenant = await Tenant.create({
      key: 'test-tracking',
      legalName: 'Tracking Test Corp',
      displayName: 'Tracking Test',
    });
    tenantId = tenant._id;

    const admin = await Employee.create({
      tenantId,
      employeeId: 'EMP-001',
      name: 'Admin User',
      email: 'admin@tracking.test',
      password: 'password123',
      role: 'Admin',
      status: 'Active',
      department: 'Ops',
    });

    adminToken = `Bearer ${generateToken({
      id: admin._id,
      tenantId,
    })}`;

    const p1 = await Product.create({
      tenantId,
      name: 'Batch Tracked Item',
      sku: 'BATCH-001',
      trackingMethod: 'batch',
      stock: 0,
      price: 10,
    });
    batchProductId = p1._id;

    const p2 = await Product.create({
      tenantId,
      name: 'Serial Tracked Item',
      sku: 'SERIAL-001',
      trackingMethod: 'serial',
      stock: 0,
      price: 100,
    });
    serialProductId = p2._id;

    const p3 = await Product.create({
      tenantId,
      name: 'Non Tracked Item',
      sku: 'NONE-001',
      trackingMethod: 'none',
      stock: 0,
      price: 5,
    });
    noneProductId = p3._id;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Manual Movements Validation', () => {
    test('Should fail to receipt batch-tracked item without lotNumber', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: batchProductId,
          kind: 'receipt',
          quantity: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Lot or Batch number is required/i);
    });

    test('Should succeed to receipt batch-tracked item with lotNumber', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: batchProductId,
          kind: 'receipt',
          quantity: 10,
          lotNumber: 'LOT-A1',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.lotNumber).toBe('LOT-A1');

      const p = await Product.findById(batchProductId);
      expect(p.stock).toBe(10);

      const bal = await LotBalance.findOne({ product: batchProductId, lotNumber: 'LOT-A1' });
      expect(bal).toBeTruthy();
      expect(bal.quantity).toBe(10);
    });

    test('Should fail to issue batch-tracked item without lotNumber', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: batchProductId,
          kind: 'issue',
          quantity: 2,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Lot or Batch number is required/i);
    });

    test('Should fail to receipt serial-tracked item without serialNumber', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: serialProductId,
          kind: 'receipt',
          quantity: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Serial number is required/i);
    });

    test('Should succeed to receipt serial-tracked item with serialNumber', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: serialProductId,
          kind: 'receipt',
          quantity: 1,
          serialNumber: 'SN-0001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.serialNumber).toBe('SN-0001');

      const bal = await LotBalance.findOne({ product: serialProductId, serialNumber: 'SN-0001' });
      expect(bal).toBeTruthy();
      expect(bal.quantity).toBe(1);
    });

    test('Should allow movement for non-tracked items without identifiers', async () => {
      const res = await request(app)
        .post('/api/inventory/movements')
        .set('Authorization', adminToken)
        .send({
          productId: noneProductId,
          kind: 'receipt',
          quantity: 50,
        });

      expect(res.status).toBe(201);
      const p = await Product.findById(noneProductId);
      expect(p.stock).toBe(50);
    });
  });

  describe('PO Receipt Integration', () => {
    test('Should require tracking identifiers when receiving PO lines', async () => {
      const po = await PurchaseOrder.create({
        tenantId,
        poNumber: 'PO-TEST-001',
        supplierName: 'Test Supplier',
        lines: [
          {
            product: batchProductId,
            quantityOrdered: 10,
            quantityReceived: 0,
            unitCost: 8,
          },
        ],
        status: 'approved',
      });

      // Try receiving without lotNumber
      const res = await request(app)
        .post(`/api/purchase-orders/${po._id}/receive`)
        .set('Authorization', adminToken)
        .send({
          receipts: [{ lineIndex: 0, quantity: 5 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Lot or Batch number is required/i);

      // Try receiving with lotNumber
      const resSuccess = await request(app)
        .post(`/api/purchase-orders/${po._id}/receive`)
        .set('Authorization', adminToken)
        .send({
          receipts: [{ lineIndex: 0, quantity: 5, lotNumber: 'PO-LOT-1' }],
        });

      expect(resSuccess.status).toBe(200);

      const updatedPo = await PurchaseOrder.findById(po._id);
      expect(updatedPo.lines[0].quantityReceived).toBe(5);

      const moves = await StockMovement.find({ referenceId: po._id });
      expect(moves[0].lotNumber).toBe('PO-LOT-1');

      const bal = await LotBalance.findOne({ product: batchProductId, lotNumber: 'PO-LOT-1' });
      expect(bal).toBeTruthy();
      expect(bal.quantity).toBe(5);
    });
  });
});
