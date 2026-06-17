import api from './axios';

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