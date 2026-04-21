# Factory Flow ERP - Client Workflow Guide

## Purpose

This document explains how a **company (tenant)** uses the ERP from first access through daily operations and reporting. Data in the app is **scoped per company**: users belong to one tenant, and the API carries that scope on every request.

---

## 1) How access works

### Login

1. Open **`/login`**.
2. Sign in with **email** or **employee ID** and password (one identifier field: if it contains `@`, it is treated as email).
3. The app stores a session token and loads your profile from **`/auth/me`** on refresh so stale sessions are cleared safely.

### First-time / onboarding

- **Invite link:** New admins may receive a link to **`/invite`** to set their password and complete setup.
- **Temporary password:** If onboarding used a one-time password, the app sends you to **`/account/change-password`** after login until you choose a new password.

### Company scope and API

- Each user has a **`tenantId`** (company). The client sends **`x-tenant-id`** on API calls so all reads and writes stay inside that company.
- **Platform super admins** (`platformRole: super_admin`) can switch **which company** they are working in via the tenant switcher; that choice is stored locally and continues to send the correct **`x-tenant-id`**.

### What you see in the app (roles and routes)

**Role model**

- **`Admin`:** Full access inside the company (including all permission checks used by the UI).
- Other roles use a combination of **role** and optional **`permissions`**; non-admins only see sidebar entries they are allowed to use.

**Route-level restrictions (important for training)**

| Area | Path | Who can open it (by role) |
|------|------|---------------------------|
| HR | `/hr` | `Admin`, `hr_head`, `finance_head` |
| Finance | `/finance` | `Admin`, `finance_head`, `finance_viewer` |
| Shipments | `/shipments` | `Admin`, `warehouse_head`, `finance_head`, `finance_viewer`, `purchasing_head` |

**Typical role names** (same as in the product)

- `Admin` — full company configuration and operations.
- `hr_head` — HR and payroll.
- `finance_head` — full finance actions.
- `finance_viewer` — finance visibility and reporting (limited write).
- `purchasing_head` — purchase orders and procurement.
- `warehouse_head` — receiving, stock movement, shipping.
- `employee` — operational areas (e.g. dashboard, production, orders, inventory, POs) **without** HR/Finance/Shipments unless permissions are extended.

**Navigation (authenticated)**

- Dashboard **`/`**, Production **`/production`**, Production jobs **`/production-jobs`**, BOMs **`/boms`**, Orders **`/orders`**, Clients **`/clients`**, Inventory **`/inventory`**, Purchase orders **`/purchase-orders`**, SME bundle **`/sme-bundle`**, **Settings** **`/settings`**, **Profile** **`/profile`**.
- **Platform** **`/platform`** (and tenant detail **`/platform/tenants/:id`**) appears only for **`super_admin`** — normal client users never use this.

### Subscription and status (tenant)

- For regular users, **trial / active / suspended** information may appear on the **dashboard** and under **Settings**, with optional **status reasons** when the company is suspended or archived.
- **Super admins** are not shown the same subscription banner in the UI when acting as platform operators.

### Subscription self-payment (Chapa)

If your company is on **trial** or becomes **suspended** due to billing, company administrators can pay directly in-app:

1. Go to **Settings** (`/settings`).
2. In the **Subscription status** card, click **Pay with Chapa** (visible to `Admin` and `finance_head`).
3. Complete checkout in Chapa.
4. After Chapa returns you to the app, the system verifies the transaction and activates your subscription (tenant status becomes **Active**).

Notes:

- The system verifies payment using the transaction reference (`tx_ref`) returned from Chapa.
- If payment is not yet completed, the app will show a “not completed yet” message and you can retry from the same Settings page.

### Announcements

- A top-of-app **banner** can show **company-specific** or **global** messages (maintenance, warnings, info), loaded from the announcements API. Users can dismiss a banner for the current browser session.

---

## 2) Core end-to-end business flow

### Step A - Master data setup (initial)

Set up core records before transactions (all under your company’s data):

- Products/SKUs (**Inventory**)
- BOMs (**BOMs**)
- Clients (**Clients**)
- Employees and roles (via **HR** / admin processes as your deployment defines)
- Vendors (for AP and PO flow — **Finance** / procurement)
- Ethiopia tax settings where applicable (**Settings** / finance configuration as deployed)

### Step B - Sales order intake

1. Open **Orders** (`/orders`).
2. Create an order and line items.
3. Track status (`pending`, `processing`, `shipped`, `delivered`, `cancelled`).

System support:

- Demand/supply visibility (MRP suggestions).
- Reserve finished goods from stock.
- Create a linked production job from an order line.

### Step C - Production planning and execution

1. Open **Production jobs** (`/production-jobs`) and/or **Production** (`/production`).
2. Create or sync a job from BOM and routing.
3. Reserve BOM materials for the job.
4. On the shop floor, update operation progress (start, labor time, scrap/rework, complete).
5. Complete the job to drive inventory posting.

### Step D - Procurement and receiving

1. Open **Purchase orders** (`/purchase-orders`).
2. Create a PO draft with lines and costs.
3. Add sourcing details when needed (local/import, FX to ETB, freight/duty/clearing, LC reference where applicable).
4. Approve the PO.
5. Receive full or partial quantities with lot/batch details.
6. Stock ledger updates after receipt.

### Step E - Inventory control

1. Open **Inventory** (`/inventory`).
2. Monitor levels and low-stock signals.
3. Post manual movements if needed: receipt, issue, adjustment.
4. Use movement history for audit and traceability.

### Step F - Shipping and fulfillment

1. Open **Shipments** (`/shipments`) — *roles allowed: see table in §1*.
2. Create a shipment from an order line (partial shipment supported).
3. Move status: `draft` → `picked` → `packed` → `shipped`.
4. Add carrier and tracking; print delivery note where supported.

### Step G - Finance operations

1. Open **Finance** (`/finance`) — *roles allowed: see table in §1*.
2. Record and monitor invoices, expenses, AR aging, AP/vendor bills and payments.
3. Create invoices from order/shipment flow where integrated.
4. Generate exports (AR/AP, orders, inventory, production, Ethiopia VAT/withholding CSV as available).
5. Print tax invoice where required.

### Step H - HR and payroll

1. Open **HR** (`/hr`) — *roles allowed: see table in §1*.
2. Manage employees, departments, and status.
3. Maintain attendance.
4. Run payroll by month: prepare run, adjust overtime/allowances/deductions, calculate and save.
5. Export pension/income tax CSVs; print payslips; mark payment status.

---

## 3) Recommended daily operations by team

### Sales / operations

- Create and monitor orders (`/orders`).
- Coordinate make-vs-stock decisions with production and inventory.

### Production

- Run jobs and operations (`/production-jobs`, `/production`).
- Keep statuses current for planning.

### Purchasing

- Create and track POs (`/purchase-orders`).
- Maintain supplier sourcing details.

### Warehouse

- Receive materials and post movements (`/inventory`, `/purchase-orders`).
- Process shipments when the role allows (`/shipments`).

### Finance

- Maintain ledger work (`/finance`).
- Track AR/AP aging and statutory exports.

### HR

- Maintain employee master and attendance (`/hr`).
- Run monthly payroll and exports.

### Company administrators

- Use **Settings** (`/settings`) for company preferences, integrations, and subscription visibility (as exposed for your tenant).
- Use **Profile** (`/profile`) for the signed-in user.

---

## 4) New client demo script (10–15 minutes)

1. Log in as **Admin** (or complete **`/invite`** / password change if demoing onboarding).
2. Confirm **Settings** and dashboard show the correct **company** and subscription/trial if applicable (optionally demo **Pay with Chapa** if using self-serve billing).
3. Create one client, one product, and one BOM.
4. Create a sales order; show MRP and create a linked production job.
5. Reserve materials and update one operation on the job.
6. Create PO draft → approve → receive partial.
7. Open **Shipments** (with an allowed role) → create shipment → mark shipped.
8. Create invoice from order/shipment (Finance).
9. Open AR aging (Finance).
10. Open HR payroll run and export a payroll CSV.

---

## 5) Key value for clients

Factory Flow ERP connects one workflow across the company:

**Order → Planning → Production → Inventory → Shipment → Finance → HR payroll**

Multi-tenant design keeps each **company’s** data separate; **roles** and **permissions** control who can open each module; **platform super admins** manage tenants and cross-company operations without mixing normal client workflows.