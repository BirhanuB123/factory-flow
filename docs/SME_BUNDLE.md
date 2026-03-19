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

The web app queues **PO receive** and **inventory manual movements** (receipt/issue) in the browser when offline or on network failure. When the device is online again, the amber **Sync** bar processes the queue (FIFO). *Requires the user to stay logged in with a valid session when sync runs.*

## Where to start in the app

Use **SME package** in the sidebar (`/sme-bundle`) for links into each module.
