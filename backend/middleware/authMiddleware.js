const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const { getJwtVerifySecrets } = require('../config/loadEnv');

function verifyBearerToken(token) {
  const secrets = getJwtVerifySecrets();
  let lastErr;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (e) {
      lastErr = e;
      if (e.name === 'TokenExpiredError') throw e;
      if (e.name === 'JsonWebTokenError' && String(e.message).includes('invalid signature')) {
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function auth401(message) {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = verifyBearerToken(token);

      // Exclude only password; keep tenantId + platformRole for withTenant / super-admin.
      req.user = await Employee.findById(decoded.id).select('-password');
      if (!req.user) {
        throw auth401(
          'Your session is no longer valid (e.g. after a database reset). Please log in again.'
        );
      }

      if (req.user.platformRole !== 'super_admin' && !req.user.tenantId) {
        throw auth401(
          'Your account is not linked to a company. Run: npm run migrate:tenant (or ask an administrator).'
        );
      }

      next();
    } catch (error) {
      if (error.statusCode === 401) throw error;
      throw auth401(
        error.name === 'TokenExpiredError'
          ? 'Session expired. Please log in again.'
          : 'Not authorized, token failed'
      );
    }
  }

  if (!token) {
    throw auth401('Not authorized, no token');
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    // Platform admins have implicit access to module summaries for monitoring.
    if (req.user && req.user.platformRole === 'super_admin') {
      return next();
    }
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`User role ${req.user ? req.user.role : 'Unknown'} is not authorized to access this route`);
    }
    next();
  };
};

const { authorizePerm, can, rolePermissions, getMatrixDoc, P } = require('../config/permissions');

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.platformRole !== 'super_admin') {
    const err = new Error('Super admin only');
    err.statusCode = 403;
    throw err;
  }
  next();
};

module.exports = {
  protect,
  authorize,
  authorizePerm,
  can,
  rolePermissions,
  getMatrixDoc,
  P,
  requireSuperAdmin,
};
