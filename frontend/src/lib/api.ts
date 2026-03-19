import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5000/api';

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
    if (status === 401 && !url.includes('/auth/login')) {
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
    receipts: { lineIndex: number; quantity: number; lotNumber?: string; batchNumber?: string }[]
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
    invoiceId?: string;
    shippedAt?: string;
    shipmentId?: string;
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
      dueDate: string;
      status: string;
      purchaseOrder?: { poNumber: string };
    }>;
  },
  createBill: async (body: {
    vendor: string;
    lines: Array<{ description: string; quantity?: number; unitCost?: number; amount?: number }>;
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
    lines: Array<{ lineIndex: number; quantity: number }>;
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
  defaultVatRatePercent?: number;
  salesWithholdingRatePercent?: number;
  salesWhtBase?: string;
  purchaseWithholdingRatePercent?: number;
  salesPriceBasis?: string;
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

export const hrPayrollApi = {
  list: async (month?: string) => {
    const r = await api.get('/hr/payroll', { params: month ? { month } : {} });
    return r.data as HrPayrollRow[];
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

export default api;
