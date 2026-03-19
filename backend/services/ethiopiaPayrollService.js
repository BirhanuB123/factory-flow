/**
 * Ethiopia payroll helpers (private org pension + monthly income tax + overtime).
 * Rates/schedules should be verified with ERC / pension agency before production use.
 */

const PENSION_EMPLOYEE_RATE = 0.07;
const PENSION_EMPLOYER_RATE = 0.11;
/** Default hours per month for hourly rate from basic: 8h × ~26 days */
const DEFAULT_MONTHLY_WORK_HOURS = 208;
const OT_WEEKDAY_MULTIPLIER = 1.25;
const OT_REST_HOLIDAY_MULTIPLIER = 1.5;
/** Transport allowance exempt from income tax (ETB/month) — common practice */
const TRANSPORT_TAX_EXEMPT_ETB = 600;

/**
 * Monthly employment income tax (progressive; "rate + quick deduction" form).
 * Schedule per Federal Income Tax Proclamation (verify current bands with ERC).
 */
function monthlyIncomeTaxFromTaxable(taxableMonthly) {
  const x = Math.max(0, Number(taxableMonthly) || 0);
  if (x <= 600) return 0;
  if (x <= 1500) return Math.max(0, x * 0.1 - 60);
  if (x <= 2500) return Math.max(0, x * 0.15 - 135);
  if (x <= 3500) return Math.max(0, x * 0.2 - 260);
  if (x <= 5000) return Math.max(0, x * 0.25 - 435);
  if (x <= 7500) return Math.max(0, x * 0.3 - 685);
  return Math.max(0, x * 0.35 - 1060);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {object} input
 * @param {number} input.basicSalary - monthly basic (ETB)
 * @param {number} [input.transportAllowance]
 * @param {number} [input.otherTaxableAllowances] - bonuses etc. subject to tax & in gross
 * @param {number} [input.overtimeNormalHours] - weekday extension @ 1.25x
 * @param {number} [input.overtimeRestHolidayHours] - rest/holiday @ 1.5x
 * @param {number} [input.otherDeductions] - loans etc. (after tax)
 * @param {number} [input.monthlyWorkHours] - for hourly from basic
 */
function computeEthiopiaPayroll(input) {
  const basic = Math.max(0, Number(input.basicSalary) || 0);
  const transport = Math.max(0, Number(input.transportAllowance) || 0);
  const otherTax = Math.max(0, Number(input.otherTaxableAllowances) || 0);
  const otN = Math.max(0, Number(input.overtimeNormalHours) || 0);
  const otH = Math.max(0, Number(input.overtimeRestHolidayHours) || 0);
  const otherDed = Math.max(0, Number(input.otherDeductions) || 0);
  const hours = Number(input.monthlyWorkHours) > 0 ? Number(input.monthlyWorkHours) : DEFAULT_MONTHLY_WORK_HOURS;

  const hourlyFromBasic = basic > 0 && hours > 0 ? basic / hours : 0;
  const overtimePay = round2(
    otN * hourlyFromBasic * OT_WEEKDAY_MULTIPLIER + otH * hourlyFromBasic * OT_REST_HOLIDAY_MULTIPLIER
  );

  const grossCash = round2(basic + transport + overtimePay + otherTax);

  const pensionableBase = round2(basic + transport);
  const pensionEmployee = round2(pensionableBase * PENSION_EMPLOYEE_RATE);
  const pensionEmployer = round2(pensionableBase * PENSION_EMPLOYER_RATE);

  const transportTaxable = Math.max(0, transport - TRANSPORT_TAX_EXEMPT_ETB);
  const taxableForIncomeTax = Math.max(
    0,
    round2(basic + transportTaxable + overtimePay + otherTax - pensionEmployee)
  );
  const incomeTax = round2(monthlyIncomeTaxFromTaxable(taxableForIncomeTax));

  const netSalary = round2(grossCash - pensionEmployee - incomeTax - otherDed);
  const employerMonthlyCost = round2(grossCash + pensionEmployer);

  return {
    basicSalary: basic,
    transportAllowance: transport,
    otherTaxableAllowances: otherTax,
    overtimeNormalHours: otN,
    overtimeRestHolidayHours: otH,
    hourlyRateFromBasic: round2(hourlyFromBasic),
    overtimePay,
    grossCash,
    pensionableBase,
    pensionEmployee,
    pensionEmployer,
    pensionEmployeeRate: PENSION_EMPLOYEE_RATE,
    pensionEmployerRate: PENSION_EMPLOYER_RATE,
    transportTaxExemptApplied: Math.min(transport, TRANSPORT_TAX_EXEMPT_ETB),
    taxableIncomeForTax: taxableForIncomeTax,
    incomeTax,
    otherDeductions: otherDed,
    netSalary,
    employerMonthlyCost,
    rulesNote:
      'Overtime: weekday extra 1.25×, rest/holiday 1.5× hourly (basic÷hours). Verify with labour rules.',
  };
}

module.exports = {
  computeEthiopiaPayroll,
  monthlyIncomeTaxFromTaxable,
  PENSION_EMPLOYEE_RATE,
  PENSION_EMPLOYER_RATE,
  TRANSPORT_TAX_EXEMPT_ETB,
  DEFAULT_MONTHLY_WORK_HOURS,
};
