/**
 * Must stay in sync with backend/config/permissions.js (P object).
 */
export const PERMS = {
  DASHBOARD_VIEW: "dashboard:view",
  DASHBOARD_MFG: "dashboard:mfg:view",
  DASHBOARD_INVENTORY: "dashboard:inventory:view",
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  HR_FULL: "hr:full",
  SHIPMENTS_VIEW: "shipments:view",
  SHIPMENTS_MANAGE: "shipments:manage",
  PO_VIEW: "po:view",
  POS_VIEW: "pos:view",
} as const;

export type PermissionKey = (typeof PERMS)[keyof typeof PERMS];
