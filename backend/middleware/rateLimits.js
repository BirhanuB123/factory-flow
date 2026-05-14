const rateLimit = require('express-rate-limit');

function minutesFromEnv(name, fallbackMinutes) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallbackMinutes;
}

const AUTH_RATE_LIMIT_WINDOW_MS =
  minutesFromEnv('RATE_LIMIT_AUTH_WINDOW_MINUTES', 90) * 60 * 1000;
const API_RATE_LIMIT_WINDOW_MS =
  minutesFromEnv('RATE_LIMIT_API_WINDOW_MINUTES', 1) * 60 * 1000;
const PLATFORM_RATE_LIMIT_WINDOW_MS =
  minutesFromEnv('RATE_LIMIT_PLATFORM_WINDOW_MINUTES', 1) * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 30),
  message: { success: false, message: 'Too many login attempts, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const inviteCompleteLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_INVITE_COMPLETE_MAX || 25),
  message: { success: false, message: 'Too many attempts, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_API_MAX || 600),
  message: { success: false, message: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const platformLimiter = rateLimit({
  windowMs: PLATFORM_RATE_LIMIT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_PLATFORM_MAX || 120),
  message: { success: false, message: 'Too many platform requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { loginLimiter, inviteCompleteLimiter, apiLimiter, platformLimiter };
