const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    legalName: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    industry: {
      type: String,
      enum: ['manufacturing', 'distribution', 'retail', 'service', 'other'],
      default: 'manufacturing',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'archived'],
      default: 'active',
    },
    /** Optional note when status is suspended or archived (platform console + API). */
    statusReason: { type: String, default: '', trim: true, maxlength: 2000 },
    /** Last time this tenant had authenticated API traffic (throttled writes). */
    lastApiActivityAt: { type: Date, default: null },
    /** Trial lifecycle: when trial access ends (auto-suspend job reads this). */
    trialEndDate: { type: Date, default: null, index: true },
    plan: { type: String, default: 'starter' },
    /** Billing metadata for external plan sync (Stripe/Chapa/manual/other). */
    billingProvider: {
      type: String,
      enum: ['none', 'manual', 'stripe', 'chapa', 'other'],
      default: 'none',
    },
    billingCustomerId: { type: String, default: '', trim: true, index: true },
    announcement: {
      enabled: { type: Boolean, default: false },
      level: { type: String, enum: ['info', 'warning', 'maintenance'], default: 'info' },
      message: { type: String, default: '', trim: true, maxlength: 5000 },
      updatedAt: { type: Date, default: null },
      updatedByEmployeeId: { type: String, default: '', trim: true },
    },
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    currency: { type: String, default: 'ETB' },
    /** Per-tenant feature toggles; gate routes with `requireTenantModule` from utils/tenantModules.js */
    moduleFlags: {
      manufacturing: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      sales: { type: Boolean, default: true },
      procurement: { type: Boolean, default: true },
      finance: { type: Boolean, default: true },
      hr: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

tenantSchema.index({ lastApiActivityAt: -1 });

module.exports = mongoose.model('Tenant', tenantSchema);
