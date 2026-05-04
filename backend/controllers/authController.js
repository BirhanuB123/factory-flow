const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Employee = require('../models/Employee');
const Tenant = require('../models/Tenant');
const generateToken = require('../utils/generateToken');
const { rolePermissions } = require('../config/permissions');
const { hashInviteToken } = require('../utils/inviteToken');
const { ensureTenantAccess } = require('../utils/tenantAccess');
const { normalizeModuleFlags } = require('../utils/tenantModules');

// --- Multer config for avatar uploads ---
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || '.png';
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});

const avatarFileFilter = (_req, file, cb) => {
  const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (allowed.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'), false);
  }
};

const uploadAvatarMulter = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('avatar');

async function buildTenantSubscription(tenantId) {
  if (!tenantId) return null;
  const tenant = await Tenant.findById(tenantId).select(
    'status plan trialEndDate statusReason displayName legalName moduleFlags'
  );
  if (!tenant) return null;
  return {
    status: tenant.status,
    plan: tenant.plan || 'starter',
    trialEndDate: tenant.trialEndDate || null,
    statusReason: tenant.statusReason || '',
    displayName: tenant.displayName || tenant.legalName || '',
    moduleFlags: normalizeModuleFlags(tenant.moduleFlags),
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
    if (user.platformRole !== 'super_admin') {
      const access = await ensureTenantAccess(user.tenantId);
      if (!access.ok) {
        return res.status(access.code || 403).json({
          success: false,
          message: access.reason || 'Tenant subscription is not active',
        });
      }
    }
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
      profilePicture: user.profilePicture || '',
      permissions: rolePermissions(user.role),
      tenantSubscription,
      tenantModuleFlags: tenantSubscription?.moduleFlags || undefined,
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
    if (user.platformRole !== 'super_admin') {
      const access = await ensureTenantAccess(user.tenantId);
      if (!access.ok) {
        return res.status(access.code || 403).json({
          success: false,
          message: access.reason || 'Tenant subscription is not active',
        });
      }
    }
    const effectiveTenantId = req.tenantId || user.tenantId;
    const tenantSubscription = await buildTenantSubscription(effectiveTenantId);
    res.json({
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      tenantId: effectiveTenantId,
      platformRole: user.platformRole || 'none',
      mustChangePassword: !!user.mustChangePassword,
      profilePicture: user.profilePicture || '',
      permissions: rolePermissions(user.role),
      tenantSubscription,
      tenantModuleFlags: tenantSubscription?.moduleFlags || undefined,
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

// @desc    Update current user profile
// @route   PATCH /api/auth/me
// @access  Private
const updateMe = asyncHandler(async (req, res) => {
  const user = await Employee.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    // We don't allow updating email or role here for security;
    // those should be done by an admin in the HR module.
    
    const updatedUser = await user.save();

    const tenantSubscription = await buildTenantSubscription(updatedUser.tenantId);
    res.json({
      _id: updatedUser._id,
      employeeId: updatedUser.employeeId,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      department: updatedUser.department,
      tenantId: updatedUser.tenantId,
      platformRole: updatedUser.platformRole || 'none',
      mustChangePassword: !!updatedUser.mustChangePassword,
      profilePicture: updatedUser.profilePicture || '',
      permissions: rolePermissions(updatedUser.role),
      tenantSubscription,
      tenantModuleFlags: tenantSubscription?.moduleFlags || undefined,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Upload / update avatar for current user
// @route   POST /api/auth/me/avatar
// @access  Private (all roles)
const uploadAvatar = (req, res) => {
  uploadAvatarMulter(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ success: false, message: multerErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    try {
      const relativePath = `/uploads/avatars/${req.file.filename}`;
      const user = await Employee.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Delete old avatar if it exists and is a different file
      if (user.profilePicture && user.profilePicture !== relativePath) {
        const oldPath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      user.profilePicture = relativePath;
      await user.save();

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
        profilePicture: user.profilePicture,
        permissions: rolePermissions(user.role),
        tenantSubscription,
        tenantModuleFlags: tenantSubscription?.moduleFlags || undefined,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message || 'Avatar upload failed' });
    }
  });
};

module.exports = {
  loginUser,
  getMe,
  completeInvite,
  changePassword,
  getPermissionsDoc,
  updateMe,
  uploadAvatar,
};
