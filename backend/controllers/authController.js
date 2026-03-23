const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Tenant = require('../models/Tenant');
const generateToken = require('../utils/generateToken');
const { rolePermissions } = require('../config/permissions');
const { hashInviteToken } = require('../utils/inviteToken');

async function buildTenantSubscription(tenantId) {
  if (!tenantId) return null;
  const tenant = await Tenant.findById(tenantId).select('status plan trialEndDate statusReason displayName legalName');
  if (!tenant) return null;
  return {
    status: tenant.status,
    plan: tenant.plan || 'starter',
    trialEndDate: tenant.trialEndDate || null,
    statusReason: tenant.statusReason || '',
    displayName: tenant.displayName || tenant.legalName || '',
  };
}

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, employeeId, password } = req.body;

  // Allow login by either email or employeeId
  const user = await Employee.findOne({
    $or: [{ email }, { employeeId }]
  });

  if (user && (await user.matchPassword(password))) {
    const tenantSubscription = await buildTenantSubscription(user.tenantId);
    res.json({
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      tenantId: user.tenantId,
      platformRole: user.platformRole || 'none',
      mustChangePassword: !!user.mustChangePassword,
      permissions: rolePermissions(user.role),
      tenantSubscription,
      token: generateToken({
        id: user._id,
        tenantId: user.tenantId,
        platformRole: user.platformRole || 'none',
      }),
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
});


const getMe = asyncHandler(async (req, res) => {
  const user = await Employee.findById(req.user._id);

  if (user) {
    const tenantSubscription = await buildTenantSubscription(user.tenantId);
    res.json({
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      tenantId: user.tenantId,
      platformRole: user.platformRole || 'none',
      mustChangePassword: !!user.mustChangePassword,
      permissions: rolePermissions(user.role),
      tenantSubscription,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Set password using one-time invite token (public)
// @route   POST /api/auth/complete-invite
// @access  Public
const completeInvite = asyncHandler(async (req, res) => {
  const rawToken = String(req.body.token || '').trim();
  const newPassword = String(req.body.newPassword || '').trim();
  const incomingHash = hashInviteToken(rawToken);
  const user = await Employee.findOne({
    passwordResetTokenHash: incomingHash,
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired invite link');
  }
  user.password = newPassword;
  user.mustChangePassword = false;
  user.passwordResetTokenHash = '';
  user.passwordResetExpires = null;
  await user.save();
  res.json({ success: true, message: 'Password set. You can sign in now.' });
});

// @desc    Change password while logged in
// @route   PUT /api/auth/password
// @access  Private (no withTenant — works for all authenticated users)
const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '').trim();
  const user = await Employee.findById(req.user._id);
  if (!user || !(await user.matchPassword(currentPassword))) {
    res.status(400);
    throw new Error('Current password does not match');
  }
  user.password = newPassword;
  user.mustChangePassword = false;
  user.passwordResetTokenHash = '';
  user.passwordResetExpires = null;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

const getPermissionsDoc = asyncHandler(async (req, res) => {
  const { getMatrixDoc, rolePermissions } = require('../config/permissions');
  res.json({
    role: req.user.role,
    permissions: rolePermissions(req.user.role),
    matrix: getMatrixDoc(),
  });
});

module.exports = {
  loginUser,
  getMe,
  completeInvite,
  changePassword,
  getPermissionsDoc,
};
