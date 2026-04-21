import axios from 'axios';
import { getEffectiveTenantIdForRequest } from '@/lib/tenantContext';
import { getApiBaseUrl } from '@/lib/apiBase';

const API_BASE_URL = getApiBaseUrl();

function isStoredUserSuperAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('erp_user');
    if (!raw) return false;
    const u = JSON.parse(raw) as { platformRole?: string };
    return u?.platformRole === 'super_admin';
  } catch {
    return false;
  }
}
let nextPlatformStepUpPassword: string | null = null;
let cachedPlatformStepUpPassword: string | null = null;
let cachedPlatformStepUpUntilMs = 0;
const PLATFORM_STEP_UP_CACHE_KEY = 'erp_platform_step_up_cache_v1';
const PLATFORM_STEP_UP_CACHE_TTL_MS = 5 * 60 * 1000;

export function setNextPlatformStepUpPassword(password: string | null) {
  nextPlatformStepUpPassword = password && password.trim() ? password : null;
}

type PlatformStepUpCachePayload = {
  password: string;
  expiresAt: number;
};

function readStepUpCacheFromSession(): PlatformStepUpCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PLATFORM_STEP_UP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlatformStepUpCachePayload>;
    if (!parsed || typeof parsed.password !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (!parsed.password.trim() || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PLATFORM_STEP_UP_CACHE_KEY);
      return null;
    }
    return { password: parsed.password, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function getCachedPlatformStepUpPassword(): string | null {
  if (cachedPlatformStepUpPassword && cachedPlatformStepUpUntilMs > Date.now()) {
    return cachedPlatformStepUpPassword;
  }
  const persisted = readStepUpCacheFromSession();
  if (!persisted) {
    cachedPlatformStepUpPassword = null;
    cachedPlatformStepUpUntilMs = 0;
    return null;
  }
  cachedPlatformStepUpPassword = persisted.password;
  cachedPlatformStepUpUntilMs = persisted.expiresAt;
  return persisted.password;
}

export function clearPlatformStepUpCache() {
  cachedPlatformStepUpPassword = null;
  cachedPlatformStepUpUntilMs = 0;
  nextPlatformStepUpPassword = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PLATFORM_STEP_UP_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function rememberPlatformStepUpPassword(password: string, ttlMs = PLATFORM_STEP_UP_CACHE_TTL_MS) {
  const clean = String(password || '').trim();
  if (!clean) return;
  const expiresAt = Date.now() + Math.max(5_000, ttlMs);
  cachedPlatformStepUpPassword = clean;
  cachedPlatformStepUpUntilMs = expiresAt;
  if (typeof window !== 'undefined') {
    try {
      const payload: PlatformStepUpCachePayload = { password: clean, expiresAt };
      sessionStorage.setItem(PLATFORM_STEP_UP_CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const tid = getEffectiveTenantIdForRequest();
      if (tid) {
        (config.headers as Record<string, string>)['x-tenant-id'] = tid;
      }
    } catch {
      /* ignore */
    }
    try {
      const method = String(config.method || 'get').toUpperCase();
      const path = String(config.url || '');
      const isPlatformMutation =
        path.includes('/platform/') &&
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
      if (isPlatformMutation) {
        const stepUp = nextPlatformStepUpPassword || getCachedPlatformStepUpPassword();
        if (stepUp) {
          (config.headers as Record<string, string>)['x-step-up-password'] = stepUp;
        }
        // One-time use override; cache (if any) is separate.
        nextPlatformStepUpPassword = null;
      }
    } catch {
      /* ignore */
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? '');
    const message = String(error.response?.data?.message || '');
    const lowerMessage = message.toLowerCase();
    const isStepUp401 = status === 401 && message.toLowerCase().includes('step-up');
    const isSubscriptionBlocked403 =
      status === 403 &&
      lowerMessage.includes('tenant') &&
      (lowerMessage.includes('suspended') ||
        lowerMessage.includes('archived') ||
        lowerMessage.includes('trial expired') ||
        lowerMessage.includes('subscription'));
    if (isStepUp401) {
      clearPlatformStepUpCache();
    }
    const kickToLogin =
      (status === 401 && !url.includes('/auth/login') && !isStepUp401) ||
      (isSubscriptionBlocked403 && !isStoredUserSuperAdmin());
    if (kickToLogin) {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export const inventoryApi = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/products', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  getLots: async (id: string) => {
    const response = await api.get(`/products/${id}/lots`);
    return response.data.data;
  },
  getAging: async () => {
    const response = await api.get('/inventory/aging');
    return response.data.data;
  },
};

export const bomApi = {
  getAll: async () => {
    const response = await api.get('/boms');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/boms/${id}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/boms', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/boms/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/boms/${id}`);
    return response.data;
  },
};

export const productionApi = {
  getAll: async () => {
    const response = await api.get('/production');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/production/${id}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/production', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/production/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/production/${id}`);
    return response.data;
  },
  createFromOrder: async (body: {
    orderId: string;
    lineIndex: number;
    quantity?: number;
    jobId?: string;
    dueDate?: string;
    priority?: string;
    assignedTo?: string;
  }) => {
    const response = await api.post('/production/from-order', body);
    return response.data.data;
  },
  reserveMaterials: async (jobId: string) => {
    const response = await api.post(`/production/${jobId}/reserve-materials`);
    return response.data.data;
  },
  syncOperations: async (jobId: string) => {
    const response = await api.post(`/production/${jobId}/sync-operations`);
    return response.data.data;
  },
  startOperation: async (jobId: string, opIndex: number) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/start`);
    return response.data.data;
  },
  completeOperation: async (jobId: string, opIndex: number) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/complete`);
    return response.data.data;
  },
  logOperationTime: async (jobId: string, opIndex: number, body: { minutes: number; note?: string }) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/time`, body);
    return response.data.data;
  },
  scrapReworkOperation: async (
    jobId: string,
    opIndex: number,
    body: { scrapQty?: number; reworkQty?: number }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/scrap-rework`, body);
    return response.data.data;
  },
  logOperationWip: async (
    jobId: string,
    opIndex: number,
    body: { wipInQty?: number; wipOutQty?: number }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/wip`, body);
    return response.data.data;
  },
  recordOperationQuality: async (
    jobId: string,
    opIndex: number,
    body: { status: 'pass' | 'fail' | 'waive' }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/quality`, body);
    return response.data.data;
  },
  issueMaterial: async (
    jobId: string,
    body: {
      productId: string;
      quantity: number;
      operationIndex?: number;
      note?: string;
      lotNumber?: string;
      serialNumber?: string;
    }
  ) => {
    const response = await api.post(`/production/${jobId}/materials/issue`, body);
    return response.data.data;
  },
  returnMaterial: async (
    jobId: string,
    body: {
      productId: string;
      quantity: number;
      operationIndex?: number;
      note?: string;
      lotNumber?: string;
      serialNumber?: string;
    }
  ) => {
    const response = await api.post(`/production/${jobId}/materials/return`, body);
    return response.data.data;
  },
  updateCosting: async (
    jobId: string,
    body: {
      plannedLaborCost?: number;
      plannedMachineCost?: number;
      plannedOverheadCost?: number;
      actualLaborCost?: number;
      actualMachineCost?: number;
      actualOverheadCost?: number;
    }
  ) => {
    const response = await api.patch(`/production/${jobId}/costing`, body);
    return response.data.data;
  },
  getCapacityPlan: async (params?: { from?: string; to?: string; capacityPerDayMinutes?: number }) => {
    const response = await api.get('/production/capacity/plan', { params });
    return response.data.data as Array<{
      day: string;
      workCenterCode: string;
      loadMinutes: number;
      jobs: number;
      capacityMinutes: number;
      utilizationPct: number;
      overloaded: boolean;
    }>;
  },
  getKpis: async (params?: { from?: string; to?: string }) => {
    const response = await api.get('/production/kpis', { params });
    return response.data.data as {
      window: { from: string; to: string };
      jobsCreated: number;
      jobsCompleted: number;
      throughputQty: number;
      scheduleAdherencePct: number;
      scrapRatePct: number;
      oeeProxyPct: number;
    };
  },
};

export const manufacturingApi = {
  listAssets: async () => {
    const response = await api.get('/manufacturing/assets');
    return response.data.data;
  },
  listDowntime: async (params?: { assetId?: string; limit?: number }) => {
    const response = await api.get('/manufacturing/downtime', { params });
    return response.data.data;
  },
};

export const ordersApi = {
  getAll: async () => {
    const response = await api.get('/orders');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/orders', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/orders/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  },
  reserveLine: async (orderId: string, lineIndex: number, quantity: number) => {
    const response = await api.post(`/orders/${orderId}/reserve-line`, {
      lineIndex,
      quantity,
    });
    return response.data.data;
  },
};

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReportsSeriesRow = {
  key: string;
  label: string;
  ordersCount: number;
  ordersRevenue: number;
  newClients: number;
  paidRevenue: number;
  expenses: number;
  jobsCreated: number;
  jobsCompleted: number;
  poCount: number;
  poValue: number;
  shipmentsShipped: number;
};

export type ReportsSummaryResponse = {
  period: ReportPeriod;
  timezone: string;
  window: { start: string; end: string };
  sales: boolean;
  finance: boolean;
  manufacturing: boolean;
  procurement: boolean;
  inventory: boolean;
  shipments: boolean;
  kpis: {
    ordersCount: number;
    ordersRevenue: number;
    newClients: number;
    paidRevenue?: number;
    expensesTotal?: number;
    profit?: number;
    pendingInvoicesCount?: number;
    jobsCreated: number;
    jobsCompleted: number;
    poCount: number;
    poValue: number;
    shipmentsShipped: number;
    inventorySkus: number;
    inventoryUnits: number;
    inventoryValue: number;
  };
  kpisLifetime: {
    totalOrders: number;
    totalClients: number;
    totalProducts: number;
  };
  series: ReportsSeriesRow[];
};

export const reportsApi = {
  getSummary: async (period: ReportPeriod) => {
    const response = await api.get<ReportsSummaryResponse>('/reports/summary', { params: { period } });
    return response.data;
  },
};

export const mrpApi = {
  getSuggestions: async () => {
    const response = await api.get('/mrp/suggestions');
    return response.data.data as Array<{
      orderId: string;
      clientName: string;
      lineIndex: number;
      sku: string;
      productName: string;
      orderQty: number;
      suggestedMakeQty: number;
      reservedForLine: number;
      coveredByJobQty: number;
      availableToPromise: number;
      bomName: string;
      productionJobId: string | null;
    }>;
  },
  explode: async (productId: string, params?: { qty?: number; maxDepth?: number }) => {
    const response = await api.get(`/mrp/explode/${productId}`, { params });
    return response.data.data as {
      productId: string;
      sku: string;
      name: string;
      orderQty: number;
      criticalPathLeadDays: number;
      lines: Array<{
        level: number;
        productId: string;
        sku?: string;
        name?: string;
        qty: number;
        type: string;
        routeLeadDays?: number;
      }>;
    };
  },
};

export const purchaseOrdersApi = {
  getAll: async () => {
    const response = await api.get('/purchase-orders');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data.data;
  },
  create: async (body: {
    supplierName: string;
    vendor?: string | null;
    supplyType?: 'local' | 'import';
    lines: { product: string; quantityOrdered?: number; quantity?: number; unitCost?: number }[];
    notes?: string;
    importFreight?: number;
    importDuty?: number;
    importClearing?: number;
    landedCostAllocation?: 'none' | 'by_value' | 'by_quantity';
    invoiceCurrency?: string;
    fxRateToFunctional?: number;
    lcReference?: string;
    lcBank?: string;
    lcAmount?: number | null;
    lcCurrency?: string;
    lcExpiry?: string | null;
  }) => {
    const response = await api.post('/purchase-orders', body);
    return response.data.data;
  },
  patchSourcing: async (
    id: string,
    body: Record<string, string | number | null | undefined>
  ) => {
    const response = await api.patch(`/purchase-orders/${id}/sourcing`, body);
    return response.data.data;
  },
  update: async (id: string, body: Record<string, unknown>) => {
    const response = await api.put(`/purchase-orders/${id}`, body);
    return response.data.data;
  },
  approve: async (id: string) => {
    const response = await api.post(`/purchase-orders/${id}/approve`);
    return response.data.data;
  },
  receive: async (
    id: string,
    receipts: {
      lineIndex: number;
      quantity: number;
      lotNumber?: string;
      batchNumber?: string;
      serialNumber?: string;
      expirationDate?: string | null;
    }[]
  ) => {
    const response = await api.post(`/purchase-orders/${id}/receive`, { receipts });
    return response.data.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(`/purchase-orders/${id}/cancel`);
    return response.data.data;
  },
};

type ARBucketRow = {
  invoiceId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: string;
  daysPastDue: number;
};

export const financeExtendedApi = {
  createInvoiceFromOrder: async (body: {
    orderId: string;
    dueDate?: string;
    shippedAt?: string;
    shipmentId?: string;
    taxOptions?: {
      taxCategory?: string;
      forceVatRate?: number;
      forceWhtRate?: number;
      isVatExempt?: boolean;
    };
  }) => {
    const response = await api.post('/finance/invoices/from-order', body);
    return response.data.data;
  },
  getARAging: async () => {
    const response = await api.get('/finance/ar-aging');
    return response.data.data as {
      buckets: {
        notDue: ARBucketRow[];
        days1_30: ARBucketRow[];
        days31_60: ARBucketRow[];
        days61_90: ARBucketRow[];
        days90plus: ARBucketRow[];
      };
      totals: {
        notDue: number;
        days1_30: number;
        days31_60: number;
        days61_90: number;
        days90plus: number;
        openAR: number;
      };
    };
  },
};

export const inventoryAlertsApi = {
  getAlerts: async () => {
    const response = await api.get('/inventory/alerts');
    return response.data.data as Array<{
      productId: string;
      sku: string;
      name: string;
      available: number;
      onHand: number;
      reserved: number;
      reorderPoint: number;
      severity: string;
    }>;
  },
};

export const clientsApi = {
  getAll: async () => {
    const response = await api.get('/clients');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/clients/${id}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/clients', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
};

export const inventoryMovementsApi = {
  getAll: async (params?: { productId?: string; limit?: number }) => {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        _id: string;
        product: { name: string; sku: string; unit?: string };
        delta: number;
        movementType: string;
        note?: string;
        balanceAfter: number;
        createdAt: string;
      }>;
    }>('/inventory/movements', { params });
    return response.data.data;
  },
  create: async (body: {
    productId: string;
    kind: 'receipt' | 'issue' | 'adjustment';
    quantity: number;
    note?: string;
    lotNumber?: string;
    batchNumber?: string;
    serialNumber?: string;
    expirationDate?: string | null;
  }) => {
    const response = await api.post('/inventory/movements', body);
    return response.data.data;
  },
};

export type APAgingPayload = {
  buckets: {
    notDue: Array<{ billNumber: string; vendorName: string; balance: number; dueDate: string; daysPastDue: number }>;
    days1_30: Array<{ billNumber: string; vendorName: string; balance: number; dueDate: string; daysPastDue: number }>;
    days31_60: Array<{ billNumber: string; vendorName: string; balance: number; dueDate: string; daysPastDue: number }>;
    days61_90: Array<{ billNumber: string; vendorName: string; balance: number; dueDate: string; daysPastDue: number }>;
    days90plus: Array<{ billNumber: string; vendorName: string; balance: number; dueDate: string; daysPastDue: number }>;
  };
  totals: {
    notDue: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90plus: number;
    openAP: number;
  };
};

export const apApi = {
  listVendors: async () => {
    const response = await api.get('/finance/vendors');
    return response.data.data as Array<{
      _id: string;
      code: string;
      name: string;
      email?: string;
      paymentTermsDays?: number;
      active?: boolean;
    }>;
  },
  listVendorsAll: async () => {
    const response = await api.get('/finance/vendors/all');
    return response.data.data;
  },
  createVendor: async (body: {
    code: string;
    name: string;
    email?: string;
    phone?: string;
    paymentTermsDays?: number;
    tin?: string;
    vatRegistered?: boolean;
  }) => {
    const response = await api.post('/finance/vendors', body);
    return response.data.data;
  },
  updateVendor: async (id: string, body: Record<string, unknown>) => {
    const response = await api.put(`/finance/vendors/${id}`, body);
    return response.data.data;
  },
  listBills: async () => {
    const response = await api.get('/finance/vendor-bills');
    return response.data.data as Array<{
      _id: string;
      billNumber: string;
      vendor?: { name: string; code: string };
      amount: number;
      amountPaid: number;
      purchaseWhtAmount?: number;
      dueDate: string;
      status: string;
      purchaseOrder?: { poNumber: string };
    }>;
  },
  createBill: async (body: {
    vendor: string;
    lines: Array<{ description: string; quantity?: number; unitCost?: number; amount?: number }>;
    taxOptions?: {
      taxCategory?: string;
      forceVatRate?: number;
      forceWhtRate?: number;
      isVatExempt?: boolean;
    };
  }) => {
    const response = await api.post('/finance/vendor-bills', body);
    return response.data.data;
  },
  billFromPo: async (poId: string) => {
    const response = await api.post(`/finance/vendor-bills/from-po/${poId}`);
    return response.data.data;
  },
  recordPayment: async (billId: string, body: { amount: number; method?: string; reference?: string }) => {
    const response = await api.post(`/finance/vendor-bills/${billId}/payments`, body);
    return response.data.data;
  },
  issueWithholdingCertificate: async (billId: string, notes?: string) => {
    const response = await api.post('/finance/vendor-bills/' + billId + '/withholding-certificate', {
      notes: notes || '',
    });
    return response.data.data as {
      _id: string;
      certificateNumber: string;
      vendorBill?: string;
      withheldAmount?: number;
    };
  },
  getAPAging: async () => {
    const response = await api.get('/finance/ap-aging');
    return response.data.data as APAgingPayload;
  },
};

export const shipmentsApi = {
  list: async () => {
    const response = await api.get('/shipments');
    return response.data.data as Array<{
      _id: string;
      shipmentNumber: string;
      order: string | { _id: string; status?: string };
      status: string;
      carrier?: string;
      trackingNumber?: string;
      shippedAt?: string;
      lines: Array<{ lineIndex: number; quantity: number }>;
    }>;
  },
  listForOrder: async (orderId: string) => {
    const response = await api.get(`/shipments/order/${orderId}`);
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/shipments/${id}`);
    return response.data.data;
  },
  create: async (body: {
    orderId: string;
    lines: Array<{ lineIndex: number; quantity: number; lotNumber?: string; serialNumber?: string }>;
    carrier?: string;
    trackingNumber?: string;
  }) => {
    const response = await api.post('/shipments', body);
    return response.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const response = await api.put(`/shipments/${id}/status`, { status });
    return response.data.data;
  },
  ship: async (id: string, body?: { carrier?: string; trackingNumber?: string }) => {
    const response = await api.post(`/shipments/${id}/ship`, body ?? {});
    return response.data.data;
  },
  openDeliveryNoteHtml: async (id: string) => {
    const response = await api.get<string>(`/shipments/${id}/delivery-note.html`, {
      responseType: "text",
    });
    const blob = new Blob([response.data], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      URL.revokeObjectURL(url);
      throw new Error("Popup blocked");
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  },
};

export const savedViewsApi = {
  list: async (module?: string) => {
    const response = await api.get('/saved-views', { params: module ? { module } : {} });
    return response.data.data as Array<{ _id: string; name: string; module: string; filters: Record<string, unknown> }>;
  },
  create: async (body: { name: string; module: string; filters: Record<string, unknown> }) => {
    const response = await api.post('/saved-views', body);
    return response.data.data;
  },
  remove: async (id: string) => {
    await api.delete(`/saved-views/${id}`);
  },
};

export const auditApi = {
  list: async (params?: { limit?: number; skip?: number; action?: string; entityType?: string }) => {
    const response = await api.get('/audit-logs', { params });
    return response.data as {
      success: boolean;
      data: Array<{
        _id: string;
        at: string;
        action: string;
        entityType: string;
        entityId: string;
        summary: string;
        actor?: { name: string; employeeId: string; role?: string };
      }>;
      total: number;
    };
  },
};

/** Download CSV report (Bearer sent via axios). */
export async function downloadReportCsv(
  path: string,
  filename: string,
  params?: Record<string, string>
) {
  const response = await api.get(path, { responseType: 'blob', params });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type EthiopiaTaxSettings = {
  companyLegalName?: string;
  companyTIN?: string;
  companyAddress?: string;
  companyPhone?: string;
  currency?: string;
  /** Prefix for server-issued sales invoice numbers (e.g. INV → INV-000001). */
  invoiceSeriesPrefix?: string;
  /** Last used sequence index; next invoice uses nextInvoiceSequence + 1. */
  nextInvoiceSequence?: number;
  defaultVatRatePercent?: number;
  salesWithholdingRatePercent?: number;
  salesWhtBase?: string;
  purchaseWithholdingRatePercent?: number;
  salesPriceBasis?: string;
  sellerVatRegistered?: boolean;
  whtCategoryRates?: Array<{
    key: string;
    label?: string;
    salesRatePercent?: number | null;
    purchaseRatePercent?: number | null;
  }>;
  eInvoicingNotes?: string;
};

export const ethiopiaTaxApi = {
  getSettings: async () => {
    const response = await api.get<{ success: boolean; data: EthiopiaTaxSettings }>(
      '/finance/ethiopia-tax/settings'
    );
    return response.data.data;
  },
  updateSettings: async (body: Partial<EthiopiaTaxSettings>) => {
    const response = await api.put<{ success: boolean; data: EthiopiaTaxSettings }>(
      '/finance/ethiopia-tax/settings',
      body
    );
    return response.data.data;
  },
  /** Opens printable tax invoice in new tab (uses auth). */
  async openTaxInvoiceHtml(invoiceMongoId: string) {
    const response = await api.get<string>(`/finance/invoices/${invoiceMongoId}/tax-invoice.html`, {
      responseType: 'text',
    });
    const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      URL.revokeObjectURL(url);
      throw new Error('Popup blocked');
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  },
};

export type WithholdingCertificateRow = {
  _id: string;
  certificateNumber: string;
  type: 'on_sales' | 'on_purchase';
  issueDate?: string;
  withheldAmount?: number;
  invoice?: { _id?: string; invoiceId?: string };
  vendorBill?: string | { _id?: string; billNumber?: string };
};

export const withholdingCertificatesApi = {
  list: async () => {
    const response = await api.get<{ success: boolean; data: WithholdingCertificateRow[] }>(
      '/finance/withholding-certificates'
    );
    return response.data.data;
  },
  async openPrintHtml(certificateId: string) {
    const response = await api.get<string>(`/finance/withholding-certificates/${certificateId}/print.html`, {
      responseType: 'text',
    });
    const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      URL.revokeObjectURL(url);
      throw new Error('Popup blocked');
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  },
};

export type HrPayrollRow = {
  _id: string;
  month: string;
  basicSalary: number;
  netSalary: number;
  grossCash?: number;
  pensionEmployee?: number;
  incomeTax?: number;
  paymentStatus: string;
  paymentDate?: string;
  employee?: { name: string; employeeId: string; department?: string };
};

export type PayrollPrepareRow = {
  employee: {
    _id: string;
    employeeId: string;
    name: string;
    salary: number;
    department: string;
    status: string;
    tinNumber?: string;
  };
  basicSalary: number;
  transportAllowance: number;
  overtimeNormalHours: number;
  overtimeRestHolidayHours: number;
  otherTaxableAllowances: number;
  otherDeductions: number;
  includeInRun: boolean;
};

export type PayrollMonthStatus = {
  success: boolean;
  month: string;
  payrollRecordCount: number;
  posted: boolean;
  posting: {
    postedAt: string;
    postedBy?: string;
    totals: Record<string, number>;
    journalEntryId?: string;
  } | null;
  closed: boolean;
  closedAt: string | null;
};

export type HrLeaveRow = {
  _id: string;
  employee?: { _id: string; name: string; employeeId: string; department?: string; status?: string };
  leaveType: 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;
  reviewNote?: string;
  reviewedBy?: { _id: string; name: string; employeeId: string; role?: string } | null;
  reviewedAt?: string | null;
};

export const hrLeaveApi = {
  list: async (params?: {
    employeeId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
    from?: string;
    to?: string;
  }) => {
    const r = await api.get('/hr/leaves', { params });
    return r.data as HrLeaveRow[];
  },
  create: async (body: {
    employee: string;
    leaveType: HrLeaveRow['leaveType'];
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const r = await api.post('/hr/leaves', body);
    return r.data as HrLeaveRow;
  },
  review: async (
    leaveId: string,
    body: { status: 'approved' | 'rejected' | 'cancelled'; reviewNote?: string }
  ) => {
    const r = await api.patch(`/hr/leaves/${leaveId}/review`, body);
    return r.data as HrLeaveRow;
  },
  balance: async (employeeId: string, year?: number) => {
    const r = await api.get(`/hr/leaves/balance/${employeeId}`, {
      params: year ? { year } : {},
    });
    return r.data as {
      employee: {
        _id: string;
        employeeId: string;
        name: string;
        department?: string;
        status?: string;
      };
      year: number;
      balances: Record<
        'annual' | 'sick' | 'maternity' | 'paternity' | 'other' | 'unpaid',
        { entitlement: number | null; used: number; remaining: number | null }
      >;
    };
  },
};

export const hrAttendanceApi = {
  reviewOvertime: async (
    attendanceId: string,
    body: { status: 'approved' | 'rejected'; note?: string }
  ) => {
    const r = await api.patch(`/hr/attendance/${attendanceId}/overtime`, body);
    return r.data;
  },
};

export type HrDepartmentRow = {
  _id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
};

export type HrPositionRow = {
  _id: string;
  code: string;
  title: string;
  department?: { _id: string; code: string; name: string } | string | null;
  reportsToPosition?: { _id: string; code: string; title: string } | string | null;
  active: boolean;
};

export const hrOrgApi = {
  listDepartments: async () => {
    const r = await api.get('/hr/departments');
    return r.data as HrDepartmentRow[];
  },
  createDepartment: async (body: {
    code: string;
    name: string;
    description?: string;
    active?: boolean;
  }) => {
    const r = await api.post('/hr/departments', body);
    return r.data as HrDepartmentRow;
  },
  updateDepartment: async (id: string, body: Partial<HrDepartmentRow>) => {
    const r = await api.put(`/hr/departments/${id}`, body);
    return r.data as HrDepartmentRow;
  },
  listPositions: async (departmentId?: string) => {
    const r = await api.get('/hr/positions', {
      params: departmentId ? { departmentId } : {},
    });
    return r.data as HrPositionRow[];
  },
  createPosition: async (body: {
    code: string;
    title: string;
    department?: string | null;
    reportsToPosition?: string | null;
    active?: boolean;
  }) => {
    const r = await api.post('/hr/positions', body);
    return r.data as HrPositionRow;
  },
  updatePosition: async (id: string, body: Record<string, unknown>) => {
    const r = await api.put(`/hr/positions/${id}`, body);
    return r.data as HrPositionRow;
  },
};

export type EmployeeAttendanceRow = {
  _id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  workMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  overtimeApprovalStatus?: string;
  notes?: string;
};

export type AttendanceCorrectionRow = {
  _id: string;
  attendanceDate: string;
  requestedStatus: 'Present' | 'Absent' | 'Late' | 'On Leave';
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewNote?: string;
  reviewedAt?: string | null;
};

export const employeeSelfServiceApi = {
  getTodayAttendance: async () => {
    const r = await api.get('/employee/attendance/today');
    return r.data?.data as EmployeeAttendanceRow | null;
  },
  listAttendance: async () => {
    const r = await api.get('/employee/attendance');
    return r.data as EmployeeAttendanceRow[];
  },
  submitAttendance: async (body: {
    date: string;
    status: 'Present' | 'Absent' | 'Late' | 'On Leave';
    checkIn?: string;
    checkOut?: string;
    notes?: string;
  }) => {
    const r = await api.post('/employee/attendance', body);
    return r.data?.data as EmployeeAttendanceRow;
  },
  checkIn: async (notes?: string) => {
    const r = await api.post('/employee/attendance/check-in', { notes: notes || '' });
    return r.data?.data as EmployeeAttendanceRow;
  },
  checkOut: async (notes?: string) => {
    const r = await api.post('/employee/attendance/check-out', { notes: notes || '' });
    return r.data?.data as EmployeeAttendanceRow;
  },
  listLeaves: async () => {
    const r = await api.get('/employee/leaves');
    return (r.data?.data || []) as HrLeaveRow[];
  },
  requestLeave: async (body: {
    leaveType: HrLeaveRow['leaveType'];
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const r = await api.post('/employee/leaves', body);
    return r.data?.data as HrLeaveRow;
  },
  updateLeave: async (
    leaveId: string,
    body: {
      leaveType?: HrLeaveRow['leaveType'];
      startDate?: string;
      endDate?: string;
      reason?: string;
    }
  ) => {
    const r = await api.put(`/employee/leaves/${leaveId}`, body);
    return r.data?.data as HrLeaveRow;
  },
  cancelLeave: async (leaveId: string) => {
    const r = await api.delete(`/employee/leaves/${leaveId}`);
    return r.data?.data as HrLeaveRow;
  },
  listAttendanceCorrections: async () => {
    const r = await api.get('/employee/attendance-corrections');
    return (r.data?.data || []) as AttendanceCorrectionRow[];
  },
  requestAttendanceCorrection: async (body: {
    attendanceDate: string;
    requestedStatus: 'Present' | 'Absent' | 'Late' | 'On Leave';
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    reason?: string;
  }) => {
    const r = await api.post('/employee/attendance-corrections', body);
    return r.data?.data as AttendanceCorrectionRow;
  },
};

export const hrAttendanceCorrectionApi = {
  list: async (params?: { status?: 'pending' | 'approved' | 'rejected' | 'cancelled'; employeeId?: string }) => {
    const r = await api.get('/hr/attendance-corrections', { params });
    return r.data as Array<
      AttendanceCorrectionRow & {
        employee?: { _id: string; name: string; employeeId: string; department?: string };
      }
    >;
  },
  review: async (
    id: string,
    body: { status: 'approved' | 'rejected' | 'cancelled'; reviewNote?: string }
  ) => {
    const r = await api.patch(`/hr/attendance-corrections/${id}/review`, body);
    return r.data as AttendanceCorrectionRow;
  },
};

export const hrPayrollApi = {
  list: async (month?: string) => {
    const r = await api.get('/hr/payroll', { params: month ? { month } : {} });
    return r.data as HrPayrollRow[];
  },
  monthStatus: async (month: string) => {
    const r = await api.get<PayrollMonthStatus>(`/hr/payroll/status/${encodeURIComponent(month)}`);
    return r.data;
  },
  postToFinance: async (month: string) => {
    const r = await api.post<{
      success: boolean;
      idempotent?: boolean;
      message?: string;
      data?: unknown;
    }>(`/hr/payroll/${encodeURIComponent(month)}/post-to-finance`);
    return r.data;
  },
  closeMonth: async (month: string) => {
    const r = await api.post<{
      success: boolean;
      idempotent?: boolean;
      message?: string;
      data?: unknown;
    }>(`/hr/payroll/${encodeURIComponent(month)}/close`);
    return r.data;
  },
  prepare: async (month: string) => {
    const r = await api.get<{
      success: boolean;
      month: string;
      rows: PayrollPrepareRow[];
      hint: string | null;
    }>('/hr/payroll/prepare', { params: { month } });
    return r.data;
  },
  runMonth: async (body: { month: string; entries?: unknown[] }) => {
    const r = await api.post<{
      success: boolean;
      count: number;
      skipped?: Array<{ employeeId?: string; name?: string; reason?: string }>;
      data: HrPayrollRow[];
    }>('/hr/payroll/run', body);
    return r.data;
  },
  updateRecord: async (
    id: string,
    body: { paymentStatus?: string; paymentDate?: string | null }
  ) => {
    const r = await api.patch<{ success: boolean; data: HrPayrollRow }>(
      `/hr/payroll/record/${id}`,
      body
    );
    return r.data.data;
  },
};

export async function downloadPayrollPensionCsv(month: string) {
  await downloadReportCsv('/hr/payroll/export/pension', `ethiopia-pension-${month}.csv`, { month });
}

export async function downloadPayrollIncomeTaxCsv(month: string) {
  await downloadReportCsv(
    '/hr/payroll/export/income-tax',
    `ethiopia-income-tax-${month}.csv`,
    { month }
  );
}

export async function openPayrollPayslipHtml(payrollId: string) {
  const response = await api.get(`/hr/payroll/payslip/${payrollId}/html`, {
    responseType: 'text',
  });
  const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked');
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export const TENANT_MODULE_KEYS = [
  'manufacturing',
  'inventory',
  'sales',
  'procurement',
  'finance',
  'hr',
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
    level: "info" | "warning" | "maintenance";
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
        level?: "info" | "warning" | "maintenance";
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
  getGlobalAnnouncement: async () => {
    const response = await api.get<{
      success: boolean;
      data: {
        enabled: boolean;
        level: "info" | "warning" | "maintenance";
        message: string;
        updatedAt?: string | null;
        updatedByEmployeeId?: string;
      };
    }>('/platform/announcement');
    return response.data;
  },
  updateGlobalAnnouncement: async (body: {
    enabled?: boolean;
    level?: "info" | "warning" | "maintenance";
    message?: string;
  }) => {
    // PUT avoids rare "Cannot PATCH" from proxies; backend accepts PATCH and PUT.
    const response = await api.put<{
      success: boolean;
      data: {
        enabled: boolean;
        level: "info" | "warning" | "maintenance";
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
  /** Filter params match list; downloads CSV (max 5000 rows by default). */
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

export const announcementApi = {
  getCurrent: async () => {
    const response = await api.get<{
      success: boolean;
      data:
        | null
        | {
            source: "tenant" | "global";
            enabled: boolean;
            level: "info" | "warning" | "maintenance";
            message: string;
            updatedAt?: string | null;
            updatedByEmployeeId?: string;
          };
    }>('/announcements/current');
    return response.data;
  },
};

export const billingApi = {
  startChapaCheckout: async (body?: { plan?: string; returnPath?: string; email?: string }) => {
    const response = await api.post<{
      success: boolean;
      data: {
        provider: 'chapa';
        txRef: string;
        checkoutUrl: string;
        amount: number;
        currency: string;
        plan: string;
      };
    }>('/billing/chapa/checkout', body || {});
    return response.data;
  },
  verifyChapaPayment: async (txRef: string) => {
    const response = await api.get<{
      success: boolean;
      data: {
        tenantId: string;
        status: string;
        plan: string;
        billingProvider: string;
        txRef: string;
      };
    }>(`/billing/chapa/verify/${encodeURIComponent(txRef)}`);
    return response.data;
  },
};

export default api;
