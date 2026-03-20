# Multi-Tenant + Super Admin Draft (Backend)

This draft is tailored to the current backend codebase (Express + Mongoose, `Employee` auth model, role-based middleware).

---

## 1) Current State (what must change)

- Auth uses `Employee` and JWT payload `{ id }` only.
- Controllers query models without tenant scope (`Model.find()`, `findById()`).
- Many model unique keys are global (example: `Product.sku`, `Employee.employeeId`).
- No `tenantId` field exists in core business models.

To support multiple companies with one super admin, move to **shared DB + strict tenant scoping**.

---

## 2) New Core Model: Tenant

Create `backend/models/Tenant.js`:

```js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true }, // slug/subdomain
    legalName: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    industry: {
      type: String,
      enum: ['manufacturing', 'distribution', 'retail', 'service', 'other'],
      default: 'manufacturing',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'archived'],
      default: 'trial',
    },
    plan: { type: String, default: 'starter' },
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    currency: { type: String, default: 'ETB' },
    moduleFlags: {
      manufacturing: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      sales: { type: Boolean, default: true },
      procurement: { type: Boolean, default: true },
      finance: { type: Boolean, default: true },
      hr: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
```

---

## 3) Employee/Auth Schema Changes

Update `backend/models/Employee.js`:

1. Add tenant reference:

```js
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true,
},
```

2. Add platform role for cross-tenant control:

```js
platformRole: {
  type: String,
  enum: ['none', 'super_admin'],
  default: 'none',
},
```

3. Replace global unique `employeeId` with tenant composite unique index:

- Change field:
```js
employeeId: {
  type: String,
  required: true,
  trim: true,
},
```

- Add index:
```js
employeeSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
```

4. Recommended email uniqueness:
```js
employeeSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
```

---

## 4) Add `tenantId` to Domain Models

Add this field to each business model:

```js
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true,
},
```

Models to update in this repository:

- `Product`, `Order`, `Client`, `BOM`, `ProductionJob`, `PurchaseOrder`, `Shipment`
- `Invoice`, `Expense`, `Vendor`, `VendorBill`, `VendorPayment`, `TaxSettings`, `WithholdingCertificate`, `CogsEntry`
- `Employee`, `Attendance`, `Payroll`
- `StockMovement`, `StockReservation`
- `AuditLog`, `SavedView`, `ApprovalRequest`, `Notification`
- `WorkCenter`, `Asset`, `PmSchedule`, `DowntimeEvent`, `QualityInspection`, `NonConformance`

### Required unique index changes

- `Product`: remove `sku: unique: true`; add:
```js
ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
```

- Any other global unique business code/number should become tenant-scoped:
  - `poNumber`, `shipmentNumber`, `invoiceId`, `vendor code`, etc.

---

## 5) JWT Payload + Token Generation

Update `backend/utils/generateToken.js`:

```js
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/loadEnv');

const generateToken = ({ id, tenantId, platformRole = 'none' }) => {
  return jwt.sign(
    {
      id,
      tenantId: tenantId ? String(tenantId) : null,
      platformRole,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

module.exports = generateToken;
```

Update `backend/controllers/authController.js` login response token call:

```js
token: generateToken({
  id: user._id,
  tenantId: user.tenantId,
  platformRole: user.platformRole || 'none',
}),
```

---

## 6) New Tenant Resolution Middleware

Create `backend/middleware/tenantMiddleware.js`:

```js
const mongoose = require('mongoose');

function parseTenantFromHeader(req) {
  const v = req.headers['x-tenant-id'];
  if (!v) return null;
  if (!mongoose.Types.ObjectId.isValid(v)) return null;
  return String(v);
}

function withTenant(req, res, next) {
  // super admin can switch tenant via header
  const headerTenantId = parseTenantFromHeader(req);

  if (req.user?.platformRole === 'super_admin') {
    req.tenantId = headerTenantId || (req.user.tenantId ? String(req.user.tenantId) : null);
    req.isSuperAdmin = true;
    return next();
  }

  // regular users are strictly pinned to their own tenant
  req.isSuperAdmin = false;
  req.tenantId = req.user?.tenantId ? String(req.user.tenantId) : null;

  if (!req.tenantId) {
    const err = new Error('Tenant context missing');
    err.statusCode = 403;
    return next(err);
  }

  // block mismatch attempts
  if (headerTenantId && headerTenantId !== req.tenantId) {
    const err = new Error('Tenant mismatch');
    err.statusCode = 403;
    return next(err);
  }

  next();
}

module.exports = { withTenant };
```

Register in `backend/app.js` after `protect` and before business routes:

```js
const { withTenant } = require('./middleware/tenantMiddleware');
app.use('/api', protect);
app.use('/api', withTenant);
```

---

## 7) Auth Middleware Changes

Update `backend/middleware/authMiddleware.js` in `protect`:

1. Load tenant/platform fields:

```js
req.user = await Employee.findById(decoded.id).select(
  '-password tenantId platformRole role department name email employeeId'
);
```

2. Validate active user + tenant for non-super admin:

```js
if (!req.user) throw auth401('Session invalid');
if (req.user.platformRole !== 'super_admin' && !req.user.tenantId) {
  throw auth401('User has no tenant assigned');
}
```

---

## 8) Query Scoping Pattern (Controller Changes)

Every controller query must include tenant criteria.

### Example: `productController.js`

Before:
```js
const products = await Product.find();
```

After:
```js
const products = await Product.find({ tenantId: req.tenantId });
```

Before:
```js
const product = await Product.findById(req.params.id);
```

After:
```js
const product = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId });
```

Create:
```js
const product = await Product.create({ ...body, tenantId: req.tenantId });
```

Update/Delete:
```js
await Product.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, body, opts);
await Product.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
```

### Example: `orderController.js`

Before:
```js
const orders = await Order.find().populate('client').populate('items.product').lean();
```

After:
```js
const orders = await Order.find({ tenantId: req.tenantId })
  .populate('client')
  .populate('items.product')
  .lean();
```

Create:
```js
let order = await Order.create({ ...req.body, tenantId: req.tenantId });
```

Approval requests and linked entities must also carry same `tenantId`.

---

## 9) Platform/Super Admin Routes

Add new route group: `backend/routes/platformRoutes.js` (super admin only):

- `POST /api/platform/tenants` create tenant
- `GET /api/platform/tenants` list tenants
- `PATCH /api/platform/tenants/:id/status` activate/suspend
- `POST /api/platform/tenants/:id/admin` create tenant admin
- `GET /api/platform/metrics` cross-tenant KPIs

Guard middleware:

```js
function requireSuperAdmin(req, res, next) {
  if (req.user?.platformRole !== 'super_admin') {
    res.status(403);
    throw new Error('Super admin only');
  }
  next();
}
```

---

## 10) Safe Data Migration Plan

Run once in maintenance window:

1. Create default tenant (`factory-flow-default`).
2. Backfill all documents with `tenantId = defaultTenant._id`.
3. Backfill employees similarly.
4. Create new composite indexes.
5. Remove old global unique indexes (like `sku_1`, `employeeId_1`) only after step 4.
6. Deploy middleware + controller changes.
7. Smoke-test with at least two tenants.

---

## 11) Minimal Helper (optional but recommended)

Create `backend/utils/tenantQuery.js`:

```js
function byTenant(req, extra = {}) {
  return { ...extra, tenantId: req.tenantId };
}

module.exports = { byTenant };
```

Then controllers use:
```js
const { byTenant } = require('../utils/tenantQuery');
await Product.find(byTenant(req));
await Product.findOne(byTenant(req, { _id: req.params.id }));
```

This reduces human error and avoids tenant leaks.

---

## 12) Must-Do Security Rules

- Never accept `tenantId` from body/query for normal users.
- Tenant context must come from authenticated session (`req.user`) and validated middleware.
- Only super admin may switch tenant via `x-tenant-id`.
- Audit logs must always store `tenantId`.
- Add tests for cross-tenant access denial (403/404).

---

## 13) First Iteration Scope (recommended)

Implement first on these modules, then expand:

1. Auth (`Employee`, JWT, `protect`, `withTenant`)
2. `Product`, `Client`, `Order`
3. `PurchaseOrder`, `Shipment`
4. `Invoice`, `Expense`
5. `Employee`, `Attendance`, `Payroll`

After this is stable, apply the same tenant pattern to all remaining models/controllers.
