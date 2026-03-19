const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/loadEnv');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

module.exports = generateToken;
