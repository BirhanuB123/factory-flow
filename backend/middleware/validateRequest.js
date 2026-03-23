const { body, param, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array({ onlyFirstError: true }),
    });
  }
  next();
};

const loginRules = [
  body('password').trim().notEmpty().isLength({ max: 256 }).withMessage('password required'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 320 }),
  body('employeeId').optional({ values: 'falsy' }).trim().isLength({ min: 1, max: 64 }),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.employeeId) {
      throw new Error('Provide email or employeeId');
    }
    return true;
  }),
];

const movementRules = [
  body('productId').isMongoId().withMessage('valid productId required'),
  body('kind').isIn(['receipt', 'issue', 'adjustment']).withMessage('invalid kind'),
  body('quantity').isNumeric().withMessage('quantity must be numeric'),
  body('note').optional().trim().isLength({ max: 2000 }),
];

const mongoIdParam = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage('invalid id'),
];

const completeInviteRules = [
  body('token').trim().notEmpty().isLength({ min: 8, max: 512 }).withMessage('token required'),
  body('newPassword')
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8–128 characters'),
];

const changePasswordRules = [
  body('currentPassword').trim().notEmpty().isLength({ max: 256 }),
  body('newPassword')
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be 8–128 characters'),
];

module.exports = {
  handleValidation,
  loginRules,
  completeInviteRules,
  changePasswordRules,
  movementRules,
  mongoIdParam,
};
