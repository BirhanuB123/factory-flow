# Welcome to our ERP

## Phase 1 — Inventory ledger & production completion

- **Stock movements**: Every stock change writes a `StockMovement` row and updates `Product.stock` (opening balance, receipt, issue, adjustment, production consume/output).
- **API**: `GET/POST /api/inventory/movements` (authenticated). Product create/edit adjusts stock via the ledger.
- **BOMs** must define **`outputProduct`** (finished-good SKU) and optional **`effectiveFrom` / `effectiveTo`** before a job can be completed.
- **Completing a job** (`status: Completed`): consumes BOM components × job quantity and adds **job quantity** to the output product. Runs once per job (`inventoryPosted`).
- **Reseed DB** (adds FG SKUs + BOM output links + opening-balance movements):

```bash
cd backend && node seeder.js
```

MongoDB **replica set** is optional: on a standalone dev instance, production completion uses a sequential path with rollback on failure.

## Phase 2 — Demand → supply

- **`GET /api/mrp/suggestions`** — Open orders (pending/processing) × BOM lines: ATP, reserved FG per line, job coverage, **suggested make** qty.
- **`POST /api/orders/:orderId/reserve-line`** — Reserve finished good from stock for a line (caps at line qty & available ATP).
- **`POST /api/production/from-order`** — Create a job linked to `order.items[lineIndex].productionJob`; BOM output must match the line SKU.
- **`POST /api/production/:id/reserve-materials`** — Reserve BOM components × job qty (ATP for raw drops for other users).
- **`GET /api/inventory/alerts`** — SKUs where **ATP** (on hand − active reservations) ≤ **reorderPoint** (critical / high / low).
- **`GET/DELETE /api/inventory/reservations`** — List or release a single reservation.
- Delivering or **cancelling** an order **releases** all FG reservations for that order. Cancelling/deleting a job **releases** material reservations.

## Phase 3 — Procurement, finance, access control

- **Purchase orders**: `draft` → **approve** → **receive** (partial OK). Receiving posts **`receipt`** movements tied to `PurchaseOrder` and updates `unitCost` / `lastReceived` when line has unit cost.
- **API**: `GET/POST /api/purchase-orders`, `PUT :id`, `POST :id/approve`, `POST :id/receive`, `POST :id/cancel`.
- **Invoice from order**: `POST /api/finance/invoices/from-order` `{ orderId, dueDate? }` — links `Invoice.order`; one invoice per order.
- **AR aging**: `GET /api/finance/ar-aging` — buckets (not due, 1–30, …, 90+), marks past-due **Pending** as **Overdue**.
- **Permissions** (`backend/config/permissions.js`): **purchasing_head** (PO create/approve/receive/cancel), **warehouse_head** (receive PO, manual inventory post), **finance_head** (unchanged finance routes). **employee**: view PO only; **manual stock movement** = Admin + warehouse only.
- **Auth**: login/`GET /me` return `permissions[]`; `GET /api/auth/permissions` returns matrix doc for **Settings → Access**.
- Reseed adds **buyer@integracnc.com** & **warehouse@integracnc.com** (password123).

## Phase 4 — Hardening, ops, tests, docs

- **Frontend API URL**: `VITE_API_BASE_URL` (see `frontend/.env.example`). Defaults to `http://localhost:5000/api`.
- **Backend env**: copy `backend/env.example` → `.env`. In **production**, `JWT_SECRET` must be ≥32 chars or the server exits. Structured logs (**pino**), **Helmet**, **rate limits** (login + API), JSON body cap.
- **Validation**: login + manual stock movements use **express-validator**.
- **Audit** (optional): `AUDIT_LOG_ENABLED=true` logs product/BOM changes and manual stock movements to `auditlogs`.
- **Tests** (needs MongoDB): `cd backend && npm test` — uses DB `factory_flow_test` or `MONGODB_TEST_URI`. Covers receipt → stock and **job completion → BOM consume / FG output**.
- **Docs**: `docs/DEPLOYMENT.md` (HTTPS/proxy), `docs/BACKUPS_AND_RESTORE.md`, `docs/ORDER_TO_SHIP_USER_GUIDE.md`.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
