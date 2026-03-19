# Order → produce → ship (one page)

How shop floor and office staff run the happy path in **Factory Flow**.

## 1. Master data (one-time per SKU)

1. **Inventory** — Create the **finished good** SKU and each **raw / component** SKU.
2. **BOM** — Define the bill of materials: output = finished good, lines = components and qty per unit. Set status **Active** and effective dates if you use them.

## 2. Customer order

1. **Clients** — Ensure the customer exists.
2. **Orders** — Create an order with lines (product + qty).  
3. **Reserve** line stock (optional but recommended) so ATP stays honest.

## 3. Production job

1. **Production** — Create a job **from the order line** (links job ↔ order) or create a standalone job on a BOM.
2. **Reserve materials** on the job so components are held for that build.
3. Run the job; set status to **Completed** when done.  
   - System **consumes** components per BOM × qty and **adds** finished goods to stock.  
   - If stock is short, completion is blocked — fix stock or BOM first.

## 4. Ship & bill

1. **Shipments** (warehouse) — **New shipment** → pick order line(s) and qty → **Picked** → **Packed** → **Ship** (carrier + tracking). Partial shipments are supported.
2. **Finance** — **Invoice from order**: if the order already has **shipped** packages, select the **shipment** to bill; otherwise one full-order invoice. **AP & vendors** tab for payables; **Export CSV** for AR/AP/orders/inventory/production.
3. **Settings → Audit log** (Admin / finance) — compliance trail when `AUDIT_LOG_ENABLED=true` on the server.

## 5. Purchasing (if you buy parts)

**Purchase orders** — Draft → **Approve** → **Receive**. Receiving puts stock in and ties to the PO.

---

**Roles (summary)** — Purchasing approves POs; warehouse receives and can post manual adjustments; finance invoices; see **Settings → Access** for the full matrix.
