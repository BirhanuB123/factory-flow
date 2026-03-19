const express = require('express');
const router = express.Router();
const { loginUser, getMe, getPermissionsDoc } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimits');
const { loginRules, handleValidation } = require('../middleware/validateRequest');

router.post('/login', loginLimiter, loginRules, handleValidation, loginUser);
router.get('/me', protect, getMe);
router.get('/permissions', protect, getPermissionsDoc);

module.exports = router;
