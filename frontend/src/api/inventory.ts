import api from './axios';

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

export const locationsApi = {
  getAll: async () => {
    const response = await api.get('/inventory/locations');
    return response.data.data;
  },
  create: async (data: { name: string; type?: string; parentLocation?: string | null }) => {
    const response = await api.post('/inventory/locations', data);
    return response.data.data;
  },
  update: async (id: string, data: { name?: string; type?: string; parentLocation?: string | null }) => {
    const response = await api.put(`/inventory/locations/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/inventory/locations/${id}`);
    return response.data;
  },
};