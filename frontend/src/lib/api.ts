import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
  create: async (data: any) => {
    const response = await api.post('/boms', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/boms/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/boms/${id}`);
    return response.data;
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
  create: async (data: any) => {
    const response = await api.post('/production', data);
    return response.data.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/production/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/production/${id}`);
    return response.data;
  },
};

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
};

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

export default api;
