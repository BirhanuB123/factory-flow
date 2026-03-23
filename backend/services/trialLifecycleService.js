const Tenant = require('../models/Tenant');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const logger = require('../config/logger');

const DEFAULT_INTERVAL_MS = Math.max(
  parseInt(process.env.TRIAL_AUTO_SUSPEND_INTERVAL_MS, 10) || 5 * 60 * 1000,
  60 * 1000
);

function shouldAutoSuspendEnabled() {
  return String(process.env.TRIAL_AUTO_SUSPEND_ENABLED || 'true').toLowerCase() !== 'false';
}

async function runTrialAutoSuspendOnce(now = new Date()) {
  const expiredTrials = await Tenant.find({
    status: 'trial',
    trialEndDate: { $ne: null, $lte: now },
  })
    .select('_id key displayName status trialEndDate statusReason')
    .lean();

  if (!expiredTrials.length) return { checked: 0, suspended: 0 };

  let suspended = 0;
  for (const t of expiredTrials) {
    const reason =
      t.statusReason && String(t.statusReason).trim()
        ? String(t.statusReason)
        : `Trial expired on ${new Date(t.trialEndDate).toISOString().slice(0, 10)}`;
    const updated = await Tenant.findOneAndUpdate(
      { _id: t._id, status: 'trial' },
      { $set: { status: 'suspended', statusReason: reason } },
      { new: true }
    )
      .select('_id status statusReason')
      .lean();
    if (!updated) continue;
    suspended += 1;
    await PlatformAuditLog.create({
      actorName: 'SYSTEM',
      actorEmployeeId: 'SYSTEM',
      action: 'tenant.trial.auto_suspend',
      resourceType: 'Tenant',
      resourceId: String(t._id),
      details: {
        key: t.key,
        displayName: t.displayName,
        trialEndDate: t.trialEndDate,
        statusReason: updated.statusReason,
      },
      ip: '',
    });
  }

  return { checked: expiredTrials.length, suspended };
}

function startTrialAutoSuspendScheduler() {
  if (process.env.NODE_ENV === 'test') return null;
  if (!shouldAutoSuspendEnabled()) return null;

  const tick = async () => {
    try {
      const out = await runTrialAutoSuspendOnce();
      if (out.suspended > 0) {
        logger.warn(out, 'trial auto-suspend executed');
      }
    } catch (err) {
      logger.error({ err }, 'trial auto-suspend failed');
    }
  };

  const initialDelayMs = Math.min(DEFAULT_INTERVAL_MS, 15 * 1000);
  setTimeout(tick, initialDelayMs).unref?.();
  const timer = setInterval(tick, DEFAULT_INTERVAL_MS);
  timer.unref?.();
  logger.info(
    { intervalMs: DEFAULT_INTERVAL_MS },
    'trial auto-suspend scheduler started'
  );
  return timer;
}

module.exports = {
  runTrialAutoSuspendOnce,
  startTrialAutoSuspendScheduler,
};
