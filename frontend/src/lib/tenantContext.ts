/** Super-admin "act as tenant" override for `x-tenant-id` on API requests. */
export const ERP_ACT_AS_TENANT_KEY = 'erp_act_as_tenant_id';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isLikelyMongoObjectId(v: string): boolean {
  return OBJECT_ID_RE.test(v);
}

/**
 * Resolves which tenant id axios should send (super admin: act-as wins, else profile tenant).
 */
export function getEffectiveTenantIdForRequest(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('erp_user');
    if (!raw) return undefined;
    const u = JSON.parse(raw) as { platformRole?: string; tenantId?: string };
    if (u.platformRole === 'super_admin') {
      const act = localStorage.getItem(ERP_ACT_AS_TENANT_KEY);
      if (act && isLikelyMongoObjectId(act)) return act;
      if (u.tenantId && isLikelyMongoObjectId(u.tenantId)) return u.tenantId;
      return undefined;
    }
    if (u.tenantId && isLikelyMongoObjectId(u.tenantId)) return u.tenantId;
  } catch {
    /* ignore */
  }
  return undefined;
}
