const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Client = require('../models/Client');
const JournalEntry = require('../models/JournalEntry');
const ProductionJob = require('../models/ProductionJob');
const PurchaseOrder = require('../models/PurchaseOrder');
const Shipment = require('../models/Shipment');
const Product = require('../models/Product');
const { byTenant } = require('../utils/tenantQuery');
const { P, can } = require('../config/permissions');
const Tenant = require('../models/Tenant');
const { normalizeModuleFlags } = require('../utils/tenantModules');

function tenantObjectId(req) {
  return new mongoose.Types.ObjectId(String(req.tenantId));
}

function windowBoundsForPeriod(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (period === 'daily') {
    start.setUTCDate(start.getUTCDate() - 35);
    end.setUTCDate(end.getUTCDate() + 2);
  } else if (period === 'weekly') {
    start.setUTCDate(start.getUTCDate() - 100);
    end.setUTCDate(end.getUTCDate() + 14);
  } else if (period === 'monthly') {
    start.setUTCMonth(start.getUTCMonth() - 14);
    end.setUTCMonth(end.getUTCMonth() + 2);
  } else {
    start.setUTCFullYear(start.getUTCFullYear() - 6);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }
  return { windowStart: start, windowEnd: end };
}

/** Fixed spine for daily / monthly / yearly (tenant-local calendar). */
function buildFixedBucketKeys(period, tz) {
  const now = new Date();
  const keys = [];

  if (period === 'daily') {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      const label = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: 'short',
        day: 'numeric',
      }).format(d);
      keys.push({ key, label });
    }
  } else if (period === 'monthly') {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 12, 0, 0));
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
      })
        .format(d)
        .slice(0, 7);
      const label = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: 'short',
        year: 'numeric',
      }).format(d);
      keys.push({ key, label });
    }
  } else if (period === 'yearly') {
    for (let i = 4; i >= 0; i -= 1) {
      const y = now.getUTCFullYear() - i;
      const key = String(y);
      keys.push({ key, label: key });
    }
  }

  return keys;
}

/** Weekly: only buckets that appear in data (up to 12), ISO week in tenant TZ — matches $group _id. */
function buildWeeklyBucketKeysFromRows(rowArrays) {
  const set = new Set();
  for (const rows of rowArrays) {
    for (const r of rows) {
      if (r._id != null && String(r._id) !== '') set.add(String(r._id));
    }
  }
  const sorted = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sorted.slice(-12).map((key) => ({ key, label: key }));
}

function groupIdExpr(dateFieldRef, period, tz) {
  if (period === 'daily') {
    return { $dateToString: { format: '%Y-%m-%d', date: dateFieldRef, timezone: tz } };
  }
  if (period === 'weekly') {
    return {
      $concat: [
        { $toString: { $isoWeekYear: { date: dateFieldRef, timezone: tz } } },
        '-W',
        {
          $cond: [
            { $lt: [{ $isoWeek: { date: dateFieldRef, timezone: tz } }, 10] },
            { $concat: ['0', { $toString: { $isoWeek: { date: dateFieldRef, timezone: tz } } }] },
            { $toString: { $isoWeek: { date: dateFieldRef, timezone: tz } } },
          ],
        },
      ],
    };
  }
  if (period === 'monthly') {
    return { $dateToString: { format: '%Y-%m', date: dateFieldRef, timezone: tz } };
  }
  return { $dateToString: { format: '%Y', date: dateFieldRef, timezone: tz } };
}

function aggregateOrders(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$orderDate', period, tz);
  return Order.aggregate([
    {
      $match: {
        tenantId: tid,
        orderDate: { $gte: windowStart, $lt: windowEnd },
        status: { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: gid,
        ordersCount: { $sum: 1 },
        ordersRevenue: { $sum: { $toDouble: '$totalAmount' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateClients(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$createdAt', period, tz);
  return Client.aggregate([
    { $match: { tenantId: tid, createdAt: { $gte: windowStart, $lt: windowEnd } } },
    { $group: { _id: gid, newClients: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateInvoicesPaid(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$invoiceDate', period, tz);
  return Invoice.aggregate([
    {
      $match: {
        tenantId: tid,
        invoiceDate: { $gte: windowStart, $lt: windowEnd },
        status: 'Paid',
      },
    },
    {
      $group: {
        _id: gid,
        paidRevenue: {
          $sum: {
            $cond: [
              { $ne: ['$grossBeforeWht', null] },
              { $toDouble: '$grossBeforeWht' },
              { $toDouble: '$amount' },
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateExpenses(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$date', period, tz);
  return Expense.aggregate([
    { $match: { tenantId: tid, date: { $gte: windowStart, $lt: windowEnd } } },
    { $group: { _id: gid, expenses: { $sum: { $toDouble: '$amount' } } } },
    { $sort: { _id: 1 } },
  ]);
}

function aggregatePayrollExpenses(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$entryDate', period, tz);
  return JournalEntry.aggregate([
    {
      $match: {
        tenantId: tid,
        source: 'payroll',
        entryDate: { $gte: windowStart, $lt: windowEnd },
      },
    },
    {
      $addFields: {
        payrollDebit: {
          $reduce: {
            input: { $ifNull: ['$lines', []] },
            initialValue: 0,
            in: { $add: ['$$value', { $toDouble: '$$this.debit' }] },
          },
        },
      },
    },
    { $group: { _id: gid, payroll: { $sum: '$payrollDebit' } } },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateJobsCreated(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$createdAt', period, tz);
  return ProductionJob.aggregate([
    { $match: { tenantId: tid, createdAt: { $gte: windowStart, $lt: windowEnd } } },
    { $group: { _id: gid, jobsCreated: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateJobsCompleted(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$updatedAt', period, tz);
  return ProductionJob.aggregate([
    {
      $match: {
        tenantId: tid,
        status: 'Completed',
        updatedAt: { $gte: windowStart, $lt: windowEnd },
      },
    },
    { $group: { _id: gid, jobsCompleted: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

function aggregatePurchaseOrders(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$createdAt', period, tz);
  return PurchaseOrder.aggregate([
    {
      $match: {
        tenantId: tid,
        createdAt: { $gte: windowStart, $lt: windowEnd },
        status: { $ne: 'cancelled' },
      },
    },
    {
      $addFields: {
        poLineSum: {
          $reduce: {
            input: { $ifNull: ['$lines', []] },
            initialValue: 0,
            in: {
              $add: [
                '$$value',
                {
                  $multiply: [
                    { $toDouble: { $ifNull: ['$$this.quantityOrdered', 0] } },
                    { $toDouble: { $ifNull: ['$$this.unitCost', 0] } },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: gid,
        poCount: { $sum: 1 },
        poValue: { $sum: '$poLineSum' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function aggregateShipmentsShipped(req, period, tz) {
  const tid = tenantObjectId(req);
  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const gid = groupIdExpr('$shippedAt', period, tz);
  return Shipment.aggregate([
    {
      $match: {
        tenantId: tid,
        status: 'shipped',
        shippedAt: { $gte: windowStart, $lt: windowEnd, $type: 'date' },
      },
    },
    { $group: { _id: gid, shipmentsShipped: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
}

function rowsToMap(rows) {
  const m = new Map();
  for (const r of rows) {
    if (r._id != null) m.set(String(r._id), r);
  }
  return m;
}

function mergeSeries(bucketKeys, maps, flags) {
  return bucketKeys.map(({ key, label }) => {
    const o = maps.orders.get(key) || {};
    const c = maps.clients.get(key) || {};
    const inv = maps.invoices.get(key) || {};
    const ex = maps.expenses.get(key) || {};
    const pr = maps.payroll.get(key) || {};
    const jc = maps.jobsCreated.get(key) || {};
    const jd = maps.jobsCompleted.get(key) || {};
    const po = maps.purchaseOrders.get(key) || {};
    const sh = maps.shipments.get(key) || {};
    const expenses = (ex.expenses || 0) + (pr.payroll || 0);

    return {
      key,
      label,
      ordersCount: flags.sales ? o.ordersCount || 0 : 0,
      ordersRevenue: flags.sales ? Math.round((o.ordersRevenue || 0) * 100) / 100 : 0,
      newClients: flags.sales ? c.newClients || 0 : 0,
      paidRevenue: flags.finance ? Math.round((inv.paidRevenue || 0) * 100) / 100 : 0,
      expenses: flags.finance ? Math.round(expenses * 100) / 100 : 0,
      jobsCreated: flags.manufacturing ? jc.jobsCreated || 0 : 0,
      jobsCompleted: flags.manufacturing ? jd.jobsCompleted || 0 : 0,
      poCount: flags.procurement ? po.poCount || 0 : 0,
      poValue: flags.procurement ? Math.round((po.poValue || 0) * 100) / 100 : 0,
      shipmentsShipped: flags.shipments ? sh.shipmentsShipped || 0 : 0,
    };
  });
}

// @desc  Aggregated KPIs + time series (tenant-scoped, Mongo aggregations + tenant timezone)
// @route GET /api/reports/summary?period=daily|weekly|monthly|yearly
exports.getReportsSummary = asyncHandler(async (req, res) => {
  const raw = String(req.query.period || 'monthly').toLowerCase();
  const period = ['daily', 'weekly', 'monthly', 'yearly'].includes(raw) ? raw : 'monthly';

  const tenantDoc = await Tenant.findById(req.tenantId).select('moduleFlags timezone').lean();
  const moduleFlags = normalizeModuleFlags(tenantDoc?.moduleFlags);
  const tz = (tenantDoc && tenantDoc.timezone) || 'Africa/Addis_Ababa';

  const salesModuleOn = moduleFlags.sales !== false;
  const financeModuleOn = moduleFlags.finance !== false;
  const mfgModuleOn = moduleFlags.manufacturing !== false;
  const procModuleOn = moduleFlags.procurement !== false;
  const invModuleOn = moduleFlags.inventory !== false;

  const financeOk =
    financeModuleOn &&
    (req.user.role === 'Admin' ||
      req.user.platformRole === 'super_admin' ||
      can(req.user.role, P.FINANCE_READ));

  const mfgOk =
    mfgModuleOn &&
    (req.user.role === 'Admin' ||
      req.user.platformRole === 'super_admin' ||
      can(req.user.role, P.DASHBOARD_MFG));

  const procOk =
    procModuleOn &&
    (req.user.role === 'Admin' ||
      req.user.platformRole === 'super_admin' ||
      can(req.user.role, P.PO_VIEW));

  const invOk =
    invModuleOn &&
    (req.user.role === 'Admin' ||
      req.user.platformRole === 'super_admin' ||
      can(req.user.role, P.DASHBOARD_INVENTORY));

  const shipOk =
    salesModuleOn &&
    (req.user.role === 'Admin' ||
      req.user.platformRole === 'super_admin' ||
      can(req.user.role, P.SHIPMENTS_VIEW));

  const { windowStart, windowEnd } = windowBoundsForPeriod(period);
  const matchWindow = { $gte: windowStart, $lt: windowEnd };
  const tid = tenantObjectId(req);

  const [
    orderRows,
    clientRows,
    invoiceRows,
    expenseRows,
    payrollRows,
    jobsCreatedRows,
    jobsCompletedRows,
    poRows,
    shipmentRows,
  ] = await Promise.all([
    salesModuleOn ? aggregateOrders(req, period, tz) : Promise.resolve([]),
    salesModuleOn ? aggregateClients(req, period, tz) : Promise.resolve([]),
    financeOk ? aggregateInvoicesPaid(req, period, tz) : Promise.resolve([]),
    financeOk ? aggregateExpenses(req, period, tz) : Promise.resolve([]),
    financeOk ? aggregatePayrollExpenses(req, period, tz) : Promise.resolve([]),
    mfgOk ? aggregateJobsCreated(req, period, tz) : Promise.resolve([]),
    mfgOk ? aggregateJobsCompleted(req, period, tz) : Promise.resolve([]),
    procOk ? aggregatePurchaseOrders(req, period, tz) : Promise.resolve([]),
    shipOk ? aggregateShipmentsShipped(req, period, tz) : Promise.resolve([]),
  ]);

  const rowArraysForWeekKeys = [
    orderRows,
    clientRows,
    invoiceRows,
    expenseRows,
    payrollRows,
    jobsCreatedRows,
    jobsCompletedRows,
    poRows,
    shipmentRows,
  ];

  let bucketKeys;
  if (period === 'weekly') {
    bucketKeys = buildWeeklyBucketKeysFromRows(rowArraysForWeekKeys);
  } else {
    bucketKeys = buildFixedBucketKeys(period, tz);
  }

  const maps = {
    orders: rowsToMap(orderRows),
    clients: rowsToMap(clientRows),
    invoices: rowsToMap(invoiceRows),
    expenses: rowsToMap(expenseRows),
    payroll: rowsToMap(payrollRows),
    jobsCreated: rowsToMap(jobsCreatedRows),
    jobsCompleted: rowsToMap(jobsCompletedRows),
    purchaseOrders: rowsToMap(poRows),
    shipments: rowsToMap(shipmentRows),
  };

  const series = mergeSeries(bucketKeys, maps, {
    sales: salesModuleOn,
    finance: financeOk,
    manufacturing: mfgOk,
    procurement: procOk,
    shipments: shipOk,
  });

  const [
    ordersWindow,
    clientsWindow,
    invoicesWindow,
    expensesWindow,
    payrollWindow,
    jobsCreatedWindow,
    jobsDoneWindow,
    poWindow,
    shipWindow,
    invSnapshot,
    lifetimeOrders,
    lifetimeClients,
    lifetimeProducts,
  ] = await Promise.all([
    salesModuleOn
      ? Order.countDocuments(byTenant(req, { orderDate: matchWindow, status: { $ne: 'cancelled' } }))
      : 0,
    salesModuleOn ? Client.countDocuments(byTenant(req, { createdAt: matchWindow })) : 0,
    financeOk
      ? Invoice.aggregate([
          {
            $match: {
              tenantId: tid,
              invoiceDate: matchWindow,
              status: 'Paid',
            },
          },
          {
            $group: {
              _id: null,
              sum: {
                $sum: {
                  $cond: [
                    { $ne: ['$grossBeforeWht', null] },
                    { $toDouble: '$grossBeforeWht' },
                    { $toDouble: '$amount' },
                  ],
                },
              },
            },
          },
        ])
      : [],
    financeOk
      ? Expense.aggregate([
          { $match: { tenantId: tid, date: matchWindow } },
          { $group: { _id: null, sum: { $sum: { $toDouble: '$amount' } } } },
        ])
      : [],
    financeOk
      ? JournalEntry.aggregate([
          { $match: { tenantId: tid, source: 'payroll', entryDate: matchWindow } },
          {
            $project: {
              d: {
                $reduce: {
                  input: { $ifNull: ['$lines', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $toDouble: '$$this.debit' }] },
                },
              },
            },
          },
          { $group: { _id: null, sum: { $sum: '$d' } } },
        ])
      : [],
    mfgOk ? ProductionJob.countDocuments(byTenant(req, { createdAt: matchWindow })) : 0,
    mfgOk
      ? ProductionJob.countDocuments(byTenant(req, { status: 'Completed', updatedAt: matchWindow }))
      : 0,
    procOk
      ? PurchaseOrder.countDocuments(
          byTenant(req, { createdAt: matchWindow, status: { $ne: 'cancelled' } })
        )
      : 0,
    shipOk
      ? Shipment.countDocuments(
          byTenant(req, { status: 'shipped', shippedAt: { ...matchWindow, $type: 'date' } })
        )
      : 0,
    invOk
      ? Product.aggregate([
          { $match: { tenantId: tid } },
          {
            $group: {
              _id: null,
              skus: { $sum: 1 },
              units: { $sum: { $toDouble: '$stock' } },
              value: { $sum: { $multiply: [{ $toDouble: '$stock' }, { $toDouble: '$unitCost' }] } },
            },
          },
        ])
      : [],
    salesModuleOn ? Order.countDocuments(byTenant(req, { status: { $ne: 'cancelled' } })) : 0,
    salesModuleOn ? Client.countDocuments(byTenant(req, {})) : 0,
    invOk ? Product.countDocuments(byTenant(req, {})) : 0,
  ]);

  const paidInWindow = invoicesWindow[0]?.sum || 0;
  const expInWindow = expensesWindow[0]?.sum || 0;
  const payrollInWindow = payrollWindow[0]?.sum || 0;
  const expensesTotalWindow = expInWindow + payrollInWindow;

  const inv = invSnapshot[0] || { skus: 0, units: 0, value: 0 };

  const poValueWindow = poRows.reduce((s, r) => s + (Number(r.poValue) || 0), 0);

  const kpis = {
    ordersCount: ordersWindow,
    ordersRevenue: Math.round(orderRows.reduce((s, r) => s + (Number(r.ordersRevenue) || 0), 0) * 100) / 100,
    newClients: clientsWindow,
    jobsCreated: jobsCreatedWindow,
    jobsCompleted: jobsDoneWindow,
    poCount: poWindow,
    poValue: Math.round(poValueWindow * 100) / 100,
    shipmentsShipped: shipWindow,
    inventorySkus: inv.skus,
    inventoryUnits: Math.round((inv.units || 0) * 1000) / 1000,
    inventoryValue: Math.round((inv.value || 0) * 100) / 100,
  };

  if (financeOk) {
    kpis.paidRevenue = Math.round(paidInWindow * 100) / 100;
    kpis.expensesTotal = Math.round(expensesTotalWindow * 100) / 100;
    kpis.profit = Math.round((paidInWindow - expensesTotalWindow) * 100) / 100;
    kpis.pendingInvoicesCount = await Invoice.countDocuments(
      byTenant(req, { status: { $in: ['Pending', 'Overdue'] } })
    );
  }

  const kpisLifetime = {
    totalOrders: lifetimeOrders,
    totalClients: lifetimeClients,
    totalProducts: lifetimeProducts,
  };

  res.status(200).json({
    period,
    timezone: tz,
    window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    sales: salesModuleOn,
    finance: financeOk,
    manufacturing: mfgOk,
    procurement: procOk,
    inventory: invOk,
    shipments: shipOk,
    kpis,
    kpisLifetime,
    series,
  });
});
