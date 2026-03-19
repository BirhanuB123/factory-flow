# Localization (Ethiopia-oriented)

## ETB (Birr) first

- **Default currency** in Settings is **ETB (Br)**. Facility currency drives `useCurrency()` app-wide.
- Amounts use **`Intl.NumberFormat`** with `en-ET` for ETB (comma grouping, sensible decimals).
- **Finance**, **Orders**, **HR payroll**, **Purchase orders** (est. totals), **Finance metrics**, and related screens use the shared formatter.

## UI languages

Under **Settings → Facility → Regional**:

- **UI language**: English, **አማርኛ (Amharic)**, or **Afaan Oromo** — affects **sidebar** labels and ERP subtitle.
- **Ethiopian dates**: when enabled, list views show **Gregorian + Ethiopian calendar** (e.g. `18/03/2026 · 09/07/2018 EC`).

More screens can be wired to the same `translations` map over time.

## Printed / HTML documents

| Document | Route / action |
|----------|----------------|
| **Tax invoice** | Finance → tax icon; bilingual EN + አማርኛ headings, G.C. + Ethiopian invoice date |
| **Delivery note** | Shipments → document icon; **Delivery note / የመላኪያ ማስረጃ**, line headers EN + Amharic, dual calendar on print |

Fonts: **Noto Sans Ethiopic** (Google Fonts) on generated HTML for Amharic.

## Statutory CSV (Ethiopia tax)

VAT sales/purchase exports include:

- `invoiceDate_ethiopian` / `billDate_ethiopian` — **DD/MM/EC year** for accountant cross-reference.

## Dependencies

- Frontend & backend: `ethiopian-calendar-new` (Gregorian ↔ Ethiopian).
