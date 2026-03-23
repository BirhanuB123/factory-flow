const asyncHandler = require('express-async-handler');
const Tenant = require('../models/Tenant');
const PlatformSettings = require('../models/PlatformSettings');

/**
 * Authenticated endpoint (after protect + withTenant):
 * Returns effective announcement (tenant override first, then global).
 */
exports.getCurrentAnnouncement = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId ? String(req.tenantId) : '';
  let tenantAnnouncement = null;

  if (tenantId) {
    const tenant = await Tenant.findById(tenantId).select('announcement').lean();
    tenantAnnouncement = tenant?.announcement || null;
  }

  if (tenantAnnouncement?.enabled && tenantAnnouncement?.message) {
    return res.json({
      success: true,
      data: {
        source: 'tenant',
        ...tenantAnnouncement,
      },
    });
  }

  const settings = await PlatformSettings.findOne({ key: 'global' })
    .select('globalAnnouncement')
    .lean();
  const globalAnnouncement = settings?.globalAnnouncement || null;
  if (globalAnnouncement?.enabled && globalAnnouncement?.message) {
    return res.json({
      success: true,
      data: {
        source: 'global',
        ...globalAnnouncement,
      },
    });
  }

  return res.json({ success: true, data: null });
});
