const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

function enabled() {
  return String(process.env.AUDIT_LOG_ENABLED || '').toLowerCase() === 'true';
}

/**
 * @param {{ req?: import('express').Request, actorId?: import('mongoose').Types.ObjectId, tenantId?: string, action: string, entityType: string, entityId?: string, summary?: object }} opts
 */
async function record(opts) {
  if (!enabled()) return;
  try {
    const tenantRaw = opts.tenantId || opts.req?.tenantId;
    if (!tenantRaw) {
      logger.warn('audit log skipped: no tenantId on request');
      return;
    }
    const actor = opts.req?.user?._id || opts.actorId || null;
    const summary =
      typeof opts.summary === 'string'
        ? opts.summary
        : JSON.stringify(opts.summary || {}).slice(0, 8000);
    await AuditLog.create({
      tenantId: new mongoose.Types.ObjectId(tenantRaw),
      actor,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId != null ? String(opts.entityId) : '',
      summary,
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'audit log write failed');
  }
}

module.exports = { record, enabled };
