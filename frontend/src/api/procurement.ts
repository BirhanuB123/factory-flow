import api from './axios';

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