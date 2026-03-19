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
  FINANCE_WRITE: 'finance:write',
  HR_FULL: 'hr:full',
};

/** role → permission keys */
const MATRIX = {
  Admin: ['*'],
  purchasing_head: [
    P.PO_VIEW,
    P.PO_CREATE,
    P.PO_APPROVE,
    P.PO_RECEIVE,
    P.PO_CANCEL,
    P.INVENTORY_POST,
  ],
  warehouse_head: [P.PO_VIEW, P.PO_RECEIVE, P.INVENTORY_POST],
  finance_head: [P.FINANCE_WRITE, P.PO_VIEW],
  /** Read-only finance / compliance (GET-only enforced in finance router). */
  finance_viewer: [P.PO_VIEW],
  hr_head: [P.HR_FULL, P.PO_VIEW],
  employee: [P.PO_VIEW],
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
    { key: P.PO_CREATE, label: 'Create / edit draft PO' },
    { key: P.PO_APPROVE, label: 'Approve PO' },
    { key: P.PO_RECEIVE, label: 'Receive PO (stock in)' },
    { key: P.PO_CANCEL, label: 'Cancel unreceived PO' },
    { key: P.INVENTORY_POST, label: 'Manual stock movement (adjust/receipt/issue)' },
    { key: P.FINANCE_WRITE, label: 'Invoices, expenses, from-order invoice' },
    { key: P.HR_FULL, label: 'HR module' },
    { key: P.PO_VIEW, label: 'View purchase orders' },
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
