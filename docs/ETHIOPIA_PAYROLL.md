# Ethiopia HR & payroll (statutory)

## What’s implemented

- **Pension (private org)**: employee **7%**, employer **11%** on **pensionable base** (basic + transport allowance in app). Align with Proclamation 1268/2022 and agency guidance.
- **Income tax (PAYE)**: monthly progressive schedule (rate + quick deduction). **Verify bands** with Ethiopian Revenue Customs (ERC) — schedules change.
- **Transport**: first **600 ETB** of transport allowance excluded from taxable income (common treatment).
- **Overtime**: hourly rate = basic ÷ **208** (8×26). **Weekday extension 1.25×**, **rest/holiday 1.5×** (typical Labour Proclamation reading — confirm for your sector).
- **Payslip**: printable HTML per payroll record.
- **Exports**: CSV for **pension** (bases + 7% + 11%) and **income tax** register (TIN, taxable income, tax withheld, net).

## Employee master

- **TIN**, **pension member ID** (optional) on employee — used on exports and payslip.
- **Salary** (monthly basic ETB) required for payroll run.

## API (HR role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/hr/payroll/preview` | Body: `{ employee, transportAllowance?, overtimeNormalHours?, overtimeRestHolidayHours?, ... }` |
| GET | `/api/hr/payroll/prepare?month=YYYY-MM` | Active + On Leave staff and existing month lines (for the run UI) |
| POST | `/api/hr/payroll/run` | Body: `{ month, entries: [{ employee, basicSalary, transportAllowance?, …, includeInRun? }] }` — processes **only included** rows; **basic salary** can be set per row (fixes staff with no master salary) |
| PATCH | `/api/hr/payroll/record/:id` | `{ paymentStatus: "Paid", paymentDate }` |
| GET | `/api/hr/payroll?month=YYYY-MM` | List (optional filter) |
| GET | `/api/hr/payroll/export/pension?month=YYYY-MM` | CSV |
| GET | `/api/hr/payroll/export/income-tax?month=YYYY-MM` | CSV |
| GET | `/api/hr/payroll/payslip/:id/html` | Payslip |

## Disclaimer

This is **not legal or tax advice**. Use a licensed payroll advisor; confirm rates, caps, and overtime rules before production.

## DB

`Payroll` has a **unique** index on `(employee, month)`. Remove duplicate rows before first deploy if migration fails.
