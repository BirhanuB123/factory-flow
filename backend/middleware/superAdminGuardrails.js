const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');

function normalizeIp(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s === '::1') return '127.0.0.1';
  return s.replace(/^::ffff:/, '');
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return normalizeIp(xf.split(',')[0].trim());
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

function parseAllowlist() {
  const raw = String(process.env.SUPER_ADMIN_IP_ALLOWLIST || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => normalizeIp(s))
    .filter(Boolean);
}

function ipAllowed(ip, allowlist) {
  if (!allowlist.length) return true;
  if (!ip) return false;
  if (allowlist.includes(ip)) return true;
  // Simple wildcard support: "10.0.*", "192.168.1.*"
  for (const item of allowlist) {
    if (item.endsWith('*')) {
      const p = item.slice(0, -1);
      if (p && ip.startsWith(p)) return true;
    }
  }
  return false;
}

const enforceSuperAdminIpAllowlist = (req, res, next) => {
  const allowlist = parseAllowlist();
  if (!allowlist.length) return next();

  const ip = getClientIp(req);
  if (!ipAllowed(ip, allowlist)) {
    return res.status(403).json({
      success: false,
      message: 'Platform access blocked from this IP',
    });
  }
  return next();
};

function isDestructivePlatformRequest(req) {
  const m = String(req.method || '').toUpperCase();
  return m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE';
}

/**
 * Optional step-up for destructive platform actions.
 * Enable with SUPER_ADMIN_STEP_UP_REQUIRED=true and send x-step-up-password header.
 */
const requireStepUpForPlatformMutation = asyncHandler(async (req, res, next) => {
  const enabled = String(process.env.SUPER_ADMIN_STEP_UP_REQUIRED || '').toLowerCase() === 'true';
  if (!enabled || !isDestructivePlatformRequest(req)) return next();

  const stepUpPassword = String(req.headers['x-step-up-password'] || '');
  if (!stepUpPassword) {
    return res.status(401).json({
      success: false,
      message: 'Step-up required: include x-step-up-password',
    });
  }

  const user = await Employee.findById(req.user?._id).select('password');
  if (!user || !(await user.matchPassword(stepUpPassword))) {
    return res.status(401).json({
      success: false,
      message: 'Step-up failed: password mismatch',
    });
  }
  return next();
});

module.exports = {
  enforceSuperAdminIpAllowlist,
  requireStepUpForPlatformMutation,
  getClientIp,
};
