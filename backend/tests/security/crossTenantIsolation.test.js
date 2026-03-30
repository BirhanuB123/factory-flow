const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../config/loadEnv');

jest.mock('../../models/Employee', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models/Tenant', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  aggregate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
  exists: jest.fn(),
}));

jest.mock('../../models/Product', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models/Order', () => ({
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models/Invoice', () => ({
  countDocuments: jest.fn(),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models/PlatformAuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../models/Client', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models/PurchaseOrder', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/inviteEmailService', () => ({
  sendTenantAdminInvite: jest.fn().mockResolvedValue({ sent: false }),
}));

jest.mock('../../models/Shipment', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/CogsEntry', () => ({
  findOne: jest.fn(),
}));

const Employee = require('../../models/Employee');
const Tenant = require('../../models/Tenant');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const Invoice = require('../../models/Invoice');
const Shipment = require('../../models/Shipment');
const CogsEntry = require('../../models/CogsEntry');
const Client = require('../../models/Client');
const PurchaseOrder = require('../../models/PurchaseOrder');

const app = require('../../app');

function bearerFor(payload) {
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
  return `Bearer ${token}`;
}

function mockAuthUser(userDoc) {
  Employee.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(userDoc),
  });
}

describe('Cross-tenant hardening suite', () => {
  const tenantA = '64f0000000000000000000a1';
  const tenantB = '64f0000000000000000000b2';

  beforeEach(() => {
    Tenant.findById.mockReset();
    Tenant.exists.mockReset();
    Tenant.exists.mockResolvedValue({ _id: tenantA });
    Tenant.findById.mockReturnValue({
      select: jest.fn(() => {
        const tenantDoc = {
          _id: tenantA,
          status: 'active',
          moduleFlags: {
            manufacturing: true,
            inventory: true,
            sales: true,
            procurement: true,
            finance: true,
            hr: true,
          },
        };
        return {
          ...tenantDoc,
          lean: jest.fn().mockResolvedValue(tenantDoc),
        };
      }),
    });
    const userChain = {};
    userChain.select = jest.fn(() => userChain);
    userChain.sort = jest.fn(() => userChain);
    userChain.limit = jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) }));
    Employee.find.mockReturnValue(userChain);
  });

  test('platform endpoints block non-super-admin users (403)', async () => {
    mockAuthUser({
      _id: 'u1',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant Admin',
      email: 'admin@a.test',
      employeeId: 'A-001',
    });

    const res = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', bearerFor({ id: 'u1', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(403);
  });

  test('normal tenant user cannot switch tenant via x-tenant-id (403)', async () => {
    mockAuthUser({
      _id: 'u1-switch',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant Admin',
      email: 'admin@a.test',
      employeeId: 'A-001-SW',
    });

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', bearerFor({ id: 'u1-switch', tenantId: tenantA, platformRole: 'none' }))
      .set('x-tenant-id', tenantB);

    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/tenant mismatch/i);
  });

  test('platform list works for super-admin', async () => {
    mockAuthUser({
      _id: 'sa1',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa@test',
      employeeId: 'SA-001',
    });
    Tenant.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: tenantA, key: 'a' }]),
      }),
    });

    const res = await request(app)
      .get('/api/platform/tenants')
      .set(
        'Authorization',
        bearerFor({ id: 'sa1', tenantId: tenantA, platformRole: 'super_admin' })
      );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Tenant.find).toHaveBeenCalledTimes(1);
  });

  test('platform create tenant admin binds new user to target tenant', async () => {
    mockAuthUser({
      _id: 'sa2',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa2@test',
      employeeId: 'SA-002',
    });

    Tenant.findById.mockResolvedValue({ _id: tenantB, key: 'b' });
    Employee.findOne.mockResolvedValue(null);
    Employee.create.mockResolvedValue({
      _id: 'new-admin',
      tenantId: tenantB,
      employeeId: 'B-ADMIN',
      name: 'Tenant B Admin',
      role: 'Admin',
      email: 'tb@test',
    });

    const res = await request(app)
      .post(`/api/platform/tenants/${tenantB}/admin`)
      .set(
        'Authorization',
        bearerFor({ id: 'sa2', tenantId: tenantA, platformRole: 'super_admin' })
      )
      .send({
        employeeId: 'B-ADMIN',
        name: 'Tenant B Admin',
        password: 'StrongPassword123!',
        role: 'Admin',
      });

    expect(res.status).toBe(201);
    expect(Employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantB,
        employeeId: 'B-ADMIN',
      })
    );
  });

  test('product read is tenant-scoped (cross-tenant id resolves as 404)', async () => {
    mockAuthUser({
      _id: 'u2',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant A User',
      email: 'u2@a.test',
      employeeId: 'A-002',
    });
    Product.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/products/65f000000000000000000001')
      .set('Authorization', bearerFor({ id: 'u2', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(404);
    expect(Product.findOne).toHaveBeenCalledWith({
      _id: '65f000000000000000000001',
      tenantId: tenantA,
    });
  });

  test('order read is tenant-scoped (cross-tenant id resolves as 404)', async () => {
    mockAuthUser({
      _id: 'u3',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant A User',
      email: 'u3@a.test',
      employeeId: 'A-003',
    });

    Order.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    const res = await request(app)
      .get('/api/orders/65f0000000000000000000aa')
      .set('Authorization', bearerFor({ id: 'u3', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(404);
    expect(Order.findOne).toHaveBeenCalledWith({
      _id: '65f0000000000000000000aa',
      tenantId: tenantA,
    });
  });

  test('shipment read is tenant-scoped (cross-tenant id resolves as 404)', async () => {
    mockAuthUser({
      _id: 'u4',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant A User',
      email: 'u4@a.test',
      employeeId: 'A-004',
    });

    Shipment.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .get('/api/shipments/65f0000000000000000000bb')
      .set('Authorization', bearerFor({ id: 'u4', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(404);
    expect(Shipment.findOne).toHaveBeenCalledWith({
      _id: '65f0000000000000000000bb',
      tenantId: tenantA,
    });
  });

  test('finance COGS lookup is tenant-scoped (cross-tenant invoice resolves as 404)', async () => {
    mockAuthUser({
      _id: 'u5',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Finance',
      name: 'Tenant A Finance',
      email: 'u5@a.test',
      employeeId: 'A-005',
    });

    CogsEntry.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app)
      .get('/api/finance/invoices/65f0000000000000000000cc/cogs')
      .set('Authorization', bearerFor({ id: 'u5', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(404);
    expect(CogsEntry.findOne).toHaveBeenCalledWith({
      invoice: '65f0000000000000000000cc',
      tenantId: tenantA,
    });
  });

  test('suspended tenant users are blocked from tenant routes (403)', async () => {
    mockAuthUser({
      _id: 'u6',
      tenantId: tenantA,
      platformRole: 'none',
      role: 'Admin',
      department: 'Ops',
      name: 'Tenant A User',
      email: 'u6@a.test',
      employeeId: 'A-006',
    });
    Tenant.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: tenantA, status: 'suspended' }),
    });

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', bearerFor({ id: 'u6', tenantId: tenantA, platformRole: 'none' }));

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Tenant is suspended');
  });

  test('platform metrics endpoint returns cross-tenant aggregates for super-admin', async () => {
    mockAuthUser({
      _id: 'sa3',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa3@test',
      employeeId: 'SA-003',
    });

    Tenant.aggregate.mockResolvedValue([
      { _id: 'active', count: 2 },
      { _id: 'suspended', count: 1 },
    ]);
    Employee.countDocuments.mockResolvedValue(100);
    Product.countDocuments.mockResolvedValue(250);
    Order.countDocuments.mockResolvedValue(80);
    Invoice.countDocuments.mockResolvedValue(70);

    const res = await request(app)
      .get('/api/platform/metrics')
      .set(
        'Authorization',
        bearerFor({ id: 'sa3', tenantId: tenantA, platformRole: 'super_admin' })
      );

    expect(res.status).toBe(200);
    expect(res.body.data.tenants.byStatus.active).toBe(2);
    expect(res.body.data.products).toBe(250);
    expect(res.body.data.orders).toBe(80);
  });

  test('platform tenant detail works for super-admin', async () => {
    mockAuthUser({
      _id: 'sa-detail',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa-detail@test',
      employeeId: 'SA-DETAIL',
    });

    Tenant.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: tenantB,
        key: 'tenant-b',
        legalName: 'B Legal PLC',
        displayName: 'B Company',
        status: 'active',
        industry: 'manufacturing',
        plan: 'starter',
        timezone: 'Africa/Addis_Ababa',
        currency: 'ETB',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      }),
    });
    Employee.countDocuments
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    Product.countDocuments.mockResolvedValue(12);
    Order.countDocuments.mockResolvedValue(6);
    Client.countDocuments.mockResolvedValue(3);
    Invoice.countDocuments.mockResolvedValue(2);
    PurchaseOrder.countDocuments.mockResolvedValue(1);
    const detailChain = {};
    detailChain.select = jest.fn(() => detailChain);
    detailChain.sort = jest.fn(() => detailChain);
    detailChain.limit = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([
        {
          name: 'Tenant Admin',
          employeeId: 'ADM-1',
          role: 'Admin',
          email: 'adm@b.com',
          status: 'Active',
          department: 'Administration',
        },
      ]),
    }));
    Employee.find.mockReturnValue(detailChain);

    const res = await request(app)
      .get(`/api/platform/tenants/${tenantB}`)
      .set(
        'Authorization',
        bearerFor({ id: 'sa-detail', tenantId: tenantA, platformRole: 'super_admin' })
      );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenant.key).toBe('tenant-b');
    expect(res.body.data.counts.employees).toBe(4);
    expect(res.body.data.counts.products).toBe(12);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].employeeId).toBe('ADM-1');
  });

  test('platform patch tenant works for super-admin', async () => {
    mockAuthUser({
      _id: 'sa-patch',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa-patch@test',
      employeeId: 'SA-PATCH',
    });

    const prev = {
      _id: tenantB,
      key: 'tenant-b',
      legalName: 'Leg Co',
      displayName: 'Disp Co',
      plan: 'starter',
      timezone: 'Africa/Addis_Ababa',
      currency: 'ETB',
      industry: 'manufacturing',
      moduleFlags: {
        manufacturing: true,
        inventory: true,
        sales: true,
        procurement: true,
        finance: true,
        hr: true,
      },
    };

    Tenant.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(prev),
    });

    Tenant.findByIdAndUpdate.mockResolvedValue({
      ...prev,
      displayName: 'Updated Display',
      plan: 'pro',
      moduleFlags: {
        manufacturing: true,
        inventory: true,
        sales: true,
        procurement: true,
        finance: true,
        hr: false,
      },
    });

    const res = await request(app)
      .patch(`/api/platform/tenants/${tenantB}`)
      .set(
        'Authorization',
        bearerFor({ id: 'sa-patch', tenantId: tenantA, platformRole: 'super_admin' })
      )
      .send({
        displayName: 'Updated Display',
        plan: 'pro',
        moduleFlags: { hr: false },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Updated Display');
    expect(res.body.data.moduleFlags.hr).toBe(false);
    expect(Tenant.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('platform create admin with temp_password returns temporaryPassword', async () => {
    mockAuthUser({
      _id: 'sa-temp',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa-temp@test',
      employeeId: 'SA-TEMP',
    });

    Tenant.findById.mockResolvedValue({ _id: tenantB, key: 'tenant-b', displayName: 'B Co' });
    Employee.findOne.mockResolvedValue(null);
    Employee.create.mockImplementation((doc) =>
      Promise.resolve({
        ...doc,
        _id: 'new-emp-temp',
        employeeId: doc.employeeId,
        name: doc.name,
        tenantId: doc.tenantId,
        role: doc.role,
        email: doc.email,
        mustChangePassword: doc.mustChangePassword,
      })
    );

    const res = await request(app)
      .post(`/api/platform/tenants/${tenantB}/admin`)
      .set(
        'Authorization',
        bearerFor({ id: 'sa-temp', tenantId: tenantA, platformRole: 'super_admin' })
      )
      .send({
        employeeId: 'TEMP-ADM',
        name: 'Temp Admin',
        onboardingMode: 'temp_password',
      });

    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toBeTruthy();
    expect(String(res.body.temporaryPassword).length).toBeGreaterThan(6);
    expect(Employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'TEMP-ADM',
        mustChangePassword: true,
      })
    );
  });

  test('platform reset-access returns temporary password for existing tenant admin', async () => {
    mockAuthUser({
      _id: 'sa-reset',
      tenantId: tenantA,
      platformRole: 'super_admin',
      role: 'Admin',
      department: 'Platform',
      name: 'Super Admin',
      email: 'sa-reset@test',
      employeeId: 'SA-RESET',
    });

    Tenant.findById.mockResolvedValue({ _id: tenantB, key: 'tenant-b', displayName: 'B Co' });
    Employee.findOne.mockResolvedValue({
      _id: 'emp-reset',
      tenantId: tenantB,
      employeeId: 'B-ADMIN',
      name: 'B Admin',
      role: 'Admin',
      email: 'b-admin@test',
      mustChangePassword: false,
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post(`/api/platform/tenants/${tenantB}/admins/B-ADMIN/reset-access`)
      .set(
        'Authorization',
        bearerFor({ id: 'sa-reset', tenantId: tenantA, platformRole: 'super_admin' })
      )
      .send({ onboardingMode: 'temp_password' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(String(res.body.temporaryPassword || '').length).toBeGreaterThan(6);
    expect(res.body.data.employeeId).toBe('B-ADMIN');
    expect(Employee.findOne).toHaveBeenCalledWith({ tenantId: tenantB, employeeId: 'B-ADMIN' });
  });
});
