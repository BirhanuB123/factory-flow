const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/loadEnv');

/**
 * @param {string | import('mongoose').Types.ObjectId | { id: string; tenantId?: import('mongoose').Types.ObjectId | null; platformRole?: string }} userOrId
 */
const generateToken = (userOrId) => {
  const payload =
    userOrId && typeof userOrId === 'object' && 'id' in userOrId
      ? {
          id: String(userOrId.id),
          tenantId: userOrId.tenantId ? String(userOrId.tenantId) : null,
          platformRole: userOrId.platformRole || 'none',
        }
      : {
          id: String(userOrId),
          tenantId: null,
          platformRole: 'none',
        };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

module.exports = generateToken;
