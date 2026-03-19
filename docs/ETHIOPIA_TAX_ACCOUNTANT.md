# Ethiopia tax — accountant CSV mapping

Exports: **Finance → Ethiopia tax CSV** (date range `from` / `to`), or:

- `GET /api/finance/reports/ethiopia/vat-sales.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/finance/reports/ethiopia/vat-purchases.csv?from=...&to=...`
- `GET /api/finance/reports/ethiopia/withholding-sales.csv?from=...&to=...`
- `GET /api/finance/reports/ethiopia/withholding-purchases.csv?from=...&to=...`

All amounts are as stored in the system (currency field in **Settings → Ethiopia tax**).

## VAT sales (`vat-sales`)

| Column | Meaning |
|--------|---------|
| `invoiceId` | Document reference |
| `invoiceDate`, `dueDate` | Dates (Gregorian) |
| `invoiceDate_ethiopian` | Same row, Ethiopian date (DD/MM/EC year) |
| `buyerName`, `buyerTIN` | Customer |
| `taxableAmount_ETB` | Taxable base (ex-VAT) |
| `vatRate_pct`, `outputVat_ETB` | Output VAT |
| `salesWithholding_ETB` | WHT withheld by buyer |
| `grossBeforeWht_ETB` | Taxable + VAT |
| `netReceivable_ETB` | Amount after sales WHT |
| `mapTo_vat_return` | Hint for VAT return lines |

## VAT purchases (`vat-purchases`)

| Column | Meaning |
|--------|---------|
| `billNumber`, `billDate` | Vendor bill (Gregorian) |
| `billDate_ethiopian` | Ethiopian date |
| `vendorName`, `vendorTIN` | Supplier |
| `supplyType` | `local_vat_registered` / `local_unregistered` / `import` |
| `taxableAmount_ETB`, `inputVat_ETB` | Purchase base & recoverable input VAT |
| `vatRecoverable_YN` | Y/N |
| `grossPayable_ETB` | Payable incl. VAT |
| `purchaseWithholding_ETB` | WHT you withhold on payment |

## Withholding — sales (`wht-sales`)

Invoices with sales WHT &gt; 0. **Withheld from you** by the customer.

## Withholding — purchases (`wht-purchases`)

Bills with purchase WHT &gt; 0. **You withhold** when paying the vendor.

---

Rates and legal treatment must be confirmed with ERCA and your advisor. E-invoicing integration is planned when requirements stabilize.
