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

      req.user = await Employee.findById(decoded.id).select('-password');
      if (!req.user) {
        throw auth401(
          'Your session is no longer valid (e.g. after a database reset). Please log in again.'
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
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`User role ${req.user ? req.user.role : 'Unknown'} is not authorized to access this route`);
    }
    next();
  };
};

const { authorizePerm, can, rolePermissions, getMatrixDoc, P } = require('../config/permissions');

module.exports = { protect, authorize, authorizePerm, can, rolePermissions, getMatrixDoc, P };
