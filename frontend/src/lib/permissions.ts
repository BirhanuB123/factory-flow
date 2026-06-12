/**
 * Must stay in sync with backend/config/permissions.js (P object).
 */
export const PERMS = {
  DASHBOARD_VIEW: "dashboard:view",
  DASHBOARD_MFG: "dashboard:mfg:view",
  DASHBOARD_INVENTORY: "dashboard:inventory:view",
  ORDERS_VIEW: "orders:view",
  ORDERS_MANAGE: "orders:manage",
  CRM_VIEW: "crm:view",
  CRM_MANAGE: "crm:manage",
  PRODUCT_VIEW: "product:view",
  PRODUCT_MANAGE: "product:manage",
  MFG_OPS: "mfg:ops",
  SETTINGS_MANAGE: "settings:manage",
  VENDOR_MANAGE: "vendor:manage",
  PO_VIEW: "po:view",
  PO_CREATE: "po:create",
  PO_APPROVE: "po:approve",
  PO_RECEIVE: "po:receive",
  PO_CANCEL: "po:cancel",
  INVENTORY_POST: "inventory:post",
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  HR_FULL: "hr:full",
  SHIPMENTS_VIEW: "shipments:view",
  SHIPMENTS_MANAGE: "shipments:manage",
  POS_VIEW: "pos:view",
} as const;

export type PermissionKey = (typeof PERMS)[keyof typeof PERMS];
