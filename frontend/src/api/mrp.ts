import api from './axios';

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