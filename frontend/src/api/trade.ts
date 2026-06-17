import api from './axios';

export const tradeApi = {
  getAll: async () => {
    const response = await api.get('/trade');
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/trade/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/trade', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/trade/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/trade/${id}`);
    return response.data;
  },
  logExpense: async (id: string, data: {
    expenseType: 'freight' | 'duty' | 'clearing';
    amount: number;
    vendorId: string;
    billNumber?: string;
    billDate?: string;
    dueDate?: string;
    notes?: string;
  }) => {
    const response = await api.post(`/trade/${id}/expenses`, data);
    return response.data;
  },
};