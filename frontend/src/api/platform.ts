import api from './axios';

export const TENANT_MODULE_KEYS = [
  'manufacturing',
  'inventory',
  'sales',
  'procurement',
  'finance',
  'hr',
  'crm',
  'pos',
  'global_trade',
  'analytics',
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export type TenantModuleFlags = Record<TenantModuleKey, boolean>;

export type PlatformTenant = {
  _id: string;
  key: string;
  legalName: string;
  displayName: string;
  status: string;
  statusReason?: string;
  lastApiActivityAt?: string;
  trialEndDate?: string | null;
  plan?: string;
  billingProvider?: 'none' | 'manual' | 'stripe' | 'chapa' | 'other';
  billingCustomerId?: string;
  announcement?: {
    enabled: boolean;
    level: 'info' | 'warning' | 'maintenance';
    message: string;
    updatedAt?: string | null;
    updatedByEmployeeId?: string;
  };
  industry?: string;
  timezone?: string;
  currency?: string;
  moduleFlags?: Partial<TenantModuleFlags>;
  health?: {
    lastApiActivityAt?: string | null;
    statusReason?: string;
    trialEndDate?: string | null;
    trialExpired?: boolean;
    trialDaysLeft?: number | null;
    adminCount?: number;
    zeroAdmins?: boolean;
    totalDocuments?: number;
    documentCounts?: {
      employees?: number;
      products?: number;
      orders?: number;
      clients?: number;
      invoices?: number;
      purchaseOrders?: number;
    };
  };
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformTenantUserRow = {
  _id?: string;
  name: string;
  employeeId: string;
  role: string;
  email?: string;
  status: string;
  department?: string;
};

export type PlatformTenantDetailPayload = {
  tenant: PlatformTenant;
  counts: {
    employees: number;
    products: number;
    orders: number;
    clients: number;
    invoices: number;
    purchaseOrders: number;
    admins?: number;
  };
  users: PlatformTenantUserRow[];
};

export const platformApi = {
  listTenants: async (params?: { q?: string }) => {
    const response = await api.get<{
      success: boolean;
      data: PlatformTenant[];
      count: number;
      query?: string;
    }>('/platform/tenants', { params });
    return response.data;
  },
  getTenantDetail: async (tenantId: string) => {
    const response = await api.get<{ success: boolean; data: PlatformTenantDetailPayload }>(
      `/platform/tenants/${tenantId}`
    );
    return response.data;
  },
  createTenant: async (body: {
    key: string;
    legalName: string;
    displayName?: string;
    industry?: string;
    status?: string;
    plan?: string;
    timezone?: string;
    currency?: string;
  }) => {
    const response = await api.post<{ success: boolean; data: PlatformTenant }>('/platform/tenants', body);
    return response.data;
  },
  updateTenantStatus: async (tenantId: string, status: string, statusReason?: string) => {
    const response = await api.patch<{ success: boolean; data: PlatformTenant }>(
      `/platform/tenants/${tenantId}/status`,
      { status, statusReason }
    );
    return response.data;
  },
  extendTenantTrial: async (
    tenantId: string,
    body?: { extendDays?: number; trialEndDate?: string }
  ) => {
    const response = await api.patch<{ success: boolean; data: PlatformTenant }>(
      `/platform/tenants/${tenantId}/trial`,
      body || { extendDays: 7 }
    );
    return response.data;
  },
  patchTenant: async (
    tenantId: string,
    body: {
      displayName?: string;
      legalName?: string;
      plan?: string;
      billingProvider?: 'none' | 'manual' | 'stripe' | 'chapa' | 'other';
      billingCustomerId?: string;
      timezone?: string;
      currency?: string;
      industry?: string;
      moduleFlags?: Partial<TenantModuleFlags>;
      statusReason?: string;
      trialEndDate?: string;
      announcement?: {
        enabled?: boolean;
        level?: 'info' | 'warning' | 'maintenance';
        message?: string;
      };
    }
  ) => {
    const response = await api.patch<{ success: boolean; data: PlatformTenant }>(
      `/platform/tenants/${tenantId}`,
      body
    );
    return response.data;
  },
  deleteTenant: async (tenantId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/platform/tenants/${tenantId}`
    );
    return response.data;
  },
  getGlobalAnnouncement: async () => {
    const response = await api.get<{
      success: boolean;
      data: {
        enabled: boolean;
        level: 'info' | 'warning' | 'maintenance';
        message: string;
        updatedAt?: string | null;
        updatedByEmployeeId?: string;
      };
    }>('/platform/announcement');
    return response.data;
  },
  updateGlobalAnnouncement: async (body: {
    enabled?: boolean;
    level?: 'info' | 'warning' | 'maintenance';
    message?: string;
  }) => {
    // PUT avoids rare "Cannot PATCH" from proxies; backend accepts PATCH and PUT.
    const response = await api.put<{
      success: boolean;
      data: {
        enabled: boolean;
        level: 'info' | 'warning' | 'maintenance';
        message: string;
        updatedAt?: string | null;
        updatedByEmployeeId?: string;
      };
    }>('/platform/announcement', body);
    return response.data;
  },
  createTenantAdmin: async (
    tenantId: string,
    body: {
      employeeId: string;
      name: string;
      password?: string;
      role?: string;
      department?: string;
      email?: string;
      onboardingMode?: 'manual' | 'temp_password' | 'invite_link';
    }
  ) => {
    const response = await api.post<{
      success: boolean;
      data: Record<string, unknown>;
      temporaryPassword?: string;
      invite?: { url: string; emailed: boolean; emailError?: string; expiresAt?: string };
    }>(`/platform/tenants/${tenantId}/admin`, body);
    return response.data;
  },
  getMetrics: async () => {
    const response = await api.get<{
      success: boolean;
      data: {
        tenants: { total: number; byStatus: Record<string, number> };
        employees: number;
        products: number;
        orders: number;
        invoices: number;
      };
    }>('/platform/metrics');
    return response.data;
  },
  listPlatformAuditLogs: async (params?: {
    limit?: number;
    skip?: number;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        _id: string;
        action: string;
        resourceType?: string;
        resourceId?: string;
        actorName?: string;
        actorEmployeeId?: string;
        details?: Record<string, unknown>;
        ip?: string;
        createdAt: string;
      }>;
      total: number;
      actions?: string[];
    }>('/platform/audit-logs', { params });
    return response.data;
  },
  exportPlatformAuditLogsCsv: async (params?: {
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    maxRows?: number;
  }) => {
    const response = await api.get<Blob>('/platform/audit-logs/export', {
      params: { ...params, maxRows: params?.maxRows ?? 5000 },
      responseType: 'blob',
    });
    return response.data;
  },
};