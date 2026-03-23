const express = require('express');
const router = express.Router();
const {
  loginUser,
  getMe,
  completeInvite,
  changePassword,
  getPermissionsDoc,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { withTenant } = require('../middleware/tenantMiddleware');
const { loginLimiter, inviteCompleteLimiter } = require('../middleware/rateLimits');
const {
  loginRules,
  completeInviteRules,
  changePasswordRules,
  handleValidation,
} = require('../middleware/validateRequest');

router.post('/login', loginLimiter, loginRules, handleValidation, loginUser);
router.post(
  '/complete-invite',
  inviteCompleteLimiter,
  completeInviteRules,
  handleValidation,
  completeInvite
);
router.put('/password', protect, changePasswordRules, handleValidation, changePassword);
router.get('/me', protect, withTenant, getMe);
router.get('/permissions', protect, withTenant, getPermissionsDoc);

module.exports = router;
