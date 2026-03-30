# SME product bundle (go-to-market scope)

**Positioning:** One clear package for small and mid-size factories **before** full APS/MES.

## In scope

| Area | What’s included |
|------|------------------|
| **Inventory** | Products, stock levels, manual receipt/issue/adjustment, movements ledger, low-stock alerts |
| **Purchasing** | Purchase orders, approve, receive to stock, optional import landed cost (freight/duty/clearing) + FX/LC fields |
| **Simple production** | BOMs (with optional routing), production jobs, shop-floor operations — not finite scheduling / full MES |
| **Finance (Ethiopia)** | ETB-first UI, clients/vendors with TIN, VAT/WHT settings, invoices, tax invoice HTML, CSV exports |

## Out of scope (later / enterprise)

- Advanced planning & scheduling (APS), finite capacity, detailed MES
- Full barcode shop-floor (partial support exists)
- Multi-plant orchestration

## Offline / poor connectivity

The web app queues the following warehouse-critical actions in the browser when offline or on network failure:

- **PO receive** (partial/full receiving on purchase orders)
- **Inventory manual movements**: `receipt`, `issue`, and `adjustment`

When the device is online again, the amber **Sync** bar processes the queue in FIFO order.

Operational notes:

- Users should stay logged in while sync runs.
- If one queued item fails (for example server validation), sync pauses on that item and keeps the remaining queue in place.
- Use **Sync now** in the banner after reconnect to manually retry.

## Training path (from workflow guide)

Use this as the SME onboarding sequence for customer training and demos:

1. Master data: Products/SKUs, BOMs, Clients, Vendors
2. Orders: create + track status
3. Production: create/sync job, reserve materials, post progress
4. Procurement: PO draft -> approve -> receive
5. Inventory control: alerts + manual movements + history
6. Shipping: create shipment -> picked/packed/shipped
7. Finance: invoice + AR/AP + exports
8. HR/payroll: attendance + monthly payroll + CSV exports

Reference: `ERP_Client_Workflow_Guide.md`

## End-to-end coverage check

Before go-live, validate one full happy path in your tenant:

`Order -> MRP suggestion -> Production job -> PO receive -> Shipment -> Invoice -> AR aging export`

Recommended acceptance checks:

- Tenant and role scoping: users only see routes they are allowed to open.
- Module toggles: disabled tenant modules return access denied.
- Offline queue: at least one `po_receive` and one inventory movement successfully replay after reconnect.
- Finance output: tax invoice HTML and at least one CSV export generated.

## Where to start in the app

Use **SME package** in the sidebar (`/sme-bundle`) for links into each module.
