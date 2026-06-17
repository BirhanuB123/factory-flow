import api from './axios';

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