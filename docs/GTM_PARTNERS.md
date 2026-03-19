# Go-to-market: partners, accountants, hosting

## Accountant-friendly exports

Most CSV/HTML exports use **Bearer** authentication (same token as the web app). Typical files partners ask for:

| Topic | Where |
|-------|--------|
| VAT sales / purchases, withholding | Finance → Ethiopia tax CSVs (see `docs/postman` and finance routes) |
| Tax invoice (print) | Invoice → tax invoice HTML |
| Payroll — pension & PAYE register | HR → Payroll → Pension CSV / Income tax CSV (`docs/ETHIOPIA_PAYROLL.md`) |
| Inventory valuation | API `GET /api/inventory/valuation` (export via Postman or future UI) |
| AP aging | Finance / AP (`GET /api/finance/ap-aging`) |
| Purchase orders / receipts | Procurement screens + API |

**Postman:** `docs/postman/Factory-Flow-API.postman_collection.json` — import and set `baseUrl` + login token for repeatable accountant runs.

## Training outline (suggested)

1. Login, roles, and **SME package** page (`/sme-bundle`).
2. **Inventory** — create SKU, post opening balance or receipt, issue to production.
3. **Purchasing** — draft PO, approve, receive (and optional landed cost for imports).
4. **Production** — BOM, create job, complete operations (as applicable).
5. **Finance** — client TIN, invoice from order, tax invoice, CSV for ERC.
6. **Offline** — demonstrate queued receive/issue and **Sync now** when back online.

## Hosting in-region

- Deploy **backend** and **frontend** on a VPS or managed service in **Addis** or preferred region for latency and data residency conversations.
- Use **MongoDB** Atlas region matching the app, or self-hosted Mongo on the same network.
- Set `VITE_API_BASE_URL` on the frontend build to the public API URL; enable **HTTPS** and CORS for that origin.
- For air-gapped sites, offline queue still helps the **browser**; the API must be reachable for sync.

## Partner collateral

- `docs/SME_BUNDLE.md` — scope statement for proposals.
- `docs/ORDER_TO_SHIP_USER_GUIDE.md` — order-to-cash path where applicable.
