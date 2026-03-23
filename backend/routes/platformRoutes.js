const express = require('express');
const {
  createTenant,
  listTenants,
  getTenantDetail,
  patchTenant,
  updateTenantStatus,
  extendTenantTrial,
  createTenantAdmin,
  getPlatformMetrics,
  listPlatformAuditLogs,
  exportPlatformAuditLogsCsv,
  getGlobalAnnouncement,
  updateGlobalAnnouncement,
} = require('../controllers/platformController');

const router = express.Router();

router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.get('/announcement', getGlobalAnnouncement);
router.patch('/announcement', updateGlobalAnnouncement);
// PUT alias: some proxies / older deployments only allow GET/POST/PUT.
router.put('/announcement', updateGlobalAnnouncement);
router.get('/tenants/:id', getTenantDetail);
router.patch('/tenants/:id/status', updateTenantStatus);
router.patch('/tenants/:id/trial', extendTenantTrial);
router.patch('/tenants/:id', patchTenant);
router.post('/tenants/:id/admin', createTenantAdmin);
router.get('/metrics', getPlatformMetrics);
router.get('/audit-logs/export', exportPlatformAuditLogsCsv);
router.get('/audit-logs', listPlatformAuditLogs);

module.exports = router;
