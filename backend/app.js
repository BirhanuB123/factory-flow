const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');
const { apiLimiter, platformLimiter } = require('./middleware/rateLimits');

const {
  getProducts,
  getProductByBarcode,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('./controllers/productController');
const { getBoms, getBom, createBom, updateBom, deleteBom } = require('./controllers/bomController');
const {
  getJobs,
  getJob,
  getJobByToken,
  createJob,
  createJobFromOrder,
  reserveJobMaterials,
  updateJob,
  deleteJob,
  getTravelerHtml,
  syncJobOperations,
  startOperation,
  completeOperation,
  logOperationTime,
  scrapReworkOperation,
  logOperationWip,
  recordOperationQuality,
  issueJobMaterial,
  returnJobMaterial,
  updateJobCosting,
  getCapacityPlan,
  getProductionKpis,
} = require('./controllers/productionController');
const { getClients, getClient, createClient, updateClient, deleteClient } = require('./controllers/clientController');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
} = require('./controllers/orderController');
const { getMrpSuggestions, getMrpExplosion } = require('./controllers/mrpController');
const manufacturingController = require('./controllers/manufacturingController');
const { getLowStockAlerts } = require('./controllers/inventoryAlertsController');
const {
  getReservations,
  reserveOrderLine,
  releaseReservation,
} = require('./controllers/reservationController');
const {
  getEmployees,
  createEmployee,
  updateEmployee,
  inviteEmployee,
  resetEmployeePassword,
  getAttendance,
  logAttendance,
  reviewAttendanceOvertime,
  getLeaves,
  createLeave,
  reviewLeave,
  getLeaveBalance,
  getAttendanceCorrections,
  reviewAttendanceCorrection,
  getDepartments,
  createDepartment,
  updateDepartment,
  getPositions,
  createPosition,
  updatePosition,
  getPayroll,
  createPayroll,
} = require('./controllers/hrController');
const {
  getMyAttendance,
  getMyAttendanceToday,
  submitAttendance,
  checkIn,
  checkOut,
  getMyLeaves,
  requestMyLeave,
  updateMyPendingLeave,
  cancelMyPendingLeave,
  getMyAttendanceCorrections,
  createMyAttendanceCorrection,
} = require('./controllers/employeeSelfServiceController');
const {
  previewPayroll,
  preparePayroll,
  runPayrollMonth,
  exportPensionCsv,
  exportIncomeTaxCsv,
  getPayslipHtml,
  updatePayrollRecord,
  getPayrollMonthStatus,
  postPayrollToFinance,
  closePayrollMonth,
} = require('./controllers/hrPayrollController');
const {
  getTransactions,
  createInvoice,
  createExpense,
  getFinanceStats,
  createInvoiceFromOrder,
  getARAging,
  getCogsForInvoice,
} = require('./controllers/financeController');
const {
  listVendors,
  allVendors,
  createVendor,
  updateVendor,
  listVendorBills,
  createVendorBill,
  createVendorBillFromPO,
  recordVendorPayment,
  getAPAging,
} = require('./controllers/apVendorController');
const {
  listShipments,
  listShipmentsForOrder,
  getShipment,
  createShipment, 
  updateShipmentStatus,
  shipShipment,
  getDeliveryNoteHtml,
} = require('./controllers/shipmentController');
const { getValuation, getInventoryAging } = require('./controllers/inventoryValuationController');
const {
  exportOrders,
  exportInventory,
  exportProduction,
  exportAR,
  exportAP,
  postEmailDigest,
} = require('./controllers/reportsExportController');
const { getReportsSummary } = require('./controllers/reportsAnalyticsController');
const { list: listSavedViews, create: createSavedView, remove: removeSavedView } = require('./controllers/savedViewsController');
const { listPending, approve: approveRequest, reject: rejectRequest } = require('./controllers/approvalController');
const { listAuditLogs } = require('./controllers/auditLogsController');
const {
  xeroInvoicesCsv,
  xeroBillsCsv,
  quickBooksBillsCsv,
  qbExpensesCsv,
} = require('./controllers/integrationsController');
const {
  getEthiopiaTaxSettings,
  updateEthiopiaTaxSettings,
  getTaxInvoiceHtml,
  issueSalesWithholdingCertificate,
  issuePurchaseWithholdingCertificate,
  getWithholdingCertificateHtml,
  reportVatSalesCsv,
  reportVatPurchasesCsv,
  reportWithholdingSalesCsv,
  reportWithholdingPurchasesCsv,
  listWithholdingCertificates,
} = require('./controllers/ethiopiaTaxController');
const {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  patchPurchaseOrderSourcing,
  getPurchaseOrderHtml,
} = require('./controllers/purchaseOrderController');
const { globalSearch } = require('./controllers/searchController');
const { getMovements, createMovement } = require('./controllers/inventoryMovementController');
const { getLocations, createLocation, updateLocation, deleteLocation } = require('./controllers/locationController');
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  convertLeadToClient,
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  convertQuoteToOrder,
} = require('./controllers/crmController');
const { movementRules, handleValidation } = require('./middleware/validateRequest');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const platformRoutes = require('./routes/platformRoutes');
const billingWebhookRoutes = require('./routes/billingWebhookRoutes');
const billingRoutes = require('./routes/billingRoutes');
const posRoutes = require('./routes/posRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const tradeRoutes = require('./routes/trade.routes');
const analyticsController = require('./controllers/analyticsController');
const tenantController = require('./controllers/tenantController');
const qualityController = require('./controllers/qualityController');
const purchaseOrderController = require('./controllers/purchaseOrderController');
const { protect, authorize, authorizePerm, P, requireSuperAdmin } = require('./middleware/authMiddleware');
const { withTenant } = require('./middleware/tenantMiddleware');
const { requireTenantModule } = require('./utils/tenantModules');
const { touchTenantApiActivity } = require('./middleware/tenantActivityMiddleware');
const {
  enforceSuperAdminIpAllowlist,
  requireStepUpForPlatformMutation,
} = require('./middleware/superAdminGuardrails');
const financeAccess = require('./middleware/financeAccess');

const app = express();

if (String(process.env.TRUST_PROXY || '').toLowerCase() === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || '200kb',
    verify: (req, _res, buf) => {
      const url = String(req.originalUrl || '');
      if (url.startsWith('/api/billing/webhook/') || url.startsWith('/api/payments/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );
}

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

app.use('/api/auth', authRoutes);
app.use('/api/billing/webhook', billingWebhookRoutes);
app.use('/api/payments', paymentRoutes);

// Intentionally public — token in URL acts as the auth mechanism for kiosk/shop-floor access
app.get('/api/production/traveler/:token.html', getTravelerHtml);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Factory Flow ERP Backend is running' });
});

app.use(
  '/api/platform',
  platformLimiter,
  protect,
  requireSuperAdmin,
  enforceSuperAdminIpAllowlist,
  requireStepUpForPlatformMutation,
  platformRoutes
);

app.use('/api', protect);
app.use('/api', withTenant);
app.use('/api', touchTenantApiActivity);
app.use('/api/production', requireTenantModule('manufacturing'));
app.use('/api/boms', requireTenantModule('manufacturing'));
app.use('/api/mrp', requireTenantModule('manufacturing'));
app.use('/api/manufacturing', requireTenantModule('manufacturing'));
app.use('/api/products', requireTenantModule('inventory'));
app.use('/api/inventory', requireTenantModule('inventory'));
app.use('/api/orders', requireTenantModule('sales'));
app.use('/api/clients', requireTenantModule('sales'));
app.use('/api/crm', requireTenantModule('crm'));
app.use('/api/shipments', requireTenantModule('global_trade'));
app.use('/api/trade', requireTenantModule('global_trade'));
app.use('/api/purchase-orders', requireTenantModule('procurement'));
app.use('/api/finance', requireTenantModule('finance'));
app.use('/api/hr', requireTenantModule('hr'));
app.use('/api/employee', requireTenantModule('hr'));
app.use('/api/pos', requireTenantModule('pos'));
app.use('/api/analytics', requireTenantModule('analytics'));
app.use('/api/reports', requireTenantModule('analytics'));
app.use('/api/announcements', announcementRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/trade', tradeRoutes);

app.use('/api/pos', posRoutes);
app.use('/api/finance', financeAccess);
app.use('/api/hr', authorize('Admin', 'hr_head', 'finance_head'));

app.get('/api/search', authorizePerm(P.DASHBOARD_VIEW), globalSearch);
app.get('/api/inventory/movements', authorizePerm(P.PRODUCT_VIEW), getMovements);
app.post(
  '/api/inventory/movements',
  authorizePerm(P.INVENTORY_POST),
  movementRules,
  handleValidation,
  createMovement
);

app.get('/api/inventory/locations', authorizePerm(P.PRODUCT_VIEW), getLocations);
app.post('/api/inventory/locations', authorizePerm(P.INVENTORY_POST), createLocation);
app.put('/api/inventory/locations/:id', authorizePerm(P.INVENTORY_POST), updateLocation);
app.delete('/api/inventory/locations/:id', authorizePerm(P.INVENTORY_POST), deleteLocation);

// CRM Routes
app.get('/api/crm/leads', authorizePerm(P.CRM_VIEW), getLeads);
app.get('/api/crm/leads/:id', authorizePerm(P.CRM_VIEW), getLead);
app.post('/api/crm/leads', authorizePerm(P.CRM_MANAGE), createLead);
app.put('/api/crm/leads/:id', authorizePerm(P.CRM_MANAGE), updateLead);
app.delete('/api/crm/leads/:id', authorizePerm(P.CRM_MANAGE), deleteLead);
app.post('/api/crm/leads/:id/convert', authorizePerm(P.CRM_MANAGE), convertLeadToClient);

app.get('/api/crm/quotes', authorizePerm(P.CRM_VIEW), getQuotes);
app.get('/api/crm/quotes/:id', authorizePerm(P.CRM_VIEW), getQuote);
app.post('/api/crm/quotes', authorizePerm(P.CRM_MANAGE), createQuote);
app.put('/api/crm/quotes/:id', authorizePerm(P.CRM_MANAGE), updateQuote);
app.delete('/api/crm/quotes/:id', authorizePerm(P.CRM_MANAGE), deleteQuote);
app.post('/api/crm/quotes/:id/convert', authorizePerm(P.CRM_MANAGE), convertQuoteToOrder);

app.get('/api/purchase-orders', authorizePerm(P.PO_VIEW), listPurchaseOrders);
app.post('/api/purchase-orders', authorizePerm(P.PO_CREATE), createPurchaseOrder);
app.get('/api/purchase-orders/:id', authorizePerm(P.PO_VIEW), getPurchaseOrder);
app.get('/api/purchase-orders/:id/html', authorizePerm(P.PO_VIEW), getPurchaseOrderHtml);
app.put('/api/purchase-orders/:id', authorizePerm(P.PO_CREATE), updatePurchaseOrder);
app.patch(
  '/api/purchase-orders/:id/sourcing',
  authorizePerm(P.PO_CREATE),
  patchPurchaseOrderSourcing
);
app.post('/api/purchase-orders/:id/approve', authorizePerm(P.PO_APPROVE), approvePurchaseOrder);
app.post('/api/purchase-orders/:id/receive', authorizePerm(P.PO_RECEIVE), receivePurchaseOrder);
app.post('/api/purchase-orders/:id/cancel', authorizePerm(P.PO_CANCEL), cancelPurchaseOrder);
app.get('/api/inventory/valuation', authorizePerm(P.PRODUCT_VIEW), getValuation);
app.get('/api/inventory/aging', authorizePerm(P.PRODUCT_VIEW), getInventoryAging);
app.get('/api/inventory/alerts', authorizePerm(P.PRODUCT_VIEW), getLowStockAlerts);
app.get('/api/inventory/reservations', authorizePerm(P.ORDERS_VIEW), getReservations);
app.delete('/api/inventory/reservations/:id', authorizePerm(P.ORDERS_MANAGE), releaseReservation);

app.get('/api/mrp/suggestions', authorizePerm(P.DASHBOARD_MFG), getMrpSuggestions);
app.get('/api/mrp/explode/:productId', authorizePerm(P.DASHBOARD_MFG), getMrpExplosion);
app.get('/api/products', authorizePerm(P.PRODUCT_VIEW), getProducts);
app.get('/api/products/by-barcode/:barcode', authorizePerm(P.PRODUCT_VIEW), getProductByBarcode);
app.post('/api/products', authorizePerm(P.PRODUCT_MANAGE), createProduct);
app.get('/api/products/:id', authorizePerm(P.PRODUCT_VIEW), getProduct);
app.put('/api/products/:id', authorizePerm(P.PRODUCT_MANAGE), updateProduct);
app.delete('/api/products/:id', authorizePerm(P.PRODUCT_MANAGE), deleteProduct);

app.get('/api/boms', authorizePerm(P.PRODUCT_VIEW), getBoms);
app.post('/api/boms', authorizePerm(P.PRODUCT_MANAGE), createBom);
app.get('/api/boms/:id', authorizePerm(P.PRODUCT_VIEW), getBom);
app.put('/api/boms/:id', authorizePerm(P.PRODUCT_MANAGE), updateBom);
app.delete('/api/boms/:id', authorizePerm(P.PRODUCT_MANAGE), deleteBom);

app.get('/api/production', authorizePerm(P.DASHBOARD_MFG), getJobs);
app.post('/api/production', authorizePerm(P.MFG_OPS), createJob);
app.post('/api/production/from-order', authorizePerm(P.MFG_OPS), createJobFromOrder);
app.get(
  '/api/production/capacity/plan',
  authorizePerm(P.DASHBOARD_MFG),
  getCapacityPlan
);
app.get('/api/production/kpis', authorizePerm(P.DASHBOARD_MFG), getProductionKpis);
app.post('/api/production/:id/reserve-materials', authorizePerm(P.MFG_OPS), reserveJobMaterials);
app.get('/api/production/job-by-token/:token', getJobByToken);
app.get('/api/production/:id', authorizePerm(P.DASHBOARD_MFG), getJob);
app.put('/api/production/:id', authorizePerm(P.MFG_OPS), updateJob);
app.delete('/api/production/:id', authorizePerm(P.MFG_OPS), deleteJob);
app.post('/api/production/:id/sync-operations', authorizePerm(P.MFG_OPS), syncJobOperations);
app.post('/api/production/:id/operations/:opIndex/start', authorizePerm(P.MFG_OPS), startOperation);
app.post('/api/production/:id/operations/:opIndex/complete', authorizePerm(P.MFG_OPS), completeOperation);
app.post('/api/production/:id/operations/:opIndex/time', authorizePerm(P.MFG_OPS), logOperationTime);
app.post('/api/production/:id/operations/:opIndex/scrap-rework', authorizePerm(P.MFG_OPS), scrapReworkOperation);
app.post('/api/production/:id/operations/:opIndex/wip', authorizePerm(P.MFG_OPS), logOperationWip);
app.post('/api/production/:id/operations/:opIndex/quality', authorizePerm(P.MFG_OPS), recordOperationQuality);
app.post('/api/production/:id/materials/issue', authorizePerm(P.MFG_OPS), issueJobMaterial);
app.post('/api/production/:id/materials/return', authorizePerm(P.MFG_OPS), returnJobMaterial);
app.patch('/api/production/:id/costing', authorizePerm(P.MFG_OPS), updateJobCosting);

const mc = manufacturingController;
app.get('/api/manufacturing/work-centers', authorizePerm(P.DASHBOARD_MFG), mc.listWorkCenters);
app.post('/api/manufacturing/work-centers', authorizePerm(P.MFG_OPS), mc.createWorkCenter);
app.get('/api/manufacturing/assets', authorizePerm(P.DASHBOARD_MFG), mc.listAssets);
app.post('/api/manufacturing/assets', authorizePerm(P.MFG_OPS), mc.createAsset);
app.get('/api/manufacturing/pm-schedules', authorizePerm(P.DASHBOARD_MFG), mc.listPmSchedules);
app.post('/api/manufacturing/pm-schedules', authorizePerm(P.MFG_OPS), mc.createPmSchedule);
app.post('/api/manufacturing/pm-schedules/:id/complete', authorizePerm(P.MFG_OPS), mc.completePm);
app.get('/api/manufacturing/downtime', authorizePerm(P.DASHBOARD_MFG), mc.listDowntime);
app.post('/api/manufacturing/downtime', authorizePerm(P.MFG_OPS), mc.createDowntime);
app.post('/api/manufacturing/downtime/:id/end', authorizePerm(P.MFG_OPS), mc.endDowntime);
app.get('/api/manufacturing/inspections', authorizePerm(P.DASHBOARD_MFG), mc.listInspections);
app.post('/api/manufacturing/inspections', authorizePerm(P.MFG_OPS), mc.createInspection);
app.put('/api/manufacturing/inspections/:id', authorizePerm(P.MFG_OPS), mc.updateInspection);
app.get('/api/manufacturing/non-conformances', authorizePerm(P.DASHBOARD_MFG), mc.listNonConformances);
app.post('/api/manufacturing/non-conformances', authorizePerm(P.MFG_OPS), mc.createNonConformance);
app.put('/api/manufacturing/non-conformances/:id', authorizePerm(P.MFG_OPS), mc.updateNonConformance);

app.get('/api/clients', authorizePerm(P.ORDERS_VIEW), getClients);
app.post('/api/clients', authorizePerm(P.ORDERS_MANAGE), createClient);
app.get('/api/clients/:id', authorizePerm(P.ORDERS_VIEW), getClient);
app.put('/api/clients/:id', authorizePerm(P.ORDERS_MANAGE), updateClient);
app.delete('/api/clients/:id', authorizePerm(P.ORDERS_MANAGE), deleteClient);

app.get('/api/orders', authorizePerm(P.ORDERS_VIEW), getOrders);
app.post('/api/orders', authorizePerm(P.ORDERS_MANAGE), createOrder);
app.get('/api/orders/:id', authorizePerm(P.ORDERS_VIEW), getOrder);
app.put('/api/orders/:id', authorizePerm(P.ORDERS_MANAGE), updateOrder);
app.delete('/api/orders/:id', authorizePerm(P.ORDERS_MANAGE), deleteOrder);
app.post('/api/orders/:orderId/reserve-line', authorizePerm(P.ORDERS_MANAGE), reserveOrderLine);

app.get('/api/shipments', authorizePerm(P.SHIPMENTS_VIEW), listShipments);
app.get(
  '/api/shipments/order/:orderId',
  authorizePerm(P.SHIPMENTS_VIEW),
  listShipmentsForOrder
);
app.get(
  '/api/shipments/:id/delivery-note.html',
  authorizePerm(P.SHIPMENTS_VIEW),
  getDeliveryNoteHtml
);
app.get('/api/shipments/:id', authorizePerm(P.SHIPMENTS_VIEW), getShipment);
app.post(
  '/api/shipments',
  authorizePerm(P.SHIPMENTS_MANAGE),
  createShipment
);
app.put(
  '/api/shipments/:id/status',
  authorizePerm(P.SHIPMENTS_MANAGE),
  updateShipmentStatus
);
app.post(
  '/api/shipments/:id/ship',
  authorizePerm(P.SHIPMENTS_MANAGE),
  shipShipment
);

app.get('/api/saved-views', authorizePerm(P.DASHBOARD_VIEW), listSavedViews);
app.post('/api/saved-views', authorizePerm(P.DASHBOARD_VIEW), createSavedView);
app.delete('/api/saved-views/:id', authorizePerm(P.DASHBOARD_VIEW), removeSavedView);

app.get('/api/reports/export/orders', authorizePerm(P.ORDERS_VIEW), exportOrders);
app.get('/api/reports/export/inventory', authorizePerm(P.PRODUCT_VIEW), exportInventory);
app.get('/api/reports/export/production', authorizePerm(P.DASHBOARD_MFG), exportProduction);
app.get('/api/reports/export/ar', authorizePerm(P.FINANCE_READ), exportAR);
app.get('/api/reports/export/ap', authorizePerm(P.FINANCE_READ), exportAP);
app.post('/api/reports/email-digest', authorizePerm(P.FINANCE_WRITE), postEmailDigest);
app.get('/api/reports/summary', authorizePerm(P.DASHBOARD_VIEW), getReportsSummary);

app.get('/api/approvals/pending', authorizePerm(P.PO_APPROVE, P.FINANCE_WRITE), listPending);
app.post('/api/approvals/:id/approve', authorizePerm(P.FINANCE_WRITE), approveRequest);
app.post('/api/approvals/:id/reject', authorizePerm(P.FINANCE_WRITE), rejectRequest);

app.get('/api/audit-logs', authorizePerm(P.FINANCE_READ), listAuditLogs);

app.get('/api/integrations/xero/invoices.csv', authorizePerm(P.FINANCE_READ), xeroInvoicesCsv);
app.get('/api/integrations/qb/bills.csv', authorizePerm(P.FINANCE_READ), quickBooksBillsCsv);
app.get('/api/integrations/qb/expenses.csv', authorizePerm(P.FINANCE_READ), qbExpensesCsv);

app.get('/api/hr/employees', getEmployees);
app.post('/api/hr/employees', authorizePerm(P.HR_FULL), createEmployee);
app.put('/api/hr/employees/:id', authorizePerm(P.HR_FULL), updateEmployee);
app.post('/api/hr/employees/:id/invite', authorizePerm(P.HR_FULL), inviteEmployee);
app.post('/api/hr/employees/:id/reset-password', authorizePerm(P.HR_FULL), resetEmployeePassword);
app.get('/api/hr/attendance', getAttendance);
app.post('/api/hr/attendance', authorizePerm(P.HR_FULL), logAttendance);
app.patch('/api/hr/attendance/:id/overtime', authorizePerm(P.HR_FULL), reviewAttendanceOvertime);
app.get('/api/hr/leaves', getLeaves);
app.post('/api/hr/leaves', authorizePerm(P.HR_FULL), createLeave);
app.patch('/api/hr/leaves/:id/review', authorizePerm(P.HR_FULL), reviewLeave);
app.get('/api/hr/leaves/balance/:employeeId', getLeaveBalance);
app.get('/api/hr/attendance-corrections', getAttendanceCorrections);
app.patch('/api/hr/attendance-corrections/:id/review', authorizePerm(P.HR_FULL), reviewAttendanceCorrection);
app.get('/api/hr/departments', getDepartments);
app.post('/api/hr/departments', authorizePerm(P.HR_FULL), createDepartment);
app.put('/api/hr/departments/:id', authorizePerm(P.HR_FULL), updateDepartment);
app.get('/api/hr/positions', getPositions);
app.post('/api/hr/positions', authorizePerm(P.HR_FULL), createPosition);
app.put('/api/hr/positions/:id', authorizePerm(P.HR_FULL), updatePosition);
app.get('/api/hr/payroll/export/pension', exportPensionCsv);
app.get('/api/hr/payroll/export/income-tax', exportIncomeTaxCsv);
app.get('/api/hr/payroll/payslip/:id/html', getPayslipHtml);
app.post('/api/hr/payroll/preview', previewPayroll);
app.get('/api/hr/payroll/prepare', preparePayroll);
app.post('/api/hr/payroll/run', runPayrollMonth);
app.patch(
  '/api/hr/payroll/record/:id',
  authorizePerm(P.HR_FULL, P.FINANCE_WRITE),
  updatePayrollRecord
);
app.get('/api/hr/payroll/status/:month', getPayrollMonthStatus);
app.post(
  '/api/hr/payroll/:month/post-to-finance',
  authorizePerm(P.HR_FULL, P.FINANCE_WRITE),
  postPayrollToFinance
);
app.post(
  '/api/hr/payroll/:month/close',
  authorizePerm(P.HR_FULL, P.FINANCE_WRITE),
  closePayrollMonth
);
app.get('/api/hr/payroll', getPayroll);
app.post('/api/hr/payroll', createPayroll);

app.use('/api/employee', authorize('employee'));
app.get('/api/employee/attendance', getMyAttendance);
app.get('/api/employee/attendance/today', getMyAttendanceToday);
app.post('/api/employee/attendance', submitAttendance);
app.post('/api/employee/attendance/check-in', checkIn);
app.post('/api/employee/attendance/check-out', checkOut);
app.get('/api/employee/leaves', getMyLeaves);
app.post('/api/employee/leaves', requestMyLeave);
app.put('/api/employee/leaves/:id', updateMyPendingLeave);
app.delete('/api/employee/leaves/:id', cancelMyPendingLeave);
app.get('/api/employee/attendance-corrections', getMyAttendanceCorrections);
app.post('/api/employee/attendance-corrections', createMyAttendanceCorrection);

app.get('/api/finance/transactions', getTransactions);
app.post('/api/finance/invoices', createInvoice);
app.post('/api/finance/invoices/from-order', createInvoiceFromOrder);
app.get('/api/finance/ar-aging', getARAging);
app.get('/api/finance/ethiopia-tax/settings', getEthiopiaTaxSettings);
app.put('/api/finance/ethiopia-tax/settings', updateEthiopiaTaxSettings);
app.get('/api/finance/invoices/:id/tax-invoice.html', getTaxInvoiceHtml);
app.post(
  '/api/finance/invoices/:id/withholding-certificate',
  issueSalesWithholdingCertificate
);
app.post(
  '/api/finance/vendor-bills/:id/withholding-certificate',
  issuePurchaseWithholdingCertificate
);
app.get(
  '/api/finance/withholding-certificates/:id/print.html',
  getWithholdingCertificateHtml
);
app.get('/api/finance/reports/ethiopia/vat-sales.csv', reportVatSalesCsv);
app.get('/api/finance/reports/ethiopia/vat-purchases.csv', reportVatPurchasesCsv);
app.get('/api/finance/reports/ethiopia/withholding-sales.csv', reportWithholdingSalesCsv);
app.get(
  '/api/finance/reports/ethiopia/withholding-purchases.csv',
  reportWithholdingPurchasesCsv
);
app.get('/api/finance/withholding-certificates', listWithholdingCertificates);
app.get('/api/finance/invoices/:invoiceId/cogs', getCogsForInvoice);
app.get('/api/finance/ap-aging', getAPAging);
app.get('/api/finance/vendors', listVendors);
app.get('/api/finance/vendors/all', allVendors);
app.post('/api/finance/vendors', createVendor);
app.put('/api/finance/vendors/:id', updateVendor);
app.get('/api/finance/vendor-bills', listVendorBills);
app.post('/api/finance/vendor-bills', createVendorBill);
app.post('/api/finance/vendor-bills/from-po/:poId', createVendorBillFromPO);
app.post('/api/finance/vendor-bills/:id/payments', recordVendorPayment);
app.post('/api/finance/expenses', createExpense);
app.get('/api/finance/stats', getFinanceStats);

// Financial Integrations
app.get('/api/finance/integrations/xero/invoices', authorizePerm(P.FINANCE_READ), xeroInvoicesCsv);
app.get('/api/finance/integrations/xero/bills', authorizePerm(P.FINANCE_READ), xeroBillsCsv);
app.get('/api/finance/integrations/quickbooks/bills', authorizePerm(P.FINANCE_READ), quickBooksBillsCsv);
app.get('/api/finance/integrations/quickbooks/expenses', authorizePerm(P.FINANCE_READ), qbExpensesCsv);

// Analytics & BI
app.get('/api/analytics/oee', authorizePerm(P.DASHBOARD_VIEW), analyticsController.getOeeAnalytics);
app.get('/api/analytics/profitability', authorizePerm(P.DASHBOARD_VIEW), analyticsController.getProductProfitability);
app.get('/api/analytics/inventory-turnover', authorizePerm(P.DASHBOARD_VIEW), analyticsController.getInventoryTurnover);

// Quality Control
app.get('/api/quality/checklists', authorizePerm(P.DASHBOARD_MFG), qualityController.listChecklists);
app.post('/api/quality/checklists', authorizePerm(P.MFG_OPS), qualityController.createChecklist);
app.patch('/api/quality/checklists/:id', authorizePerm(P.MFG_OPS), qualityController.updateChecklist);
app.get('/api/quality/checklists/search', authorizePerm(P.DASHBOARD_MFG), qualityController.getChecklistForJob);
app.post('/api/quality/inspections/submit', authorizePerm(P.MFG_OPS), qualityController.submitInspection);

// Tenant Settings — reads allowed for all authenticated users; writes are Admin-only
app.get('/api/tenant/settings', tenantController.getSettings);
app.patch('/api/tenant/document-settings', authorizePerm(P.SETTINGS_MANAGE), tenantController.updateDocumentSettings);
app.patch('/api/tenant/info', authorizePerm(P.SETTINGS_MANAGE), tenantController.updateTenantInfo);

app.use('/api/notifications', notificationRoutes);

app.use(require('./middleware/errorMiddleware'));

module.exports = app;
