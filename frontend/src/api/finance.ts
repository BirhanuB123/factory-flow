import api from './axios';

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
  invoiceSeriesPrefix?: string;
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