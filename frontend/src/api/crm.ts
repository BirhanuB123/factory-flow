import api from './axios';

export const crmApi = {
  leads: {
    getAll: async () => {
      const response = await api.get('/crm/leads');
      return response.data.data;
    },
    getOne: async (id: string) => {
      const response = await api.get(`/crm/leads/${id}`);
      return response.data.data;
    },
    create: async (data: any) => {
      const response = await api.post('/crm/leads', data);
      return response.data.data;
    },
    update: async (id: string, data: any) => {
      const response = await api.put(`/crm/leads/${id}`, data);
      return response.data.data;
    },
    delete: async (id: string) => {
      const response = await api.delete(`/crm/leads/${id}`);
      return response.data;
    },
    convert: async (id: string) => {
      const response = await api.post(`/crm/leads/${id}/convert`);
      return response.data.data;
    },
  },
  quotes: {
    getAll: async () => {
      const response = await api.get('/crm/quotes');
      return response.data.data;
    },
    getOne: async (id: string) => {
      const response = await api.get(`/crm/quotes/${id}`);
      return response.data.data;
    },
    create: async (data: any) => {
      const response = await api.post('/crm/quotes', data);
      return response.data.data;
    },
    update: async (id: string, data: any) => {
      const response = await api.put(`/crm/quotes/${id}`, data);
      return response.data.data;
    },
    delete: async (id: string) => {
      const response = await api.delete(`/crm/quotes/${id}`);
      return response.data;
    },
    convert: async (id: string) => {
      const response = await api.post(`/crm/quotes/${id}/convert`);
      return response.data.data;
    },
  },
};