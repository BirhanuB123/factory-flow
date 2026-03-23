# Multi-tenant (Phase 1 + Phase 2)

## Phase 1 (core)

- `Tenant` model (`models/Tenant.js`)
- `tenantId` on **Employee**, **Product**, **Client**, **Order** (required)
- Composite unique indexes: `(tenantId, sku)` on products, `(tenantId, employeeId)` on employees
- `platformRole`: `none` | `super_admin` on **Employee**
- JWT payload includes `tenantId` and `platformRole`
- `withTenant` middleware (`middleware/tenantMiddleware.js`) after `protect` on all `/api/*` routes
- Super admin may switch company with header **`x-tenant-id`** (Mongo ObjectId of tenant)

## Phase 2 (full app scoping)

- `tenantId` (required) on: **BOM**, **ProductionJob**, **StockMovement**, **StockReservation**, **PurchaseOrder**, **Shipment**, **Invoice**, **Expense**, **Vendor**, **VendorBill**, **VendorPayment**, **CogsEntry**, **WithholdingCertificate**, **TaxSettings** (per-tenant `key: 'default'`), **Attendance**, **Payroll**, **AuditLog**, **ApprovalRequest**, **SavedView**, **Notification**, **WorkCenter**, **Asset**, **PmSchedule**, **DowntimeEvent**, **QualityInspection**, **NonConformance**
- Per-tenant unique indexes (e.g. `(tenantId, poNumber)`, `(tenantId, invoiceId)`, …)
- Services: `applyMovement` / reservations / production posting / audit / `getTaxSettings(tenantId)` all tenant-aware
- Controllers use `byTenant(req)` (from `utils/tenantQuery.js`) for reads/writes; creates set `tenantId: req.tenantId`
- **Traveler HTML** (`/api/production/traveler/:token.html`) stays **unauthenticated**; `travelerToken` remains **globally** unique (sparse index)

## Migration (existing database)

From the `backend` folder:

```bash
npm run migrate:tenant
```

This creates/finds tenant `key: default`, backfills `tenantId` on all Phase 1 + Phase 2 collections, and attempts to drop legacy global-unique indexes (see `scripts/ensureDefaultTenant.js`).

Restart the API after migration.

## Super admin (optional)

In MongoDB, set one user:

```js
db.employees.updateOne(
  { employeeId: "YOUR_ID" },
  { $set: { platformRole: "super_admin" } }
)
```

Then use `x-tenant-id` on requests to act inside a specific tenant (or rely on that user’s default `tenantId`).

**After changing `platformRole` in MongoDB:** log out and sign in again (or hard-refresh after clearing `erp_token` / `erp_user`) so the JWT and UI see `super_admin`.

**If Platform / tenant switcher still don’t appear:**

1. In DevTools → Application → Local Storage, open `erp_user` and confirm `"platformRole":"super_admin"` (exact string).
2. Ensure login uses the same API as the app: set `VITE_API_BASE_URL` in `.env` for the frontend (e.g. `http://localhost:5000/api`) so **Login** and **axios** hit the same database where you updated the employee.
3. Confirm the update ran on the **`employees`** collection the API uses (`MONGODB_URI` / database name).

## Frontend

`erp_user` / API client should send **`x-tenant-id`** when the logged-in user has `tenantId` (already wired in Phase 1).

## Phase 3 (platform console + audit + act-as)

- **UI:** Route `/platform` (sidebar **Platform** + user menu), visible only when `platformRole === 'super_admin'`. Per-tenant **`/platform/tenants/:tenantId`**: profile, counts, user sample, status, **Work in this company** (sets act-as + goes to dashboard).
- **Cross-tenant search (super admin):** `GET /api/platform/tenants?q=<key-or-name>` filters by tenant `key`, `displayName`, or `legalName` (case-insensitive) so platform UI can quickly find and jump into tenant context.
- **Announcements / maintenance banners:** tenant-level announcement is stored on `Tenant.announcement`; global fallback is stored in `PlatformSettings.globalAnnouncement`.
  - Super admin endpoints: `GET /api/platform/announcement`, `PATCH /api/platform/announcement`
  - Tenant-level update: `PATCH /api/platform/tenants/:id` with `announcement`
  - Runtime banner endpoint (authenticated): `GET /api/announcements/current` (tenant announcement overrides global)
- **Tenant switcher:** Header control stores override in `localStorage` key `erp_act_as_tenant_id`; axios sends **`x-tenant-id`** via `getEffectiveTenantIdForRequest()` (super admin: act-as wins, else profile `tenantId`).
- **Backend:** `PlatformAuditLog` model; writes on tenant create, status change, tenant-admin create, and **`PATCH /api/platform/tenants/:id`** (profile fields + **`moduleFlags`**). **`GET /api/platform/audit-logs`** (super admin only): query **`action`**, **`dateFrom`** / **`dateTo`** (UTC day `YYYY-MM-DD` or ISO), **`limit`** / **`skip`**. **`GET /api/platform/audit-logs/export`** same filters → CSV (UTF‑8 BOM, **`maxRows`** default 5000, cap 10000).
- **Tenant health (platform list):** includes `health.lastApiActivityAt`, `health.statusReason`, `health.adminCount`, `health.zeroAdmins`, and aggregated `health.documentCounts` / `health.totalDocuments`; status updates accept optional `statusReason` (auto-cleared when status returns to `active`/`trial`).
- **Plans & trials:** `Tenant` includes `trialEndDate`; trial creation defaults from `TRIAL_DEFAULT_DAYS` (default `14`). Endpoint **`PATCH /api/platform/tenants/:id/trial`** extends/resets trial (`extendDays` or explicit `trialEndDate`). Background scheduler (`TRIAL_AUTO_SUSPEND_ENABLED`, `TRIAL_AUTO_SUSPEND_INTERVAL_MS`) auto-suspends expired trial tenants and writes platform audit action `tenant.trial.auto_suspend`.
- **Billing mapping + webhook plan sync:** `Tenant` now includes `billingProvider` (`none|manual|stripe|other`) and `billingCustomerId`. You can patch these via **`PATCH /api/platform/tenants/:id`**. Public webhook **`POST /api/billing/webhook/sync`** (header `x-billing-webhook-secret`) can sync `plan`/`status`/billing fields by `tenantId`, `tenantKey`, or `billingCustomerId` and writes audit action `tenant.billing.sync`.
- **Stripe signature + lifecycle mapping:** signed webhook **`POST /api/billing/webhook/stripe`** validates `Stripe-Signature` using raw body + `STRIPE_WEBHOOK_SECRET`. Implemented event mapping:
  - `invoice.payment_failed` → tenant `status: suspended` + reason; updates billing fields and optional plan from Stripe price mapping.
  - `customer.subscription.updated` → maps Stripe status (`trialing|active|past_due|unpaid|incomplete_expired|canceled`) to tenant status/reason; syncs plan + trial end date.
  - `customer.subscription.deleted` → tenant `status: suspended` + cancellation reason.
- **Super-admin guardrails (optional):**
  - `SUPER_ADMIN_IP_ALLOWLIST` (comma-separated IPs, supports simple wildcard suffix like `10.0.*`) limits all `/api/platform/*` access.
  - `RATE_LIMIT_PLATFORM_MAX` applies a stricter per-minute limiter on `/api/platform/*` (default `120`).
  - `SUPER_ADMIN_STEP_UP_REQUIRED=true` requires `x-step-up-password` header for destructive platform actions (`POST`/`PATCH`/`PUT`/`DELETE`).
- **Tenant `moduleFlags`:** `Tenant` schema includes per-module booleans (`manufacturing`, `inventory`, `sales`, `procurement`, `finance`, `hr`, default `true`). **`utils/tenantModules.js`** exports **`requireTenantModule('hr')`** etc. — add to `app.js` after `withTenant` on routes you want to hard-block (not wired globally yet). Run **`npm run migrate:tenant`** to backfill `moduleFlags` on existing tenants.
- **Tests:** `npm run test:integration` for real DB isolation; full unit suite `npm test` (mocks include `PlatformAuditLog` where needed).

## Safer tenant admin onboarding (invite / temp password)

When creating a tenant admin from the platform console, **`POST /api/platform/tenants/:tenantId/admin`** accepts **`onboardingMode`**:

| Mode | Behavior |
|------|----------|
| **`invite_link`** (recommended) | Requires **`email`**. Server stores a random bootstrap password, sets a hashed invite token + expiry, returns **`invite.url`** (frontend origin + `/invite?token=…`, from **`FRONTEND_URL`** or **`APP_PUBLIC_URL`**). If SMTP is configured, sends the link by email. |
| **`temp_password`** | Generates a one-time **`temporaryPassword`** in the JSON response; user has **`mustChangePassword: true`** and must set a new password after login. |
| **`manual`** | Legacy: you supply **`password`** in the request body. |

**Environment (backend `.env`):**

- **`APP_PUBLIC_URL`** or **`FRONTEND_URL`** — base URL for invite links (default `http://localhost:5173` in dev).
- **`INVITE_TOKEN_VALID_DAYS`** — invite expiry (default `7`, clamped `1`–`30`).
- **Optional email (Nodemailer):** set **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, and **`SMTP_FROM`** (optional **`SMTP_SECURE=true`** for implicit TLS). If **`SMTP_HOST`** is unset, the API still returns **`invite.url`** for manual copy.

**Public endpoints:**

- **`POST /api/auth/complete-invite`** — `{ token, newPassword }` completes setup and clears the invite token.
- **`PUT /api/auth/password`** — authenticated **`{ currentPassword, newPassword }`** (used for forced change when **`mustChangePassword`** is true).

**Frontend:** public route **`/invite`**; after login with **`mustChangePassword`**, users are redirected to **`/account/change-password`**.
