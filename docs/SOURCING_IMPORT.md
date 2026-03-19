# Sourcing & import (Ethiopia)

## Landed cost → inventory (ETB)

Purchase orders support **freight**, **duty**, and **clearing** in **ETB** (functional currency for stock). On **receive**, inventory is valued at:

**Inventory unit cost (ETB)** = (line unit cost × **FX → ETB**) + **landed per unit**

Landed pool is split across lines by:

| Method         | Rule                                      |
|----------------|-------------------------------------------|
| `none`         | No landed add; only FX × invoice unit     |
| `by_value`     | Share ∝ `qty × unit cost` (invoice ccy)   |
| `by_quantity`  | Same ETB add per unit for every line      |

Enter landed amounts before or between receives; **each receipt** uses the PO’s **current** freight/duty/clearing. If you add duty after a partial receipt, earlier receipts were valued without that duty—adjust manually if needed.

## Forex

- **Invoice currency**: currency of line unit costs (e.g. USD).
- **FX → ETB**: multiply invoice unit cost to functional ETB before adding landed per unit.
- Example: unit $10, FX 125 → base 1,250 ETB/u; + allocated landed.

## LC tracking (optional)

Fields stored on the PO (reference only for operations; no bank integration):

- `lcReference`, `lcBank`, `lcAmount`, `lcCurrency`, `lcExpiry`

## API

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/purchase-orders` | Body: `supplyType`, `importFreight`, `importDuty`, `importClearing`, `landedCostAllocation`, `invoiceCurrency`, `fxRateToFunctional`, LC fields |
| PATCH | `/api/purchase-orders/:id/sourcing` | Update landed/FX/LC for `draft`, `approved`, or `partial_received` |
| GET | `/api/purchase-orders` / `:id` | Includes `landedCostPoolTotal`, `lineInventoryCosts[]` preview |

Permission: `PO_CREATE` for create/update sourcing; receive unchanged.

## UI

**Procurement → New PO**: supply type, landed allocation, invoice CCY, FX, ETB charges, LC.

**PO detail → Edit landed cost, FX & LC**: same fields after approval.

**Receive**: shows **Inv. cost/unit (ETB)** per line before posting.
