# Factory Flow ERP — Technical Overview

**Version:** 1.0  
**Date:** June 2026  
**System:** Factory Flow ERP (Multi-Tenant Manufacturing & Business Management Platform)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Backend Structure](#4-backend-structure)
5. [Frontend Structure](#5-frontend-structure)
6. [Business Modules](#6-business-modules)
7. [Database Design](#7-database-design)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Multi-Tenancy](#9-multi-tenancy)
10. [API Design](#10-api-design)
11. [Ethiopia-Specific Compliance](#11-ethiopia-specific-compliance)
12. [Security](#12-security)
13. [Configuration & Environment](#13-configuration--environment)
14. [Testing](#14-testing)
15. [Deployment](#15-deployment)

---

## 1. System Overview

Factory Flow ERP is a full-stack, multi-tenant enterprise resource planning system designed for manufacturing companies. It covers the complete operational lifecycle — from raw material procurement through production, quality control, sales, finance, and human resources — in a single, integrated platform.

**Key characteristics:**

- **Multi-tenant SaaS**: A single deployment serves multiple independent companies (tenants), each with full data isolation.
- **Manufacturing-first**: Core design is built around Bill of Materials (BOM), production jobs, shop-floor execution, and job costing.
- **Ethiopia-localized**: Built-in support for Ethiopian tax law (VAT, WHT, income tax, pension), Ethiopian calendar, and local payment providers (Chapa).
- **Role-based access**: Fine-grained permissions per business function, enforced at the API level.
- **Offline-capable frontend**: The React client queues critical operations when offline and replays them on reconnection.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│                React 18 + TypeScript + Vite                  │
│            Tailwind CSS + shadcn/ui + TanStack Query         │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTPS (REST/JSON)
                         │  Authorization: Bearer <JWT>
                         │  x-tenant-id: <tenantId>
┌────────────────────────▼────────────────────────────────────┐
│                    Backend (API Server)                       │
│               Node.js + Express.js 5                         │
│     Middleware: Auth, Tenant, Rate-Limit, Validation          │
│     Layers: Routes → Controllers → Services → Models         │
└────────────────────────┬────────────────────────────────────┘
                         │  Mongoose ODM
┌────────────────────────▼────────────────────────────────────┐
│                      MongoDB Database                         │
│         Single database, tenantId-scoped collections         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Backend Layer Model

The backend follows a strict four-layer architecture:

| Layer | Location | Responsibility |
|---|---|---|
| **Routes** | `backend/routes/` | HTTP method binding, middleware composition |
| **Controllers** | `backend/controllers/` | Request parsing, response shaping, input validation |
| **Services** | `backend/services/` | Business logic, cross-model orchestration |
| **Models** | `backend/models/` | Mongoose schemas, field definitions, indexes |

### 2.3 Frontend Layer Model

| Layer | Location | Responsibility |
|---|---|---|
| **Pages** | `src/pages/` | Route-level view components |
| **Components** | `src/components/` | Reusable UI building blocks |
| **API Client** | `src/api/` | Axios-based modules per domain |
| **Contexts** | `src/contexts/` | Auth state, locale state |
| **Hooks** | `src/hooks/` | Custom data-fetching and UI hooks |
| **Lib** | `src/lib/` | Utilities (formatting, permissions, offline queue) |

---

## 3. Technology Stack

### 3.1 Backend

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | LTS |
| Web Framework | Express.js | 5.2.1 |
| ODM | Mongoose | 9.3.0 |
| Database | MongoDB | — |
| Authentication | jsonwebtoken | 9.0.3 |
| Password Hashing | bcryptjs | 3.0.3 |
| Validation | express-validator | 7.3.1 |
| Rate Limiting | express-rate-limit | 8.3.1 |
| HTTP Security | Helmet | 8.1.0 |
| Logging | Pino + Pino-HTTP | 10.3.1 / 11.0.0 |
| Email | Nodemailer | 8.0.2 |
| Payments | Stripe | 20.4.1 |
| QR Codes | qrcode | 1.5.4 |
| File Uploads | Multer | — |
| Testing | Jest + MongoDB Memory Server | — |

### 3.2 Frontend

| Category | Technology | Version |
|---|---|---|
| Build Tool | Vite | 8.0.13 |
| UI Framework | React | 18.3.1 |
| Language | TypeScript | 5.8.3 |
| Styling | Tailwind CSS | 3.4.17 |
| Component Library | shadcn/ui (Radix UI) | — |
| Data Fetching | TanStack React Query | 5.83.0 |
| HTTP Client | Axios | 1.13.6 |
| Routing | React Router DOM | 6.30.1 |
| Forms | React Hook Form + Zod | 7.61.1 |
| Charts | Recharts | — |
| Animations | Framer Motion | — |
| Notifications | Sonner | — |
| QR Scanning | html5-qrcode | 2.3.8 |
| Unit Testing | Vitest + Testing Library | — |
| E2E Testing | Playwright | — |

---

## 4. Backend Structure

### 4.1 Directory Layout

```
backend/
├── server.js                  # Entry point: Express init, MongoDB connect
├── app.js                     # Route mounting, global middleware
├── config/
│   ├── db.js                  # MongoDB connection setup
│   ├── logger.js              # Pino logger configuration
│   ├── loadEnv.js             # .env loading with JWT secret rotation
│   └── permissions.js         # Role-to-permission matrix (RBAC)
├── routes/
│   ├── auth/
│   ├── inventory/
│   ├── production/
│   ├── sales/
│   ├── finance/
│   ├── pos/
│   ├── platform/
│   ├── notifications/
│   └── trade/
├── controllers/               # 48+ controller files (mirroring routes)
├── services/                  # 24+ service files (business logic)
├── models/                    # 48 Mongoose model files
├── middleware/
│   ├── authMiddleware.js      # JWT verification, user loading
│   ├── tenantMiddleware.js    # Tenant context enforcement
│   ├── validateRequest.js     # Input validation rules
│   ├── rateLimits.js          # Rate limiting per endpoint type
│   ├── errorMiddleware.js     # Global error handler
│   └── superAdminGuardrails.js # IP allowlist, step-up auth
└── utils/
    ├── generateToken.js
    ├── tenantQuery.js         # Tenant-scoped MongoDB helpers
    ├── ethiopianDate.js       # Ethiopian calendar utilities
    ├── webhookSecurity.js     # HMAC signature verification
    └── ...
```

### 4.2 Route Namespacing

All routes are nested under domain namespaces for clarity and maintainability:

| Domain | Route Prefix | Route File |
|---|---|---|
| Authentication | `/api/auth/` | `routes/auth/authRoutes.js` |
| Inventory | `/api/products/` | `routes/inventory/productRoutes.js` |
| Production | `/api/jobs/`, `/api/boms/` | `routes/production/` |
| Sales | `/api/orders/`, `/api/clients/` | `routes/sales/` |
| Finance | `/api/invoices/`, `/api/finance/` | `routes/finance/` |
| Procurement | `/api/vendors/` (via platform) | — |
| HR | `/api/employees/` (via platform) | — |
| POS | `/api/pos/` | `routes/pos/posRoutes.js` |
| Shipments | `/api/shipments/` | — |
| Global Trade | `/api/trade/` | `routes/trade/trade.routes.js` |
| Notifications | `/api/notifications/` | `routes/notifications/` |
| Platform Admin | `/api/platform/` | `routes/platform/` |
| Billing Webhooks | `/api/billing/webhook/` | `routes/finance/billingWebhookRoutes.js` |

### 4.3 Key Services

| Service | File | Purpose |
|---|---|---|
| Stock | `inventory/stockService.js` | Stock balance queries across locations |
| Reservation | `inventory/reservationService.js` | Reserve stock for confirmed sales orders |
| Production Inventory | `production/productionInventoryService.js` | Material issue/return tracking for jobs |
| Job Operations | `production/jobOperationsService.js` | Shop-floor operation scheduling |
| Costing | `production/costingService.js` | Labor, overhead, and scrap cost rollup |
| Payment | `finance/paymentService.js` | Stripe/Chapa payment processing |
| Landed Cost | `finance/landedCostService.js` | Import cost allocation to PO line items |
| Ethiopia Tax | `finance/ethiopiaTaxService.js` | VAT, WHT calculation per transaction |
| Ethiopia Payroll | `hr/ethiopiaPayrollService.js` | Income tax, pension deduction rules |
| Invite Email | `hr/inviteEmailService.js` | Employee onboarding email dispatch |
| Mail | `notifications/mailService.js` | SMTP email delivery via Nodemailer |
| Audit | `platform/auditService.js` | Master data change audit trail |
| POS Invoice | `pos/posInvoiceService.js` | Invoice generation from POS sessions |
| POS Journal | `pos/posJournalService.js` | Accounting journal entries from POS |
| Trial Lifecycle | `platform/trialLifecycleService.js` | Auto-suspend expired trial tenants |

---

## 5. Frontend Structure

### 5.1 Directory Layout

```
frontend/src/
├── main.tsx                   # React root mount
├── App.tsx                    # Router, providers, sidebar layout
├── index.css                  # Global styles (Tailwind base)
├── api/                       # 24 domain API modules + axios config
├── pages/                     # 33+ route-level page components
├── components/
│   ├── ui/                    # 50+ shadcn/ui primitives
│   ├── dashboards/            # Dashboard summary panels
│   ├── finance/               # Finance-specific components
│   ├── inventory/             # Inventory-specific components
│   └── pos/                   # POS receipt layout
├── contexts/
│   ├── AuthContext.tsx        # Token, user, permissions state
│   └── LocaleContext.tsx      # Locale and calendar switching
├── hooks/                     # Custom hooks
├── lib/
│   ├── permissions.ts         # PERMS constants (mirrors backend)
│   ├── formatMoney.ts         # Currency formatting
│   ├── offlineQueue.ts        # Offline action queue
│   └── utils.ts               # General helpers
└── i18n/                      # Localization resources
```

### 5.2 Application Shell (App.tsx)

The main application is a resizable sidebar layout:

- **Left sidebar** (`AppSidebar.tsx`): Module navigation, tenant branding, user info
- **Main panel**: Route-matched page component
- **Top bar** (`DashboardHeader.tsx`): Breadcrumbs, search, notifications, user menu
- **Overlays**: Announcement banner, offline queue banner, password-change gate

### 5.3 Route Guards

| Component | Purpose |
|---|---|
| `ProtectedRoute` | Redirects to login if no valid JWT |
| `SuperAdminRoute` | Allows only `platformRole === 'super_admin'` |
| `TenantModuleRoute` | Blocks access if tenant's feature flag is disabled |
| `MustChangePasswordGate` | Intercepts navigation until password is changed |

### 5.4 API Client Pattern

Each domain has a dedicated API module following a consistent pattern:

```typescript
// Example: src/api/inventory.ts
export const inventoryApi = {
  getProducts: () => api.get('/products'),
  getProduct:  (id: string) => api.get(`/products/${id}`),
  createProduct: (data: ProductPayload) => api.post('/products', data),
  updateProduct: (id: string, data: Partial<ProductPayload>) => api.put(`/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/products/${id}`),
};
```

The `api` object (from `src/api/axios.ts`) is an Axios instance pre-configured with:
- Base URL from `VITE_API_BASE_URL`
- Automatic `Authorization: Bearer <token>` injection
- Automatic `x-tenant-id` header injection
- Platform step-up password header when required

---

## 6. Business Modules

### 6.1 Inventory Management

**Purpose:** Track all physical stock across warehouse locations.

**Key capabilities:**
- Product master with SKU, barcode, pricing, unit of measure, reorder points
- Three tracking methods: **none** (bulk), **batch/lot**, **serial number**
- Expiry date tracking for perishable items
- Multi-location warehousing with bin-level precision
- Stock movements with full audit trail (type: `receipt`, `issue`, `adjustment`, `transfer`, `production_consume`, `production_output`)
- Lot balance ledger (`LotBalance` model) for batch/serial visibility
- Stock reservation for confirmed sales orders (prevents overselling)
- Low-stock alerts with configurable thresholds
- Inventory aging analysis

**Core models:** `Product`, `StockMovement`, `Location`, `LotBalance`, `StockReservation`

---

### 6.2 Production / Manufacturing

**Purpose:** Execute manufacturing work orders from BOM through finished goods.

**Key capabilities:**
- Bill of Materials (BOM) with component list and operation routing
- Production jobs (work orders) created from BOMs
- Operation sequencing with work center assignments
- Material issue and return against each job
- Work-in-process (WIP) state tracking
- Job costing: labor time, machine time, overhead, scrap, rework costs
- Quality inspection checklists per operation
- Non-conformance tracking and resolution
- Traveler document generation for shop floor
- Shop-floor kiosk interface for operators (clock operations, scan barcodes)
- Preventive maintenance scheduling for work centers
- Downtime event logging

**Core models:** `ProductionJob`, `BOM`, `WorkCenter`, `QualityInspection`, `QualityChecklist`, `NonConformance`, `PmSchedule`, `DowntimeEvent`

---

### 6.3 Sales & Order Management

**Purpose:** Manage the full sales lifecycle from quote to delivery.

**Key capabilities:**
- Sales order creation with multi-line items and pricing
- Customer (Client) master with TIN and VAT registration
- Order approval workflow triggered by discount percentage or order amount thresholds
- Automatic stock reservation upon order confirmation
- Order-to-production job conversion for make-to-order manufacturing
- Order status lifecycle: `pending → processing → shipped → delivered → cancelled`
- Trade type classification: **local** vs. **export**
- POS-sourced orders flagged separately from ERP orders
- Shipment creation and tracking from fulfilled orders

**Core models:** `Order`, `Client`, `Lead`, `Quote`, `StockReservation`

---

### 6.4 Procurement

**Purpose:** Manage purchasing from vendors through stock receipt and payment.

**Key capabilities:**
- Purchase order creation with vendor, line items, and delivery terms
- Supply type classification: **local** vs. **import**
- Letter of credit (LC) reference tracking for import POs
- Landed cost allocation per PO (freight, customs duty, clearing charges)
- PO receiving workflow that triggers stock movements
- Vendor master with TIN and payment terms
- Accounts Payable (AP): vendor bills linked to POs
- AP aging report for cash management
- Withholding tax on purchases (Ethiopia WHT compliance)

**Core models:** `PurchaseOrder`, `Vendor`, `VendorBill`, `VendorPayment`

---

### 6.5 Logistics & Shipments

**Purpose:** Track outbound deliveries and global trade movements.

**Key capabilities:**
- Outbound shipments linked to sales orders
- Delivery note generation
- Domestic shipment status tracking
- Separate Global Trade module for import/export shipments with multi-leg routing
- Trade compliance document attachment

**Core models:** `Shipment`, `TradeShipment`

---

### 6.6 Finance & Accounting

**Purpose:** Maintain financial records, tax compliance, and reporting.

**Key capabilities:**
- Sales invoice generation with line items, VAT, and sales WHT
- Invoice posting to the General Ledger (journal entries)
- Accounts Receivable (AR) aging analysis
- COGS calculation and posting
- Manual and automated journal entries
- Expense tracking
- Withholding tax certificates generation
- Tax settings configuration (VAT rates, WHT rates)
- Financial reports: AR/AP aging, revenue summaries
- Integration with Stripe and Chapa payment providers
- Webhook-based payment confirmation with idempotency protection

**Core models:** `Invoice`, `JournalEntry`, `VendorBill`, `CogsEntry`, `Expense`, `TaxSettings`, `WithholdingCertificate`, `WebhookEvent`

---

### 6.7 Human Resources & Payroll

**Purpose:** Manage employees, attendance, leave, and payroll processing.

**Key capabilities:**
- Employee master with role, department, position, reporting manager hierarchy
- Invitation-based employee onboarding (invite link → set password)
- Attendance tracking with clock-in/clock-out timestamps
- Attendance correction request workflow (employee → manager approval)
- Leave and vacation request management
- Monthly payroll cycle with period locking
- Ethiopia income tax brackets and pension contribution calculation
- Payslip generation
- Payroll journal entry posting to the GL
- Employee self-service portal (view payslips, submit leave/attendance corrections)
- Asset assignment tracking (laptop, equipment, etc.)

**Core models:** `Employee`, `Attendance`, `AttendanceCorrectionRequest`, `LeaveRequest`, `Department`, `Position`, `Payroll`, `PayrollMonthClose`, `PayrollPosting`, `Asset`

---

### 6.8 Point of Sale (POS)

**Purpose:** Support retail or counter-sales transactions.

**Key capabilities:**
- POS session management (open/close registers per shift)
- Product lookup by SKU or barcode scanner
- Transaction processing with payment capture
- Receipt generation with QR code
- Automatic invoice creation from POS sales
- Automatic accounting journal entry from POS session close
- POS orders integrated into inventory stock movements
- Session-level sales summary reporting

**Core models:** `PosSession`, `Order` (POS-flagged), `Invoice`

---

### 6.9 Customer Relationship Management (CRM)

**Purpose:** Track prospects and manage the pre-sales pipeline.

**Key capabilities:**
- Lead and contact creation
- Quote (proposal) generation from leads
- Quote-to-order conversion
- Lead status and activity tracking

**Core models:** `Lead`, `Quote`

---

### 6.10 Quality Management

**Purpose:** Ensure product quality at every stage of production.

**Key capabilities:**
- Quality checklist templates linked to BOM operations
- Inspection records (pass / fail / waived) per production job operation
- Non-conformance reports (NCR) with root cause and resolution tracking
- Quality-gated WIP status: production jobs cannot advance until inspections pass
- Receiving inspection for incoming goods

**Core models:** `QualityInspection`, `QualityChecklist`, `NonConformance`

---

### 6.11 Reporting & Analytics

**Purpose:** Provide operational visibility and business intelligence.

**Key capabilities:**
- Role-specific dashboards (Finance, HR, Manufacturing, Procurement, Employee)
- KPI summaries for each domain (throughput, open orders, AR balance, attendance rate)
- Recharts-based visualizations (bar, line, pie)
- Report generation: inventory movements, AR/AP aging, COGS, payroll
- Export to CSV and PDF
- Saved views: users can persist custom table filters and column configurations

**Frontend pages:** `Analytics.tsx`, `Reports.tsx`

---

### 6.12 Platform Administration (Super-Admin)

**Purpose:** Manage the multi-tenant SaaS platform itself.

**Capabilities:**
- Tenant provisioning (create, configure, archive)
- Subscription lifecycle management: `trial → active → suspended → archived`
- Per-tenant feature flag management (enable/disable modules)
- Trial auto-suspension scheduler
- Announcement broadcasting (platform-wide or tenant-specific)
- Platform audit log (immutable record of admin actions)
- Billing provider integration: Stripe, Chapa, or manual billing
- Webhook event tracking and replay protection

**Core models:** `Tenant`, `PlatformSettings`, `PlatformAuditLog`, `Notification`

---

## 7. Database Design

### 7.1 Database Technology

- **Database:** MongoDB (document store)
- **ODM:** Mongoose 9.x
- **Connection:** Single MongoDB instance, configurable via `MONGODB_URI`
- **Default URI:** `mongodb://127.0.0.1:27017/factory_flow`

### 7.2 Multi-Tenant Data Isolation

All business data documents carry a `tenantId` field. Every query in the service layer is automatically scoped to the active tenant using helper functions from `utils/tenantQuery.js`. This guarantees complete data isolation between companies without requiring separate databases.

```
// Pattern on every business model
tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true }
```

Compound indexes on `(tenantId, <natural key>)` enforce uniqueness within a tenant while allowing the same SKU code to exist across different tenants.

### 7.3 Core Model Summary

| Model | Collection | Description |
|---|---|---|
| `Tenant` | tenants | Company accounts with subscription state and feature flags |
| `Employee` | employees | User accounts with role, department, tenantId |
| `Product` | products | Inventory SKUs with pricing and stock metadata |
| `StockMovement` | stockmovements | Immutable stock transaction audit trail |
| `Location` | locations | Warehouse bins and zones |
| `LotBalance` | lotbalances | Batch/serial lot stock levels |
| `StockReservation` | stockreservations | Open reservations against product |
| `ProductionJob` | productionjobs | Work orders with BOM, operations, costs |
| `BOM` | boms | Bill of Materials with components and routing |
| `WorkCenter` | workcenters | Manufacturing cells |
| `QualityInspection` | qualityinspections | Inspection records per job/operation |
| `NonConformance` | nonconformances | Quality issue reports |
| `Order` | orders | Sales orders with items and status |
| `Client` | clients | Customer master |
| `Vendor` | vendors | Supplier master |
| `PurchaseOrder` | purchaseorders | POs with landed cost fields |
| `VendorBill` | vendorbills | AP bills linked to POs |
| `Invoice` | invoices | Sales invoices with VAT/WHT |
| `JournalEntry` | journalentries | GL journal entries |
| `CogsEntry` | cogsentries | COGS posting records |
| `Payroll` | payrolls | Payroll run records |
| `Attendance` | attendances | Clock-in/out records |
| `LeaveRequest` | leaverequests | Leave applications |
| `PosSession` | possessions | POS register sessions |
| `ApprovalRequest` | approvalrequests | Workflow approvals |
| `AuditLog` | auditlogs | Master data change history |
| `Notification` | notifications | In-app notifications |

---

## 8. Authentication & Authorization

### 8.1 Authentication Flow

```
1.  POST /api/auth/login  { email, password }
    ↓
2.  Backend: verify bcrypt hash, generate JWT (30-day default)
    ↓
3.  Frontend: store token in localStorage
    ↓
4.  GET /api/auth/me  [Authorization: Bearer <token>]
    ↓
5.  Backend: verify JWT, load Employee document → hydrate AuthContext
    ↓
6.  All subsequent requests include Bearer token automatically
```

### 8.2 Employee Onboarding (Passwordless Invite)

```
1.  Admin sends invite → POST /api/platform/employees/:id/invite
2.  Backend generates one-time token, emails link to employee
3.  Employee opens /invite-accept?token=<token>
4.  Employee sets password → POST /api/auth/complete-invite
5.  Backend validates token, sets password, clears invite token
6.  Employee logs in normally
```

If `mustChangePassword` flag is set, the `MustChangePasswordGate` component blocks all navigation until the employee changes their temporary password.

### 8.3 JWT Secret Rotation

To allow zero-downtime secret rotation, the backend accepts tokens signed by either `JWT_SECRET` or `JWT_SECRET_PREVIOUS`. Both are tried during verification. After rotation, old tokens remain valid until they naturally expire.

### 8.4 Role-Based Access Control (RBAC)

Roles and their permission sets are defined in `backend/config/permissions.js`:

| Role | Description |
|---|---|
| `Admin` | Full access; bypasses all permission checks |
| `purchasing_head` | PO creation, vendor management, AP |
| `warehouse_head` | Receiving, stock movements, shipments |
| `finance_head` | Full finance: AR, AP, invoicing, payroll |
| `finance_viewer` | Read-only access to finance data |
| `hr_head` | Full HR and payroll management |
| `employee` | Operational areas: dashboard, production, inventory, orders |

### 8.5 Permission Keys

Permissions are discrete capabilities checked per route:

```
DASHBOARD_VIEW        DASHBOARD_MFG         DASHBOARD_INVENTORY
ORDERS_VIEW           ORDERS_MANAGE
CRM_VIEW              CRM_MANAGE
PRODUCT_VIEW          PRODUCT_MANAGE
MFG_OPS
SHIPMENTS_VIEW        SHIPMENTS_MANAGE
POS_VIEW
PO_VIEW               PO_CREATE             PO_APPROVE
PO_RECEIVE            PO_CANCEL
INVENTORY_POST        VENDOR_MANAGE
FINANCE_READ          FINANCE_WRITE
HR_FULL
SETTINGS_MANAGE
```

Frontend uses the same constants from `src/lib/permissions.ts` to conditionally render UI elements, providing defense-in-depth (server always re-validates).

### 8.6 Platform Super-Admin

The `super_admin` platform role is separate from tenant-level roles. Super-admins:
- Access the `/platform-admin` panel
- Manage all tenants
- Can switch tenant context via `x-tenant-id` header for support

Super-admin routes are protected by `superAdminGuardrails.js` middleware, which enforces an IP allowlist and an optional step-up password for destructive operations.

---

## 9. Multi-Tenancy

### 9.1 Tenant Isolation Model

Factory Flow uses a **shared database, shared schema** approach with `tenantId`-based row-level isolation:

- All business documents include `tenantId: ObjectId`
- The `withTenant` middleware sets `req.tenantId` from the JWT or `x-tenant-id` header
- All service functions accept `tenantId` and include it in every MongoDB query
- `utils/tenantQuery.js` provides helpers that enforce this automatically

### 9.2 Tenant Lifecycle

```
provisioned → trial → active → suspended → archived
                  ↑                  ↑
         (trial expires)     (payment failure / manual)
```

- **Trial**: Full access for `TRIAL_DEFAULT_DAYS` (configurable). Auto-suspend when expired if `TRIAL_AUTO_SUSPEND_ENABLED=true`.
- **Active**: Paid subscription; full access.
- **Suspended**: API returns 402/403 for all business routes. Read-only data export may be allowed.
- **Archived**: Soft-deleted; data retained for compliance.

### 9.3 Feature Flags

Each tenant document carries module flags that can enable or disable specific ERP modules (e.g., `pos`, `globalTrade`, `qualityManagement`). The `TenantModuleRoute` frontend component and `utils/tenantModules.js` backend utility enforce these gates.

---

## 10. API Design

### 10.1 Response Envelope

All API responses use a consistent JSON envelope:

**Success:**
```json
{
  "success": true,
  "data": { }
}
```

**Success (list):**
```json
{
  "success": true,
  "data": [ ]
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human-readable error description",
  "statusCode": 400
}
```

### 10.2 Common HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error or bad request |
| 401 | Missing or invalid JWT |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state mismatch) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### 10.3 Rate Limiting

| Limiter | Endpoint Scope | Purpose |
|---|---|---|
| `loginLimiter` | `POST /api/auth/login` | Brute-force protection |
| `inviteCompleteLimiter` | `POST /api/auth/complete-invite` | Token abuse prevention |
| `apiLimiter` | All `/api/*` routes | General API protection |
| `platformLimiter` | `/api/platform/*` | Admin endpoint protection |

Window sizes and max request counts are configurable via `RATE_LIMIT_*` environment variables.

### 10.4 Webhook Security

Payment webhooks from Stripe and Chapa are verified using HMAC-SHA256 signature validation in `utils/webhookSecurity.js`. Each webhook event is recorded in the `WebhookEvent` collection with its idempotency key, preventing duplicate processing on replay.

---

## 11. Ethiopia-Specific Compliance

Factory Flow includes deep integration with Ethiopian business rules:

### 11.1 Tax Compliance

| Feature | Implementation |
|---|---|
| VAT (15%) | Applied to sales invoices and vendor bills |
| Sales Withholding Tax (WHT) | Deducted from customer payments per Ethiopian WHT schedule |
| Purchase WHT | Withheld from vendor payments |
| TIN validation | Client and vendor TIN (Tax Identification Number) stored and validated |
| Withholding Certificates | Generated as proof of WHT remittance |
| VAT registration | Client VAT registration status tracked for zero-rate eligibility |

**Service:** `services/finance/ethiopiaTaxService.js`

### 11.2 Payroll Tax

Ethiopian income tax brackets and pension contribution rules are implemented in `services/hr/ethiopiaPayrollService.js`:

- Progressive income tax schedule per Ethiopian tax law
- Employee pension (7%) and employer pension (11%) contributions
- Net pay calculation after all statutory deductions
- Payroll journal entries to GL

### 11.3 Ethiopian Calendar

`utils/ethiopianDate.js` and the `ethiopian-calendar-new` package provide:
- Ethiopian date display alongside Gregorian dates
- Date picker support in the LocaleContext
- Payroll period month labeling in Ethiopian calendar notation

### 11.4 Local Payment Provider

**Chapa** (Ethiopian payment gateway) is integrated alongside Stripe:
- Webhook handling in `billingWebhookController.js`
- Payment intent creation via `paymentService.js`
- Provider selection per tenant billing configuration

---

## 12. Security

### 12.1 Security Layers

| Layer | Mechanism |
|---|---|
| Transport | HTTPS enforced in production (see `docs/DEPLOYMENT.md`) |
| HTTP headers | Helmet (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) |
| CORS | Configurable origin allowlist via `CORS_ORIGIN` env var |
| Authentication | JWT Bearer tokens, bcrypt password hashing |
| Authorization | RBAC middleware on every protected route |
| Tenant isolation | `withTenant` middleware + tenantId-scoped queries |
| Rate limiting | Per-endpoint limiters with configurable windows |
| Input validation | express-validator rules on all mutating endpoints |
| Webhook integrity | HMAC-SHA256 signature verification |
| Webhook idempotency | Deduplication via stored webhook event IDs |
| Super-admin | IP allowlist + step-up password for platform operations |
| Audit trail | `AuditLog` records all master data changes |

### 12.2 Password Security

- Passwords hashed with **bcryptjs** (salt rounds configurable)
- JWT secret minimum 32 characters enforced via documentation
- Invite tokens are single-use and time-limited
- `mustChangePassword` flag prevents new users from skipping the forced password change

### 12.3 Audit Logging

Two audit logs exist:
- **`AuditLog`** — Records create/update/delete on business master data (products, clients, vendors, employees, etc.) with `before` and `after` snapshots
- **`PlatformAuditLog`** — Records super-admin actions (tenant creation, suspension, billing changes)

Both logs are append-only and include `actorId`, `tenantId`, `action`, `resource`, and `timestamp`.

---

## 13. Configuration & Environment

### 13.1 Backend Environment Variables

**Required:**
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/factory_flow
JWT_SECRET=<minimum-32-char-random-secret>
JWT_EXPIRES_IN=30d
```

**Optional — Security:**
```env
JWT_SECRET_PREVIOUS=<old-secret-during-rotation>
SUPER_ADMIN_IP_ALLOWLIST=1.2.3.4,5.6.7.8
SUPER_ADMIN_STEP_UP_REQUIRED=true
SUPER_ADMIN_STEP_UP_PASSWORD=<secure-password>
```

**Optional — Rate Limiting:**
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=10
```

**Optional — Tenant Lifecycle:**
```env
TRIAL_DEFAULT_DAYS=14
TRIAL_AUTO_SUSPEND_ENABLED=true
```

**Optional — Email:**
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<password>
MANAGER_EMAILS=manager@example.com
```

**Optional — Payments:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
CHAPA_SECRET_KEY=...
CHAPA_WEBHOOK_SECRET=...
```

**Optional — Feature Flags:**
```env
AUDIT_LOG_ENABLED=true
CORS_ORIGIN=https://app.example.com
LOG_LEVEL=info
```

### 13.2 Frontend Environment Variables

```env
VITE_API_BASE_URL=http://localhost:5000/api
E2E_BASE_URL=http://127.0.0.1:8080
E2E_API_BASE_URL=http://localhost:5000/api
E2E_USER=admin@example.com
E2E_PASSWORD=password123
```

### 13.3 npm Scripts

**Backend:**
```bash
npm run dev          # Start with nodemon (hot reload)
npm start            # Start production server
npm test             # Run Jest test suite
npm run test:watch   # Watch mode
npm run test:integration   # Integration tests
npm run test:billing # Billing webhook tests
```

**Frontend:**
```bash
npm run dev          # Vite dev server (port 8080, HMR)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:watch   # Watch mode
npm run e2e          # Playwright E2E tests
npm run e2e:ui       # Playwright UI mode
```

---

## 14. Testing

### 14.1 Backend Testing

- **Framework:** Jest with `@jest-environment/node`
- **Database:** `mongodb-memory-server` for unit tests (in-memory MongoDB, no external dependency)
- **Integration tests:** Two-tenant isolation tests that verify tenantId scoping prevents data leakage
- **Billing tests:** Webhook signature verification and idempotency replay tests

### 14.2 Frontend Testing

- **Unit tests:** Vitest + `@testing-library/react` for component logic
- **E2E tests:** Playwright with a live backend and seeded database
- **Test users:** Configurable via `E2E_USER` / `E2E_PASSWORD` environment variables

### 14.3 API Testing

A Postman collection is included at `docs/Factory_Flow_ERP.postman_collection.json` covering all major API endpoints with example request bodies and expected responses.

---

## 15. Deployment

### 15.1 Recommended Stack

| Component | Recommendation |
|---|---|
| Backend hosting | Linux VPS, Docker container, or PaaS (Render, Railway) |
| Frontend hosting | Static hosting (Netlify, Vercel, Nginx) |
| Database | MongoDB Atlas or self-hosted MongoDB with replica set |
| Reverse proxy | Nginx (for HTTPS termination and static file serving) |
| Process manager | PM2 for backend Node.js process management |

### 15.2 Process

See `docs/DEPLOYMENT.md` for full step-by-step instructions including:
- Nginx virtual host configuration with SSL/TLS via Let's Encrypt
- PM2 ecosystem file for backend process management
- Frontend build and static file serving
- MongoDB connection string configuration for Atlas

### 15.3 Backup & Recovery

See `docs/BACKUPS_AND_RESTORE.md` for:
- `mongodump` / `mongorestore` procedures
- Recommended backup schedule
- Point-in-time recovery strategy

### 15.4 CI/CD

See `docs/CI_CD.md` for GitHub Actions pipeline configuration covering:
- Automated test runs on pull requests
- Build verification
- Deployment triggers on merge to `main`

---

## Appendix: Module Dependency Map

```
POS ──────────────────────────────────────────────┐
                                                   │
Sales/Orders ──► Inventory ◄─── Procurement       ▼
      │              │                         Finance/GL
      │              ▼                             ▲
      └──► Production ──► Quality                  │
                │                                  │
                └──► Costing ─────────────────────►┘
                                                   ▲
HR/Payroll ───────────────────────────────────────►┘
```

All modules feed financial postings into the General Ledger (Journal Entries). The Finance module consolidates these for reporting and tax compliance.

---

*This document reflects the state of the codebase as of June 2026. For the most current API reference, consult the Postman collection at `docs/Factory_Flow_ERP.postman_collection.json`.*