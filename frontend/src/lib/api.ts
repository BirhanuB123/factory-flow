import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
};

export const bomApi = {
  getAll: async () => {
    const response = await api.get('/boms');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/boms/${id}`);
    return response.data.data;
  },
};

export const productionApi = {
  getAll: async () => {
    const response = await api.get('/production');
    return response.data.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/production/${id}`);
    return response.data.data;
  },
};

export default api;
