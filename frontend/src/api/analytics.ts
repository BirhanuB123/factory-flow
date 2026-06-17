import api from './axios';

export const analyticsApi = {
  getOee: async (params?: any) => {
    const response = await api.get('/analytics/oee', { params });
    return response.data.data;
  },
  getProfitability: async (params?: any) => {
    const response = await api.get('/analytics/profitability', { params });
    return response.data.data;
  },
  getInventoryTurnover: async (params?: any) => {
    const response = await api.get('/analytics/inventory-turnover', { params });
    return response.data.data;
  },
};