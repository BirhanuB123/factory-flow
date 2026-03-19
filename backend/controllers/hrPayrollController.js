const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const { computeEthiopiaPayroll } = require('../services/ethiopiaPayrollService');

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
  const emp = await Employee.findById(empId);
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
  const emps = await Employee.find({ status: { $in: ['Active', 'On Leave'] } })
    .select('employeeId name salary department status tinNumber')
    .sort({ employeeId: 1 })
    .lean();
  const payrolls = await Payroll.find({ month: m }).lean();
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
  const entryList = Array.isArray(entries) ? entries : [];
  const results = [];
  const skipped = [];

  let toProcess = [];

  if (entryList.length > 0) {
    for (const row of entryList) {
      if (row.includeInRun === false) continue;
      const e = await Employee.findById(row.employee);
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
    const actives = await Employee.find({
      status: { $in: ['Active', 'On Leave'] },
      salary: { $gt: 0 },
    });
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
        { employee: e._id, month: m },
        {
          $set: {
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
  const p = await Payroll.findByIdAndUpdate(req.params.id, { $set: set }, { new: true })
    .populate('employee', 'name employeeId department')
    .lean();
  if (!p) {
    return res.status(404).json({ success: false, message: 'Payroll record not found' });
  }
  res.json({ success: true, data: p });
});

/**
 * GET /api/hr/payroll/export/pension?month=YYYY-MM
 */
exports.exportPensionCsv = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!monthRe(month)) {
    return res.status(400).json({ success: false, message: 'month=YYYY-MM required' });
  }
  const rows = await Payroll.find({ month: String(month).trim() })
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
  const rows = await Payroll.find({ month: String(month).trim() })
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
  const p = await Payroll.findById(req.params.id).populate(
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
