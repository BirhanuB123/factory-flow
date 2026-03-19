# Manufacturing depth (Phase 3 foundation)

## Shop floor — work order operations

- Each **production job** gets **operations** from the BOM **routing** (or a default single “Assembly” step).
- **Production → job detail**: start / complete operation, **log labor minutes**, **scrap/rework** quantities.
- **Sync ops from BOM** rebuilds steps from the current BOM routing (e.g. after engineering change).
- **Traveler** (print): `GET /api/production/traveler/:token.html` — **unauthenticated**; token is secret. QR reopens the same URL. Protect in production (VPN / internal host) if needed.

### API

| Method | Path |
|--------|------|
| POST | `/api/production/:id/sync-operations` |
| POST | `/api/production/:id/operations/:opIndex/start` |
| POST | `/api/production/:id/operations/:opIndex/complete` |
| POST | `/api/production/:id/operations/:opIndex/time` body `{ minutes, note? }` |
| POST | `/api/production/:id/operations/:opIndex/scrap-rework` body `{ scrapQty?, reworkQty? }` |

## BOM routing

- **BOM detail** in UI: **Routing** — sequence, code, name, work center, setup min, run min/unit, **lead time days** (per BOM level for MRP).

## Lot traceability

- **PO receive**: optional **Lot #** and **Batch** per line → stored on **stock movements** (`lotNumber`, `batchNumber`).
- Manual **inventory receipt/issue** accepts `lotNumber`, `batchNumber` in the body.
- **Shipment lines** schema supports `lotNumber` (populate when building shipments from lots — UI next).

## Quality (API)

- `GET/POST /api/manufacturing/inspections` — `incoming` | `in_process` | `final`, link PO line or job.
- `PUT /api/manufacturing/inspections/:id`
- `GET/POST /api/manufacturing/non-conformances` — NC number auto, **CAPA** fields (`capaStatus`, `capaNotes`).
- `PUT /api/manufacturing/non-conformances/:id`

## Maintenance (light CMMS)

- **Work centers**: `GET/POST /api/manufacturing/work-centers`
- **Assets**: `GET/POST /api/manufacturing/assets`
- **PM schedules**: `GET/POST /api/manufacturing/pm-schedules`, complete: `POST .../pm-schedules/:id/complete`
- **Downtime**: `GET/POST /api/manufacturing/downtime`, end: `POST .../downtime/:id/end`

## Planning — multi-level explosion

- `GET /api/mrp/explode/:productId?qty=1&maxDepth=10`
- Returns flat **lines** (make vs buy) and **criticalPathLeadDays** (sum of routing `leadTimeDays` on the longest chain).

## Next steps (not done yet)

- Barcode scan → operation confirm (mobile).
- FEFO/FIFO by lot on issue.
- Finite capacity scheduling (work center calendars).
- Full NC/CAPA workflow UI.
