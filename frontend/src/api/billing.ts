import api from './axios';

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