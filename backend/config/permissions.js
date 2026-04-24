/**
 * Phase 3 — role → permission matrix (Admin bypasses all checks).
 */
const P = {
  PO_VIEW: 'po:view',
  PO_CREATE: 'po:create',
  PO_APPROVE: 'po:approve',
  PO_RECEIVE: 'po:receive',
  PO_CANCEL: 'po:cancel',
  INVENTORY_POST: 'inventory:post',
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',
  HR_FULL: 'hr:full',
  /** Home + shared shell (all tenant users). */
  DASHBOARD_VIEW: 'dashboard:view',
  /** Production jobs, KPIs, manufacturing asset/downtime reads used by ops dashboard. */
  DASHBOARD_MFG: 'dashboard:mfg:view',
  /** Inventory / product aggregates on dashboard widgets. */
  DASHBOARD_INVENTORY: 'dashboard:inventory:view',
  SHIPMENTS_VIEW: 'shipments:view',
  SHIPMENTS_MANAGE: 'shipments:manage',
  POS_VIEW: 'pos:view',
};

/** role → permission keys */
const MATRIX = {
  Admin: ['*'],
  purchasing_head: [
    P.DASHBOARD_VIEW,
    P.DASHBOARD_MFG,
    P.DASHBOARD_INVENTORY,
    P.PO_VIEW,
    P.PO_CREATE,
    P.PO_APPROVE,
    P.PO_RECEIVE,
    P.PO_CANCEL,
    P.INVENTORY_POST,
    P.SHIPMENTS_VIEW,
    P.POS_VIEW,
  ],
  warehouse_head: [
    P.DASHBOARD_VIEW,
    P.DASHBOARD_MFG,
    P.DASHBOARD_INVENTORY,
    P.PO_VIEW,
    P.PO_RECEIVE,
    P.INVENTORY_POST,
    P.SHIPMENTS_VIEW,
    P.SHIPMENTS_MANAGE,
    P.POS_VIEW,
  ],
  finance_head: [
    P.DASHBOARD_VIEW,
    P.DASHBOARD_MFG,
    P.DASHBOARD_INVENTORY,
    P.FINANCE_READ,
    P.FINANCE_WRITE,
    P.PO_VIEW,
    P.SHIPMENTS_VIEW,
    P.POS_VIEW,
  ],
  /** Read-only finance / compliance (GET-only enforced in finance router). */
  finance_viewer: [
    P.DASHBOARD_VIEW,
    P.DASHBOARD_MFG,
    P.DASHBOARD_INVENTORY,
    P.FINANCE_READ,
    P.PO_VIEW,
    P.SHIPMENTS_VIEW,
    P.POS_VIEW,
  ],
  hr_head: [
    P.DASHBOARD_VIEW,
    P.DASHBOARD_MFG,
    P.DASHBOARD_INVENTORY,
    P.HR_FULL,
    P.PO_VIEW,
  ],
  employee: [P.DASHBOARD_VIEW],
};

function rolePermissions(role) {
  if (role === 'Admin') return ['*'];
  return MATRIX[role] || [];
}

function can(role, permission) {
  if (role === 'Admin') return true;
  const perms = rolePermissions(role);
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/** Express middleware: user must have ANY of the listed permissions */
function authorizePerm(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized'));
    }
    if (req.user.role === 'Admin') return next();
    if (req.user.platformRole === 'super_admin') return next();
    const ok = permissions.some((p) => can(req.user.role, p));
    if (!ok) {
      const err = new Error(
        `Forbidden: needs one of [${permissions.join(', ')}] (role: ${req.user.role})`
      );
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
}

/** For docs / UI */
function getMatrixDoc() {
  const roles = Object.keys(MATRIX).filter((r) => r !== 'Admin');
  const actions = [
    { key: P.DASHBOARD_VIEW, label: 'Dashboard (home)' },
    { key: P.DASHBOARD_MFG, label: 'Dashboard production / manufacturing visibility' },
    { key: P.DASHBOARD_INVENTORY, label: 'Dashboard inventory KPIs' },
    { key: P.FINANCE_READ, label: 'Finance read (viewer)' },
    { key: P.PO_CREATE, label: 'Create / edit draft PO' },
    { key: P.PO_APPROVE, label: 'Approve PO' },
    { key: P.PO_RECEIVE, label: 'Receive PO (stock in)' },
    { key: P.PO_CANCEL, label: 'Cancel unreceived PO' },
    { key: P.INVENTORY_POST, label: 'Manual stock movement (adjust/receipt/issue)' },
    { key: P.FINANCE_WRITE, label: 'Invoices, expenses, from-order invoice' },
    { key: P.HR_FULL, label: 'HR module' },
    { key: P.SHIPMENTS_VIEW, label: 'View shipments & delivery notes' },
    { key: P.SHIPMENTS_MANAGE, label: 'Create / update / ship deliveries' },
    { key: P.PO_VIEW, label: 'View purchase orders' },
    { key: P.POS_VIEW, label: 'Access Point of Sale (POS)' },
  ];
  const rows = roles.map((role) => ({
    role,
    grants: actions
      .filter((a) => MATRIX[role]?.includes(a.key))
      .map((a) => a.label),
  }));
  return { actions, roles: rows, note: 'Admin has all actions.' };
}

module.exports = {
  P,
  can,
  rolePermissions,
  authorizePerm,
  getMatrixDoc,
};
