const express = require('express');
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
  getAttendance,
  logAttendance,
  getPayroll,
  createPayroll,
} = require('./controllers/hrController');
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
const { getValuation } = require('./controllers/inventoryValuationController');
const {
  exportOrders,
  exportInventory,
  exportProduction,
  exportAR,
  exportAP,
  postEmailDigest,
} = require('./controllers/reportsExportController');
const { list: listSavedViews, create: createSavedView, remove: removeSavedView } = require('./controllers/savedViewsController');
const { listPending, approve: approveRequest, reject: rejectRequest } = require('./controllers/approvalController');
const { listAuditLogs } = require('./controllers/auditLogsController');
const {
  xeroInvoicesCsv,
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
} = require('./controllers/purchaseOrderController');
const { globalSearch } = require('./controllers/searchController');
const { getMovements, createMovement } = require('./controllers/inventoryMovementController');
const { movementRules, handleValidation } = require('./middleware/validateRequest');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const platformRoutes = require('./routes/platformRoutes');
const billingWebhookRoutes = require('./routes/billingWebhookRoutes');
const billingRoutes = require('./routes/billingRoutes');
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

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || '200kb',
    verify: (req, _res, buf) => {
      if (String(req.originalUrl || '').startsWith('/api/billing/webhook/')) {
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
app.use('/api/shipments', requireTenantModule('sales'));
app.use('/api/purchase-orders', requireTenantModule('procurement'));
app.use('/api/finance', requireTenantModule('finance'));
app.use('/api/hr', requireTenantModule('hr'));
app.use('/api/announcements', announcementRoutes);
app.use('/api/billing', billingRoutes);

app.use('/api/finance', financeAccess);
app.use('/api/hr', authorize('Admin', 'hr_head', 'finance_head'));

app.get('/api/search', globalSearch);
app.get('/api/inventory/movements', getMovements);
app.post(
  '/api/inventory/movements',
  authorizePerm(P.INVENTORY_POST),
  movementRules,
  handleValidation,
  createMovement
);

app.get('/api/purchase-orders', authorizePerm(P.PO_VIEW), listPurchaseOrders);
app.post('/api/purchase-orders', authorizePerm(P.PO_CREATE), createPurchaseOrder);
app.get('/api/purchase-orders/:id', authorizePerm(P.PO_VIEW), getPurchaseOrder);
app.put('/api/purchase-orders/:id', authorizePerm(P.PO_CREATE), updatePurchaseOrder);
app.patch(
  '/api/purchase-orders/:id/sourcing',
  authorizePerm(P.PO_CREATE),
  patchPurchaseOrderSourcing
);
app.post('/api/purchase-orders/:id/approve', authorizePerm(P.PO_APPROVE), approvePurchaseOrder);
app.post('/api/purchase-orders/:id/receive', authorizePerm(P.PO_RECEIVE), receivePurchaseOrder);
app.post('/api/purchase-orders/:id/cancel', authorizePerm(P.PO_CANCEL), cancelPurchaseOrder);
app.get(
  '/api/inventory/valuation',
  authorize('Admin', 'finance_head', 'finance_viewer', 'warehouse_head', 'purchasing_head'),
  getValuation
);
app.get('/api/inventory/alerts', getLowStockAlerts);
app.get('/api/inventory/reservations', getReservations);
app.delete('/api/inventory/reservations/:id', releaseReservation);

app.get('/api/mrp/suggestions', getMrpSuggestions);
app.get('/api/mrp/explode/:productId', getMrpExplosion);
app.get('/api/products', getProducts);
app.get('/api/products/by-barcode/:barcode', getProductByBarcode);
app.post('/api/products', createProduct);
app.get('/api/products/:id', getProduct);
app.put('/api/products/:id', updateProduct);
app.delete('/api/products/:id', deleteProduct);

app.get('/api/boms', getBoms);
app.post('/api/boms', createBom);
app.get('/api/boms/:id', getBom);
app.put('/api/boms/:id', updateBom);
app.delete('/api/boms/:id', deleteBom);

app.get('/api/production', getJobs);
app.post('/api/production', createJob);
app.post('/api/production/from-order', createJobFromOrder);
app.post('/api/production/:id/reserve-materials', reserveJobMaterials);
app.get('/api/production/:id', getJob);
app.put('/api/production/:id', updateJob);
app.delete('/api/production/:id', deleteJob);
app.post('/api/production/:id/sync-operations', syncJobOperations);
app.post('/api/production/:id/operations/:opIndex/start', startOperation);
app.post('/api/production/:id/operations/:opIndex/complete', completeOperation);
app.post('/api/production/:id/operations/:opIndex/time', logOperationTime);
app.post('/api/production/:id/operations/:opIndex/scrap-rework', scrapReworkOperation);

const mc = manufacturingController;
app.get('/api/manufacturing/work-centers', mc.listWorkCenters);
app.post('/api/manufacturing/work-centers', mc.createWorkCenter);
app.get('/api/manufacturing/assets', mc.listAssets);
app.post('/api/manufacturing/assets', mc.createAsset);
app.get('/api/manufacturing/pm-schedules', mc.listPmSchedules);
app.post('/api/manufacturing/pm-schedules', mc.createPmSchedule);
app.post('/api/manufacturing/pm-schedules/:id/complete', mc.completePm);
app.get('/api/manufacturing/downtime', mc.listDowntime);
app.post('/api/manufacturing/downtime', mc.createDowntime);
app.post('/api/manufacturing/downtime/:id/end', mc.endDowntime);
app.get('/api/manufacturing/inspections', mc.listInspections);
app.post('/api/manufacturing/inspections', mc.createInspection);
app.put('/api/manufacturing/inspections/:id', mc.updateInspection);
app.get('/api/manufacturing/non-conformances', mc.listNonConformances);
app.post('/api/manufacturing/non-conformances', mc.createNonConformance);
app.put('/api/manufacturing/non-conformances/:id', mc.updateNonConformance);

app.get('/api/clients', getClients);
app.post('/api/clients', createClient);
app.get('/api/clients/:id', getClient);
app.put('/api/clients/:id', updateClient);
app.delete('/api/clients/:id', deleteClient);

app.get('/api/orders', getOrders);
app.post('/api/orders', createOrder);
app.get('/api/orders/:id', getOrder);
app.put('/api/orders/:id', updateOrder);
app.delete('/api/orders/:id', deleteOrder);
app.post('/api/orders/:orderId/reserve-line', reserveOrderLine);

app.get(
  '/api/shipments',
  authorize('Admin', 'warehouse_head', 'finance_head', 'finance_viewer', 'purchasing_head'),
  listShipments
);
app.get(
  '/api/shipments/order/:orderId',
  authorize('Admin', 'warehouse_head', 'finance_head', 'finance_viewer'),
  listShipmentsForOrder
);
app.get(
  '/api/shipments/:id/delivery-note.html',
  authorize('Admin', 'warehouse_head', 'finance_head', 'finance_viewer', 'purchasing_head'),
  getDeliveryNoteHtml
);
app.get(
  '/api/shipments/:id',
  authorize('Admin', 'warehouse_head', 'finance_head', 'finance_viewer'),
  getShipment
);
app.post(
  '/api/shipments',
  authorize('Admin', 'warehouse_head'),
  createShipment
);
app.put(
  '/api/shipments/:id/status',
  authorize('Admin', 'warehouse_head'),
  updateShipmentStatus
);
app.post(
  '/api/shipments/:id/ship',
  authorize('Admin', 'warehouse_head'),
  shipShipment
);

app.get('/api/saved-views', listSavedViews);
app.post('/api/saved-views', createSavedView);
app.delete('/api/saved-views/:id', removeSavedView);

app.get(
  '/api/reports/export/orders',
  authorize('Admin', 'finance_head', 'finance_viewer', 'warehouse_head'),
  exportOrders
);
app.get(
  '/api/reports/export/inventory',
  authorize('Admin', 'finance_head', 'finance_viewer', 'warehouse_head', 'purchasing_head'),
  exportInventory
);
app.get(
  '/api/reports/export/production',
  authorize('Admin', 'finance_head', 'finance_viewer', 'warehouse_head'),
  exportProduction
);
app.get(
  '/api/reports/export/ar',
  authorize('Admin', 'finance_head', 'finance_viewer'),
  exportAR
);
app.get(
  '/api/reports/export/ap',
  authorize('Admin', 'finance_head', 'finance_viewer'),
  exportAP
);
app.post(
  '/api/reports/email-digest',
  authorize('Admin', 'finance_head'),
  postEmailDigest
);

app.get(
  '/api/approvals/pending',
  authorize('Admin', 'finance_head', 'purchasing_head'),
  listPending
);
app.post(
  '/api/approvals/:id/approve',
  authorize('Admin', 'finance_head'),
  approveRequest
);
app.post(
  '/api/approvals/:id/reject',
  authorize('Admin', 'finance_head'),
  rejectRequest
);

app.get(
  '/api/audit-logs',
  authorize('Admin', 'finance_head', 'finance_viewer'),
  listAuditLogs
);

app.get(
  '/api/integrations/xero/invoices.csv',
  authorize('Admin', 'finance_head'),
  xeroInvoicesCsv
);
app.get(
  '/api/integrations/qb/bills.csv',
  authorize('Admin', 'finance_head'),
  quickBooksBillsCsv
);
app.get(
  '/api/integrations/qb/expenses.csv',
  authorize('Admin', 'finance_head'),
  qbExpensesCsv
);

app.get('/api/hr/employees', getEmployees);
app.post('/api/hr/employees', createEmployee);
app.put('/api/hr/employees/:id', updateEmployee);
app.get('/api/hr/attendance', getAttendance);
app.post('/api/hr/attendance', logAttendance);
app.get('/api/hr/payroll/export/pension', exportPensionCsv);
app.get('/api/hr/payroll/export/income-tax', exportIncomeTaxCsv);
app.get('/api/hr/payroll/payslip/:id/html', getPayslipHtml);
app.post('/api/hr/payroll/preview', previewPayroll);
app.get('/api/hr/payroll/prepare', preparePayroll);
app.post('/api/hr/payroll/run', runPayrollMonth);
app.patch('/api/hr/payroll/record/:id', updatePayrollRecord);
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

app.use('/api/notifications', notificationRoutes);

app.use(require('./middleware/errorMiddleware'));

module.exports = app;
