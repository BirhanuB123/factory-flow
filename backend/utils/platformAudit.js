const PlatformAuditLog = require('../models/PlatformAuditLog');
const logger = require('../config/logger');

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim();
  }
  return req.ip || '';
}

/**
 * Best-effort audit for super-admin platform actions (never throws to caller).
 * @param {import('express').Request} req
 * @param {{ action: string, resourceType?: string, resourceId?: string, details?: Record<string, unknown> }} payload
 */
async function logPlatformAction(req, payload) {
  try {
    const u = req.user;
    await PlatformAuditLog.create({
      actorId: u?._id,
      actorEmployeeId: u?.employeeId != null ? String(u.employeeId) : '',
      actorName: u?.name != null ? String(u.name) : '',
      action: payload.action,
      resourceType: payload.resourceType || '',
      resourceId: payload.resourceId != null ? String(payload.resourceId) : '',
      details: payload.details && typeof payload.details === 'object' ? payload.details : {},
      ip: clientIp(req),
    });
  } catch (err) {
    logger.warn({ err }, 'platformAudit: failed to persist audit row');
  }
}

module.exports = { logPlatformAction, clientIp };
