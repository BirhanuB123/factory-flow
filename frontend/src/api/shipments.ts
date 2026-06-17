import api from './axios';

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