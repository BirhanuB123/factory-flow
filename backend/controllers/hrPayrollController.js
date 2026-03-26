const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const JournalEntry = require('../models/JournalEntry');
const PayrollPosting = require('../models/PayrollPosting');
const PayrollMonthClose = require('../models/PayrollMonthClose');
const { computeEthiopiaPayroll } = require('../services/ethiopiaPayrollService');
const { byTenant } = require('../utils/tenantQuery');
const { assertPayrollMonthEditable } = require('../utils/payrollMonthGuard');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Double-entry lines for accrued payroll (employer cost = gross + employer pension).
 * Credits: net pay + withholdings + employer pension + other deductions payable.
 */
function buildPayrollJournalFromRows(rows) {
  let net = 0;
  let pe = 0;
  let tax = 0;
  let pq = 0;
  let od = 0;
  let empCost = 0;
  for (const p of rows) {
    net += Number(p.netSalary) || 0;
    pe += Number(p.pensionEmployee) || 0;
    tax += Number(p.incomeTax) || 0;
    pq += Number(p.pensionEmployer) || 0;
    od += Number(p.otherDeductionsPayroll) || 0;
    empCost += Number(p.employerMonthlyCost) || 0;
  }
  net = round2(net);
  pe = round2(pe);
  tax = round2(tax);
  pq = round2(pq);
  od = round2(od);
  empCost = round2(empCost);
  const credits = round2(net + pe + tax + pq + od);
  if (Math.abs(empCost - credits) > 0.02) {
    empCost = credits;
  }
  const lines = [
    {
      account: '6100 — Payroll expense (employer cost)',
      debit: empCost,
      credit: 0,
      memo: 'Accrued payroll — gross + employer pension',
    },
    { account: '2110 — Net salaries payable', debit: 0, credit: net, memo: 'Net pay to employees' },
    { account: '2120 — Pension withholding (employee)', debit: 0, credit: pe, memo: 'Employee pension share' },
    { account: '2130 — PAYE withheld', debit: 0, credit: tax, memo: 'Income tax withheld' },
    { account: '2140 — Pension accrual (employer)', debit: 0, credit: pq, memo: 'Employer pension share' },
  ];
  if (od > 0) {
    lines.push({
      account: '2150 — Other payroll deductions payable',
      debit: 0,
      credit: od,
      memo: 'Loans / other after-tax deductions',
    });
  }
  const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  return {
    lines,
    totals: {
      employerMonthlyCost: empCost,
      netSalary: net,
      pensionEmployee: pe,
      incomeTax: tax,
      pensionEmployer: pq,
      otherDeductionsPayroll: od,
      headcount: rows.length,
      totalDebit,
      totalCredit,
    },
  };
}

function endOfMonthUtc(yyyyMm) {
  const [ys, ms] = String(yyyyMm).trim().split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return new Date();
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function monthRe(m) {
  return /^\d{4}-\d{2}$/.test(String(m || '').trim());
}

/**
 * POST /api/hr/payroll/preview
 * Body: { employee, basicSalary?, transportAllowance?, overtimeNormalHours?, ... }
 */
exports.previewPayroll = asyncHandler(async (req, res) => {
  const { employee: empId } = req.body;
  if (!empId) {
    return res.status(400).json({ success: false, message: 'employee (id) required' });
  }
  const emp = await Employee.findOne(byTenant(req, { _id: empId }));
  if (!emp) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  const base =
    req.body.basicSalary != null ? Number(req.body.basicSalary) : Number(emp.salary) || 0;
  const calc = computeEthiopiaPayroll({
    basicSalary: base,
    transportAllowance: req.body.transportAllowance,
    otherTaxableAllowances: req.body.otherTaxableAllowances ?? req.body.bonuses,
    overtimeNormalHours: req.body.overtimeNormalHours,
    overtimeRestHolidayHours: req.body.overtimeRestHolidayHours,
    otherDeductions: req.body.otherDeductions,
    monthlyWorkHours: req.body.monthlyWorkHours,
  });
  res.json({
    success: true,
    data: {
      employee: { _id: emp._id, employeeId: emp.employeeId, name: emp.name, tinNumber: emp.tinNumber },
      ...calc,
    },
  });
});

/**
 * GET /api/hr/payroll/prepare?month=YYYY-MM
 * Staff eligible for payroll + existing month lines (for run dialog).
 */
exports.preparePayroll = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month=YYYY-MM required' });
  }
  const m = String(month).trim();
  const emps = await Employee.find(byTenant(req, { status: { $in: ['Active', 'On Leave'] } }))
    .select('employeeId name salary department status tinNumber')
    .sort({ employeeId: 1 })
    .lean();
  const payrolls = await Payroll.find(byTenant(req, { month: m })).lean();
  const byEmp = new Map(payrolls.map((p) => [String(p.employee), p]));

  const rows = emps.map((e) => {
    const ex = byEmp.get(String(e._id));
    return {
      employee: {
        _id: e._id,
        employeeId: e.employeeId,
        name: e.name,
        salary: e.salary ?? 0,
        department: e.department,
        status: e.status,
        tinNumber: e.tinNumber || '',
      },
      basicSalary: ex ? ex.basicSalary : Number(e.salary) || 0,
      transportAllowance: ex?.transportAllowance ?? 0,
      overtimeNormalHours: ex?.overtimeNormalHours ?? 0,
      overtimeRestHolidayHours: ex?.overtimeRestHolidayHours ?? 0,
      otherTaxableAllowances: ex?.otherTaxableAllowances ?? 0,
      otherDeductions: ex?.otherDeductionsPayroll ?? 0,
      includeInRun: true,
    };
  });

  res.json({
    success: true,
    month: m,
    rows,
    hint:
      rows.filter((r) => !r.basicSalary).length > 0
        ? 'Some staff have no basic salary — enter Basic (ETB) in the grid before running.'
        : null,
  });
});

function normalizeEntry(row) {
  return {
    transportAllowance: Math.max(0, Number(row.transportAllowance) || 0),
    otherTaxableAllowances: Math.max(0, Number(row.otherTaxableAllowances ?? row.bonuses) || 0),
    overtimeNormalHours: Math.max(0, Number(row.overtimeNormalHours) || 0),
    overtimeRestHolidayHours: Math.max(0, Number(row.overtimeRestHolidayHours) || 0),
    otherDeductions: Math.max(0, Number(row.otherDeductions) || 0),
    monthlyWorkHours: Number(row.monthlyWorkHours) > 0 ? Number(row.monthlyWorkHours) : undefined,
  };
}

/**
 * POST /api/hr/payroll/run
 * Body: { month, entries?: [{ employee, basicSalary?, includeInRun?, ... }] }
 * If entries is non-empty, only those employees are processed (with per-line basic).
 * If entries omitted/empty, all Active/On Leave with salary > 0 (legacy).
 */
exports.runPayrollMonth = asyncHandler(async (req, res) => {
  const { month, entries } = req.body;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  }
  const m = String(month).trim();
  await assertPayrollMonthEditable(req, m);
  const entryList = Array.isArray(entries) ? entries : [];
  const results = [];
  const skipped = [];

  let toProcess = [];

  if (entryList.length > 0) {
    for (const row of entryList) {
      if (row.includeInRun === false) continue;
      const e = await Employee.findOne(byTenant(req, { _id: row.employee }));
      if (!e || !['Active', 'On Leave'].includes(e.status)) {
        skipped.push({
          employee: row.employee,
          reason: 'Not found or not Active/On Leave',
        });
        continue;
      }
      const basic =
        Number(row.basicSalary) > 0
          ? Number(row.basicSalary)
          : Number(e.salary) || 0;
      if (basic <= 0) {
        skipped.push({
          employeeId: e.employeeId,
          name: e.name,
          reason: 'Basic salary is 0 — set in grid or employee record',
        });
        continue;
      }
      const n = normalizeEntry(row);
      toProcess.push({ employee: e, basicSalary: basic, ...n });
    }
  } else {
    const actives = await Employee.find(
      byTenant(req, {
        status: { $in: ['Active', 'On Leave'] },
        salary: { $gt: 0 },
      })
    );
    for (const e of actives) {
      toProcess.push({
        employee: e,
        basicSalary: Number(e.salary) || 0,
        ...normalizeEntry({}),
      });
    }
  }

  for (const { employee: e, basicSalary, ...row } of toProcess) {
    const calc = computeEthiopiaPayroll({
      basicSalary,
      transportAllowance: row.transportAllowance,
      otherTaxableAllowances: row.otherTaxableAllowances,
      overtimeNormalHours: row.overtimeNormalHours,
      overtimeRestHolidayHours: row.overtimeRestHolidayHours,
      otherDeductions: row.otherDeductions,
      monthlyWorkHours: row.monthlyWorkHours,
    });

    const totalDed = calc.pensionEmployee + calc.incomeTax + calc.otherDeductions;
    let doc;
    try {
      doc = await Payroll.findOneAndUpdate(
        byTenant(req, { employee: e._id, month: m }),
        {
          $set: {
            tenantId: req.tenantId,
            basicSalary: calc.basicSalary,
            bonuses: calc.otherTaxableAllowances,
            deductions: totalDed,
            netSalary: calc.netSalary,
            paymentStatus: 'Pending',
            transportAllowance: calc.transportAllowance,
            otherTaxableAllowances: calc.otherTaxableAllowances,
            overtimeNormalHours: calc.overtimeNormalHours,
            overtimeRestHolidayHours: calc.overtimeRestHolidayHours,
            overtimePay: calc.overtimePay,
            grossCash: calc.grossCash,
            pensionableBase: calc.pensionableBase,
            pensionEmployee: calc.pensionEmployee,
            pensionEmployer: calc.pensionEmployer,
            taxableIncomeForTax: calc.taxableIncomeForTax,
            incomeTax: calc.incomeTax,
            otherDeductionsPayroll: calc.otherDeductions,
            employerMonthlyCost: calc.employerMonthlyCost,
            tinNumberSnapshot: e.tinNumber || '',
            breakdown: calc,
          },
        },
        { upsert: true, new: true }
      )
        .populate('employee', 'name employeeId tinNumber pensionMemberId department')
        .lean();
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Payroll save failed',
        hint: 'Duplicate employee/month or DB error — check MongoDB indexes.',
      });
    }
    results.push(doc);
  }

  res.status(201).json({
    success: true,
    count: results.length,
    skipped,
    data: results,
  });
});

/**
 * PATCH /api/hr/payroll/record/:id
 * Body: { paymentStatus?, paymentDate? }
 */
exports.updatePayrollRecord = asyncHandler(async (req, res) => {
  const existing = await Payroll.findOne(byTenant(req, { _id: req.params.id })).select('month').lean();
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Payroll record not found' });
  }
  await assertPayrollMonthEditable(req, existing.month);
  const { paymentStatus, paymentDate } = req.body;
  const set = {};
  if (paymentStatus && ['Paid', 'Pending', 'Processing'].includes(paymentStatus)) {
    set.paymentStatus = paymentStatus;
  }
  if (paymentDate !== undefined) {
    set.paymentDate = paymentDate ? new Date(paymentDate) : null;
  }
  if (Object.keys(set).length === 0) {
    return res.status(400).json({ success: false, message: 'paymentStatus or paymentDate required' });
  }
  const p = await Payroll.findOneAndUpdate(byTenant(req, { _id: req.params.id }), { $set: set }, {
    new: true,
  })
    .populate('employee', 'name employeeId department')
    .lean();
  if (!p) {
    return res.status(404).json({ success: false, message: 'Payroll record not found' });
  }
  res.json({ success: true, data: p });
});

/**
 * GET /api/hr/payroll/status/:month
 */
exports.getPayrollMonthStatus = asyncHandler(async (req, res) => {
  const month = req.params.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  }
  const m = String(month).trim();
  const [posting, closedDoc, count] = await Promise.all([
    PayrollPosting.findOne(byTenant(req, { month: m })).populate('journalEntryId').lean(),
    PayrollMonthClose.findOne(byTenant(req, { month: m })).lean(),
    Payroll.countDocuments(byTenant(req, { month: m })),
  ]);
  res.json({
    success: true,
    month: m,
    payrollRecordCount: count,
    posted: !!posting,
    posting: posting
      ? {
          postedAt: posting.postedAt,
          postedBy: posting.postedBy,
          totals: posting.totals,
          journalEntryId: posting.journalEntryId?._id || posting.journalEntryId,
        }
      : null,
    closed: !!closedDoc,
    closedAt: closedDoc?.closedAt || null,
  });
});

/**
 * POST /api/hr/payroll/:month/post-to-finance
 * Idempotent: returns existing posting if already done.
 */
exports.postPayrollToFinance = asyncHandler(async (req, res) => {
  const month = req.params.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  }
  const m = String(month).trim();
  await assertPayrollMonthEditable(req, m);

  const existing = await PayrollPosting.findOne(byTenant(req, { month: m }))
    .populate('journalEntryId')
    .lean();
  if (existing) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: 'Payroll already posted for this month.',
      data: existing,
    });
  }

  const rows = await Payroll.find(byTenant(req, { month: m })).lean();
  if (rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No payroll records for this month. Run payroll before posting.',
    });
  }

  const { lines, totals } = buildPayrollJournalFromRows(rows);
  if (totals.totalDebit <= 0) {
    return res.status(400).json({ success: false, message: 'Computed payroll total is zero — nothing to post.' });
  }

  const memo = `Payroll accrual — ${m} (${totals.headcount} employees)`;
  let journal;
  try {
    journal = await JournalEntry.create({
      tenantId: req.tenantId,
      entryDate: endOfMonthUtc(m),
      memo,
      source: 'payroll',
      sourceRef: m,
      lines,
      postedBy: req.user._id,
    });

    const posting = await PayrollPosting.create({
      tenantId: req.tenantId,
      month: m,
      totals,
      journalEntryId: journal._id,
      postedAt: new Date(),
      postedBy: req.user._id,
    });

    res.status(201).json({
    success: true,
    data: {
      posting: posting.toObject ? posting.toObject() : posting,
      journalEntry: journal.toObject ? journal.toObject() : journal,
    },
  });
  } catch (err) {
    if (journal && journal._id) {
      await JournalEntry.deleteOne({ _id: journal._id }).catch(() => {});
    }
    if (err && err.code === 11000) {
      const again = await PayrollPosting.findOne(byTenant(req, { month: m }))
        .populate('journalEntryId')
        .lean();
      if (again) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          message: 'Payroll already posted for this month.',
          data: again,
        });
      }
    }
    throw err;
  }
});

/**
 * POST /api/hr/payroll/:month/close
 * Locks payroll edits for the month unless user is Admin.
 */
exports.closePayrollMonth = asyncHandler(async (req, res) => {
  const month = req.params.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  }
  const m = String(month).trim();

  const already = await PayrollMonthClose.findOne(byTenant(req, { month: m })).lean();
  if (already) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: 'Month already closed.',
      data: already,
    });
  }

  const posted = await PayrollPosting.findOne(byTenant(req, { month: m })).lean();
  if (!posted) {
    return res.status(400).json({
      success: false,
      message: 'Post payroll to finance before closing this month.',
    });
  }

  const count = await Payroll.countDocuments(byTenant(req, { month: m }));
  if (count === 0) {
    return res.status(400).json({
      success: false,
      message: 'No payroll for this month — run payroll before closing.',
    });
  }

  const doc = await PayrollMonthClose.create({
    tenantId: req.tenantId,
    month: m,
    closedAt: new Date(),
    closedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: doc });
});

/**
 * GET /api/hr/payroll/export/pension?month=YYYY-MM
 */
exports.exportPensionCsv = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month=YYYY-MM required' });
  }
  const rows = await Payroll.find(byTenant(req, { month: String(month).trim() }))
    .populate('employee', 'name employeeId pensionMemberId')
    .lean();

  const header = [
    'EmployeeID',
    'FullName',
    'PensionMemberId',
    'Month',
    'PensionableBase_ETB',
    'EmployeeContribution_7pct_ETB',
    'EmployerContribution_11pct_ETB',
  ];
  const lines = [header.join(',')];
  for (const p of rows) {
    const emp = p.employee || {};
    lines.push(
      [
        csvEscape(emp.employeeId),
        csvEscape(emp.name),
        csvEscape(emp.pensionMemberId || ''),
        csvEscape(p.month),
        p.pensionableBase ?? 0,
        p.pensionEmployee ?? 0,
        p.pensionEmployer ?? 0,
      ].join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ethiopia-pension-${month}.csv"`
  );
  res.send('\ufeff' + lines.join('\n'));
});

/**
 * GET /api/hr/payroll/export/income-tax?month=YYYY-MM
 */
exports.exportIncomeTaxCsv = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month=YYYY-MM required' });
  }
  const rows = await Payroll.find(byTenant(req, { month: String(month).trim() }))
    .populate('employee', 'name employeeId')
    .lean();

  const header = [
    'TIN',
    'EmployeeID',
    'FullName',
    'Month',
    'TaxableIncome_ETB',
    'IncomeTaxWithheld_ETB',
    'NetSalaryPaid_ETB',
    'GrossCash_ETB',
  ];
  const lines = [header.join(',')];
  for (const p of rows) {
    const emp = p.employee || {};
    lines.push(
      [
        csvEscape(p.tinNumberSnapshot || ''),
        csvEscape(emp.employeeId),
        csvEscape(emp.name),
        csvEscape(p.month),
        p.taxableIncomeForTax ?? 0,
        p.incomeTax ?? 0,
        p.netSalary ?? 0,
        p.grossCash ?? 0,
      ].join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ethiopia-income-tax-${month}.csv"`
  );
  res.send('\ufeff' + lines.join('\n'));
});

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /api/hr/payroll/payslip/:id/html
 */
exports.getPayslipHtml = asyncHandler(async (req, res) => {
  const p = await Payroll.findOne(byTenant(req, { _id: req.params.id })).populate(
    'employee',
    'name employeeId department tinNumber'
  );
  if (!p) {
    return res.status(404).send('Payroll record not found');
  }
  const emp = p.employee;
  const b = p.breakdown || computeEthiopiaPayroll({ basicSalary: p.basicSalary });

  const rows = [
    ['Basic salary', b.basicSalary],
    ['Transport allowance', b.transportAllowance],
    ['Other taxable allowances', b.otherTaxableAllowances],
    [`Overtime (${b.overtimeNormalHours}h @1.25× + ${b.overtimeRestHolidayHours}h @1.5×)`, b.overtimePay],
    ['Gross pay', b.grossCash],
    ['Pension (employee 7%)', -b.pensionEmployee],
    ['Income tax (PAYE)', -b.incomeTax],
    ['Other deductions', -b.otherDeductions],
    ['Net pay', b.netSalary],
  ];

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payslip ${escHtml(p.month)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:520px;margin:24px auto;padding:16px;border:1px solid #ccc;}
h1{font-size:1.1rem;margin:0 0 4px;} .sub{color:#666;font-size:12px;}
table{width:100%;border-collapse:collapse;margin-top:16px;}
td{padding:8px;border-bottom:1px solid #eee;}
td:last-child{text-align:right;font-variant-numeric:tabular-nums;}
.net{font-weight:bold;font-size:1.15rem;background:#f0fdf4;}
.footer{margin-top:20px;font-size:10px;color:#888;}
</style></head>
<body>
<h1>Payslip — ${escHtml(p.month)}</h1>
<div class="sub">${escHtml(emp?.name || '')} · ${escHtml(emp?.employeeId || '')}<br/>
${escHtml(emp?.department || '')}${emp?.tinNumber ? ` · TIN ${escHtml(emp.tinNumber)}` : ''}</div>
<table>
${rows
  .map(
    ([k, v]) =>
      `<tr class="${k === 'Net pay' ? 'net' : ''}"><td>${escHtml(k)}</td><td>${Number(v).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</td></tr>`
  )
  .join('')}
</table>
<p class="footer">Ethiopia payroll: pension 7%/11% on pensionable base; income tax per schedule. Verify with ERC. Overtime per Labour Proclamation.</p>
<p><a href="#" onclick="window.print();return false">Print</a></p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
