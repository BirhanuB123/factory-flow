const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const PurchaseOrder = require('../models/PurchaseOrder');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const PlatformSettings = require('../models/PlatformSettings');
const { logPlatformAction } = require('../utils/platformAudit');
const { mergeModuleFlagsPatch } = require('../utils/tenantModules');
const { generateInviteRawToken, hashInviteToken } = require('../utils/inviteToken');
const { sendTenantAdminInvite } = require('../services/inviteEmailService');

const ALLOWED_INDUSTRY = ['manufacturing', 'distribution', 'retail', 'service', 'other'];
const DEFAULT_TRIAL_DAYS = Math.min(
  Math.max(parseInt(process.env.TRIAL_DEFAULT_DAYS, 10) || 14, 1),
  3650
);

const INVITE_VALID_DAYS = Math.min(Math.max(parseInt(process.env.INVITE_TOKEN_VALID_DAYS, 10) || 7, 1), 30);

/** Preset action values for filters / UI (any string up to 120 chars is still allowed in `action` query). */
const PLATFORM_AUDIT_ACTION_PRESETS = [
  'tenant.create',
  'tenant.patch',
  'tenant.status',
  'tenant.admin.create',
];

function parseDayStartUtc(isoDateStr) {
  const s = String(isoDateStr || '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEndUtc(isoDateStr) {
  const s = String(isoDateStr || '').trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildPlatformAuditFilter(query) {
  const filter = {};
  const rawAction = typeof query.action === 'string' ? query.action.trim() : '';
  if (rawAction && rawAction.toLowerCase() !== 'all') {
    filter.action = rawAction.slice(0, 120);
  }
  const from = query.dateFrom ? parseDayStartUtc(query.dateFrom) : null;
  const to = query.dateTo ? parseDayEndUtc(query.dateTo) : null;
  if (from && to && from.getTime() > to.getTime()) {
    return { error: 'dateFrom must be before or equal to dateTo' };
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  return { filter };
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getPublicAppOrigin() {
  return String(
    process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
  ).replace(/\/$/, '');
}

function generateBootstrapPassword() {
  return crypto.randomBytes(28).toString('base64url');
}

function generateTempPasswordForUser() {
  const a = crypto.randomBytes(3).toString('hex');
  const b = crypto.randomBytes(3).toString('hex');
  return `Iw1!${a}_${b}x9`;
}

function normalizeKey(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseIsoDate(value) {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysUntil(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAnnouncementPayload(input, actorEmployeeId) {
  const enabled = !!input?.enabled;
  const levelRaw = String(input?.level || 'info').trim().toLowerCase();
  const level = ['info', 'warning', 'maintenance'].includes(levelRaw) ? levelRaw : 'info';
  const message = String(input?.message || '').trim().slice(0, 5000);
  return {
    enabled: enabled && !!message,
    level,
    message,
    updatedAt: new Date(),
    updatedByEmployeeId: actorEmployeeId ? String(actorEmployeeId) : '',
  };
}

/** @param {import('mongoose').Model} Model */
async function aggregateCountsByTenant(Model, tenantIds, extraMatch = {}) {
  if (!tenantIds.length) return new Map();
  const rows = await Model.aggregate([
    { $match: { tenantId: { $in: tenantIds }, ...extraMatch } },
    { $group: { _id: '$tenantId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

exports.createTenant = asyncHandler(async (req, res) => {
  const key = normalizeKey(req.body.key);
  const legalName = String(req.body.legalName || '').trim();
  const displayName = String(req.body.displayName || legalName).trim();
  if (!key || !legalName || !displayName) {
    return res.status(400).json({
      success: false,
      message: 'key, legalName, and displayName are required',
    });
  }

  const industry = ALLOWED_INDUSTRY.includes(String(req.body.industry))
    ? String(req.body.industry)
    : 'manufacturing';
  const moduleFlags = mergeModuleFlagsPatch(undefined, req.body.moduleFlags || {});
  const status = req.body.status || 'active';
  let trialEndDate = null;
  if (status === 'trial') {
    const parsedTrialEnd = parseIsoDate(req.body.trialEndDate);
    trialEndDate =
      parsedTrialEnd || new Date(Date.now() + DEFAULT_TRIAL_DAYS * 86400000);
  }

  const tenant = await Tenant.create({
    key,
    legalName,
    displayName,
    industry,
    status,
    trialEndDate,
    plan: req.body.plan || 'starter',
    billingProvider: ['none', 'manual', 'stripe', 'chapa', 'other'].includes(String(req.body.billingProvider))
      ? String(req.body.billingProvider)
      : 'none',
    billingCustomerId: String(req.body.billingCustomerId || '').trim().slice(0, 200),
    announcement: normalizeAnnouncementPayload(req.body.announcement, req.user?.employeeId),
    timezone: req.body.timezone || 'Africa/Addis_Ababa',
    currency: req.body.currency || 'ETB',
    moduleFlags,
  });
  await logPlatformAction(req, {
    action: 'tenant.create',
    resourceType: 'Tenant',
    resourceId: String(tenant._id),
    details: {
      key: tenant.key,
      displayName: tenant.displayName,
      status: tenant.status,
      trialEndDate: tenant.trialEndDate || undefined,
      plan: tenant.plan,
      billingProvider: tenant.billingProvider,
      billingCustomerId: tenant.billingCustomerId || undefined,
    },
  });
  res.status(201).json({ success: true, data: tenant });
});

exports.listTenants = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ key: rx }, { displayName: rx }, { legalName: rx }];
  }

  const list = await Tenant.find(filter).sort({ createdAt: -1 }).lean();
  const tenantIds = list.map((t) => t._id);

  let adminMap = new Map();
  let empMap = new Map();
  let prodMap = new Map();
  let ordMap = new Map();
  let cliMap = new Map();
  let invMap = new Map();
  let poMap = new Map();

  if (tenantIds.length) {
    [
      adminMap,
      empMap,
      prodMap,
      ordMap,
      cliMap,
      invMap,
      poMap,
    ] = await Promise.all([
      aggregateCountsByTenant(Employee, tenantIds, { role: 'Admin' }),
      aggregateCountsByTenant(Employee, tenantIds, {}),
      aggregateCountsByTenant(Product, tenantIds, {}),
      aggregateCountsByTenant(Order, tenantIds, {}),
      aggregateCountsByTenant(Client, tenantIds, {}),
      aggregateCountsByTenant(Invoice, tenantIds, {}),
      aggregateCountsByTenant(PurchaseOrder, tenantIds, {}),
    ]);
  }

  const data = list.map((t) => {
    const id = String(t._id);
    const documentCounts = {
      employees: empMap.get(id) || 0,
      products: prodMap.get(id) || 0,
      orders: ordMap.get(id) || 0,
      clients: cliMap.get(id) || 0,
      invoices: invMap.get(id) || 0,
      purchaseOrders: poMap.get(id) || 0,
    };
    const totalDocuments = Object.values(documentCounts).reduce((a, b) => a + b, 0);
    const adminCount = adminMap.get(id) || 0;
    return {
      ...t,
      health: {
        lastApiActivityAt: t.lastApiActivityAt || null,
        statusReason: t.statusReason || '',
        trialEndDate: t.trialEndDate || null,
        trialExpired: t.status === 'trial' && !!t.trialEndDate && new Date(t.trialEndDate) < new Date(),
        trialDaysLeft:
          t.status === 'trial' && t.trialEndDate ? daysUntil(t.trialEndDate) : null,
        adminCount,
        zeroAdmins: adminCount === 0,
        documentCounts,
        totalDocuments,
      },
    };
  });

  res.json({ success: true, count: data.length, data, query: q || undefined });
});

exports.getTenantDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant id' });
  }
  const tenantObjectId = new mongoose.Types.ObjectId(id);
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const [
    employees,
    products,
    orders,
    clients,
    invoices,
    purchaseOrders,
    admins,
    users,
  ] = await Promise.all([
    Employee.countDocuments({ tenantId: tenantObjectId }),
    Product.countDocuments({ tenantId: tenantObjectId }),
    Order.countDocuments({ tenantId: tenantObjectId }),
    Client.countDocuments({ tenantId: tenantObjectId }),
    Invoice.countDocuments({ tenantId: tenantObjectId }),
    PurchaseOrder.countDocuments({ tenantId: tenantObjectId }),
    Employee.countDocuments({ tenantId: tenantObjectId, role: 'Admin' }),
    Employee.find({ tenantId: tenantObjectId })
      .select('name employeeId role email status department')
      .sort({ name: 1 })
      .limit(150)
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      tenant,
      counts: {
        employees,
        products,
        orders,
        clients,
        invoices,
        purchaseOrders,
        admins,
      },
      users,
    },
  });
});

exports.patchTenant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant id' });
  }

  const prev = await Tenant.findById(id).lean();
  if (!prev) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const $set = {};

  if (req.body.displayName != null) {
    const v = String(req.body.displayName).trim();
    if (!v) {
      return res.status(400).json({ success: false, message: 'displayName cannot be empty' });
    }
    $set.displayName = v;
  }
  if (req.body.legalName != null) {
    const v = String(req.body.legalName).trim();
    if (!v) {
      return res.status(400).json({ success: false, message: 'legalName cannot be empty' });
    }
    $set.legalName = v;
  }
  if (req.body.plan != null) {
    $set.plan = String(req.body.plan).trim().slice(0, 64) || 'starter';
  }
  if (req.body.billingProvider != null) {
    const provider = String(req.body.billingProvider).trim().toLowerCase();
    if (!['none', 'manual', 'stripe', 'chapa', 'other'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'billingProvider must be one of: none, manual, stripe, chapa, other',
      });
    }
    $set.billingProvider = provider;
  }
  if (req.body.billingCustomerId != null) {
    $set.billingCustomerId = String(req.body.billingCustomerId).trim().slice(0, 200);
  }
  if (req.body.timezone != null) {
    $set.timezone = String(req.body.timezone).trim().slice(0, 120);
  }
  if (req.body.currency != null) {
    $set.currency = String(req.body.currency).trim().toUpperCase().slice(0, 8);
  }
  if (req.body.industry != null) {
    const ind = String(req.body.industry);
    if (!ALLOWED_INDUSTRY.includes(ind)) {
      return res.status(400).json({
        success: false,
        message: `industry must be one of: ${ALLOWED_INDUSTRY.join(', ')}`,
      });
    }
    $set.industry = ind;
  }
  if (req.body.moduleFlags != null && typeof req.body.moduleFlags === 'object') {
    $set.moduleFlags = mergeModuleFlagsPatch(prev.moduleFlags, req.body.moduleFlags);
  }
  if (req.body.statusReason != null) {
    $set.statusReason = String(req.body.statusReason).trim().slice(0, 2000);
  }
  if (req.body.trialEndDate != null) {
    const parsed = parseIsoDate(req.body.trialEndDate);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Invalid trialEndDate' });
    }
    $set.trialEndDate = parsed;
  }
  if (req.body.announcement != null && typeof req.body.announcement === 'object') {
    $set.announcement = normalizeAnnouncementPayload(req.body.announcement, req.user?.employeeId);
  }

  if (Object.keys($set).length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'No valid fields to update (allowed: displayName, legalName, plan, timezone, currency, industry, moduleFlags, statusReason, trialEndDate, billingProvider, billingCustomerId, announcement)',
    });
  }

  const t = await Tenant.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true });
  if (!t) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  await logPlatformAction(req, {
    action: 'tenant.patch',
    resourceType: 'Tenant',
    resourceId: String(t._id),
    details: {
      key: t.key,
      updatedFields: Object.keys($set),
      snapshot: {
        displayName: t.displayName,
        plan: t.plan,
        billingProvider: t.billingProvider,
        billingCustomerId: t.billingCustomerId,
        announcement: t.announcement,
        timezone: t.timezone,
        currency: t.currency,
        industry: t.industry,
        trialEndDate: t.trialEndDate || undefined,
        moduleFlags: t.moduleFlags,
      },
    },
  });

  res.json({ success: true, data: t });
});

exports.updateTenantStatus = asyncHandler(async (req, res) => {
  const allowed = ['active', 'suspended', 'trial', 'archived'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${allowed.join(', ')}`,
    });
  }
  const $set = { status: req.body.status };
  if (req.body.status === 'active' || req.body.status === 'trial') {
    $set.statusReason = '';
  } else {
    const reason =
      req.body.statusReason != null ? String(req.body.statusReason).trim().slice(0, 2000) : '';
    $set.statusReason = reason;
  }
  if (req.body.status === 'trial') {
    const parsedTrial = parseIsoDate(req.body.trialEndDate);
    if (req.body.trialEndDate != null && !parsedTrial) {
      return res.status(400).json({ success: false, message: 'Invalid trialEndDate' });
    }
    $set.trialEndDate = parsedTrial || new Date(Date.now() + DEFAULT_TRIAL_DAYS * 86400000);
  }

  const prev = await Tenant.findById(req.params.id)
    .select('status key displayName statusReason')
    .lean();
  const t = await Tenant.findByIdAndUpdate(req.params.id, { $set }, { new: true });
  if (!t) return res.status(404).json({ success: false, message: 'Tenant not found' });
  await logPlatformAction(req, {
    action: 'tenant.status',
    resourceType: 'Tenant',
    resourceId: String(t._id),
    details: {
      from: prev?.status,
      to: t.status,
      key: t.key,
      displayName: t.displayName,
      statusReason: t.statusReason || undefined,
      trialEndDate: t.trialEndDate || undefined,
    },
  });
  res.json({ success: true, data: t });
});

exports.extendTenantTrial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant id' });
  }
  const t = await Tenant.findById(id).select('status trialEndDate key displayName').lean();
  if (!t) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const explicitDate = parseIsoDate(req.body.trialEndDate);
  if (req.body.trialEndDate != null && !explicitDate) {
    return res.status(400).json({ success: false, message: 'Invalid trialEndDate' });
  }

  const extendDays =
    req.body.extendDays != null
      ? Math.min(Math.max(parseInt(req.body.extendDays, 10) || 0, 1), 3650)
      : 7;

  const base =
    t.trialEndDate && new Date(t.trialEndDate).getTime() > Date.now()
      ? new Date(t.trialEndDate)
      : new Date();
  const nextTrialEndDate = explicitDate || new Date(base.getTime() + extendDays * 86400000);

  const updated = await Tenant.findByIdAndUpdate(
    id,
    {
      $set: {
        status: 'trial',
        statusReason: '',
        trialEndDate: nextTrialEndDate,
      },
    },
    { new: true }
  );
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  await logPlatformAction(req, {
    action: 'tenant.trial.extend',
    resourceType: 'Tenant',
    resourceId: String(updated._id),
    details: {
      key: updated.key,
      displayName: updated.displayName,
      trialEndDate: updated.trialEndDate,
      extendDays: explicitDate ? undefined : extendDays,
    },
  });

  res.json({ success: true, data: updated });
});

exports.createTenantAdmin = asyncHandler(async (req, res) => {
  const tenantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant id' });
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const employeeId = String(req.body.employeeId || '').trim();
  const name = String(req.body.name || '').trim();
  const department = String(req.body.department || 'Administration').trim();
  const role = String(req.body.role || 'Admin').trim();
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';

  const onboardingMode = ['manual', 'temp_password', 'invite_link'].includes(req.body.onboardingMode)
    ? req.body.onboardingMode
    : 'manual';

  if (!employeeId || !name) {
    return res.status(400).json({
      success: false,
      message: 'employeeId and name are required',
    });
  }

  if (onboardingMode === 'invite_link' && !email) {
    return res.status(400).json({
      success: false,
      message: 'email is required for invite_link onboarding',
    });
  }

  let plainPasswordForCreate;
  let mustChangePassword = false;
  let passwordResetTokenHash;
  let passwordResetExpires;
  let inviteRawToken;

  if (onboardingMode === 'manual') {
    plainPasswordForCreate = String(req.body.password || '').trim();
    if (!plainPasswordForCreate) {
      return res.status(400).json({
        success: false,
        message: 'password is required for manual onboarding',
      });
    }
  } else if (onboardingMode === 'temp_password') {
    plainPasswordForCreate = generateTempPasswordForUser();
    mustChangePassword = true;
  } else {
    plainPasswordForCreate = generateBootstrapPassword();
    mustChangePassword = true;
    inviteRawToken = generateInviteRawToken();
    passwordResetTokenHash = hashInviteToken(inviteRawToken);
    passwordResetExpires = new Date(Date.now() + INVITE_VALID_DAYS * 86400000);
  }

  const exists = await Employee.findOne({ tenantId, employeeId });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Employee ID already exists in tenant' });
  }

  if (email) {
    const emailTaken = await Employee.findOne({ tenantId, email });
    if (emailTaken) {
      return res.status(400).json({ success: false, message: 'Email already in use for this tenant' });
    }
  }

  const user = await Employee.create({
    tenantId,
    platformRole: 'none',
    employeeId,
    name,
    role,
    department,
    status: 'Active',
    email,
    password: plainPasswordForCreate,
    mustChangePassword,
    ...(passwordResetTokenHash
      ? { passwordResetTokenHash, passwordResetExpires }
      : {}),
  });

  const origin = getPublicAppOrigin();
  let inviteUrl;
  if (onboardingMode === 'invite_link' && inviteRawToken) {
    inviteUrl = `${origin}/invite?token=${encodeURIComponent(inviteRawToken)}`;
  }

  let emailResult = { sent: false };
  if (onboardingMode === 'invite_link' && email && inviteUrl) {
    emailResult = await sendTenantAdminInvite({
      to: email,
      employeeName: name,
      tenantDisplayName: tenant.displayName || tenant.legalName,
      inviteUrl,
    });
  }

  await logPlatformAction(req, {
    action: 'tenant.admin.create',
    resourceType: 'Employee',
    resourceId: String(user._id),
    details: {
      tenantId: String(tenantId),
      tenantKey: tenant.key,
      employeeId: user.employeeId,
      name: user.name,
      onboardingMode,
      inviteEmailed: onboardingMode === 'invite_link' ? emailResult.sent : undefined,
    },
  });

  const payload = {
    success: true,
    data: {
      _id: user._id,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      email: user.email,
      onboardingMode,
      mustChangePassword: user.mustChangePassword,
    },
  };

  if (onboardingMode === 'temp_password') {
    payload.temporaryPassword = plainPasswordForCreate;
  }
  if (onboardingMode === 'invite_link' && inviteUrl) {
    payload.invite = {
      url: inviteUrl,
      emailed: emailResult.sent,
      expiresAt: passwordResetExpires,
    };
    if (emailResult.error) payload.invite.emailError = emailResult.error;
  }

  res.status(201).json(payload);
});

/**
 * Super-admin account recovery for tenant admins.
 * - temp_password: sets a generated temporary password + mustChangePassword=true
 * - invite_link: rotates one-time invite token and optionally sends email
 */
exports.resetTenantAdminAccess = asyncHandler(async (req, res) => {
  const tenantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant id' });
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const employeeId = String(req.params.employeeId || '').trim();
  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'employeeId path parameter is required' });
  }

  const onboardingMode = ['temp_password', 'invite_link'].includes(String(req.body.onboardingMode || ''))
    ? String(req.body.onboardingMode)
    : 'temp_password';

  const user = await Employee.findOne({ tenantId, employeeId });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found in tenant',
    });
  }

  const origin = getPublicAppOrigin();
  const email =
    req.body.email != null ? String(req.body.email).trim().toLowerCase() : String(user.email || '').trim().toLowerCase();

  if (onboardingMode === 'invite_link' && !email) {
    return res.status(400).json({
      success: false,
      message: 'email is required for invite_link onboarding',
    });
  }

  let temporaryPassword;
  let inviteUrl;
  let passwordResetExpires;
  let emailResult = { sent: false };

  if (onboardingMode === 'temp_password') {
    temporaryPassword = generateTempPasswordForUser();
    user.password = temporaryPassword;
    user.mustChangePassword = true;
    user.passwordResetTokenHash = '';
    user.passwordResetExpires = null;
    await user.save();
  } else {
    const inviteRawToken = generateInviteRawToken();
    passwordResetExpires = new Date(Date.now() + INVITE_VALID_DAYS * 86400000);
    user.mustChangePassword = true;
    user.passwordResetTokenHash = hashInviteToken(inviteRawToken);
    user.passwordResetExpires = passwordResetExpires;
    if (email) user.email = email;
    await user.save();
    inviteUrl = `${origin}/invite?token=${encodeURIComponent(inviteRawToken)}`;
    emailResult = await sendTenantAdminInvite({
      to: email,
      employeeName: user.name,
      tenantDisplayName: tenant.displayName || tenant.legalName,
      inviteUrl,
    });
  }

  await logPlatformAction(req, {
    action: 'tenant.admin.reset_access',
    resourceType: 'Employee',
    resourceId: String(user._id),
    details: {
      tenantId: String(tenantId),
      tenantKey: tenant.key,
      employeeId: user.employeeId,
      onboardingMode,
      inviteEmailed: onboardingMode === 'invite_link' ? emailResult.sent : undefined,
    },
  });

  const payload = {
    success: true,
    data: {
      _id: user._id,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      email: user.email,
      onboardingMode,
      mustChangePassword: user.mustChangePassword,
    },
  };
  if (temporaryPassword) payload.temporaryPassword = temporaryPassword;
  if (inviteUrl) {
    payload.invite = {
      url: inviteUrl,
      emailed: emailResult.sent,
      expiresAt: passwordResetExpires,
    };
    if (emailResult.error) payload.invite.emailError = emailResult.error;
  }
  res.json(payload);
});

exports.listPlatformAuditLogs = asyncHandler(async (req, res) => {
  const built = buildPlatformAuditFilter(req.query);
  if (built.error) {
    return res.status(400).json({ success: false, message: built.error });
  }
  const { filter } = built;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const skip = Math.min(Math.max(parseInt(req.query.skip, 10) || 0, 0), 10_000);
  const [data, total, distinctActions] = await Promise.all([
    PlatformAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PlatformAuditLog.countDocuments(filter),
    PlatformAuditLog.distinct('action'),
  ]);
  const actions = [...new Set([...PLATFORM_AUDIT_ACTION_PRESETS, ...distinctActions.filter(Boolean)])].sort();
  res.json({
    success: true,
    data,
    total,
    actions,
  });
});

/** Same filters as GET /audit-logs; returns UTF-8 CSV (Excel-friendly BOM). maxRows default 5000, cap 10000. */
exports.exportPlatformAuditLogsCsv = asyncHandler(async (req, res) => {
  const built = buildPlatformAuditFilter(req.query);
  if (built.error) {
    return res.status(400).json({ success: false, message: built.error });
  }
  const { filter } = built;
  const maxRows = Math.min(Math.max(parseInt(req.query.maxRows, 10) || 5000, 1), 10_000);
  const rows = await PlatformAuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(maxRows)
    .lean();

  const headers = [
    'createdAt',
    'action',
    'actorName',
    'actorEmployeeId',
    'resourceType',
    'resourceId',
    'ip',
    'detailsJson',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const created =
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '');
    lines.push(
      [
        csvEscape(created),
        csvEscape(r.action),
        csvEscape(r.actorName),
        csvEscape(r.actorEmployeeId),
        csvEscape(r.resourceType),
        csvEscape(r.resourceId),
        csvEscape(r.ip),
        csvEscape(JSON.stringify(r.details || {})),
      ].join(',')
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="platform-audit-${stamp}.csv"`);
  res.send(`\uFEFF${lines.join('\n')}`);
});

exports.getGlobalAnnouncement = asyncHandler(async (_req, res) => {
  const doc = await PlatformSettings.findOne({ key: 'global' }).lean();
  res.json({
    success: true,
    data: doc?.globalAnnouncement || {
      enabled: false,
      level: 'info',
      message: '',
      updatedAt: null,
      updatedByEmployeeId: '',
    },
  });
});

exports.updateGlobalAnnouncement = asyncHandler(async (req, res) => {
  const announcement = normalizeAnnouncementPayload(req.body || {}, req.user?.employeeId);
  const doc = await PlatformSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { key: 'global', globalAnnouncement: announcement } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await logPlatformAction(req, {
    action: 'platform.announcement.update',
    resourceType: 'PlatformSettings',
    resourceId: String(doc._id),
    details: {
      enabled: announcement.enabled,
      level: announcement.level,
      messageLength: announcement.message.length,
    },
  });

  res.json({ success: true, data: doc.globalAnnouncement });
});

exports.getPlatformMetrics = asyncHandler(async (_req, res) => {
  const [tenantsByStatus, employees, products, orders, invoices] = await Promise.all([
    Tenant.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Employee.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Invoice.countDocuments(),
  ]);

  const byStatus = {};
  for (const row of tenantsByStatus) byStatus[row._id || 'unknown'] = row.count;

  res.json({
    success: true,
    data: {
      tenants: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus },
      employees,
      products,
      orders,
      invoices,
    },
  });
});
