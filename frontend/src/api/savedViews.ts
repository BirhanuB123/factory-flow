import api from './axios';

export const savedViewsApi = {
  list: async (module?: string) => {
    const response = await api.get('/saved-views', { params: module ? { module } : {} });
    return response.data.data as Array<{ _id: string; name: string; module: string; filters: Record<string, unknown> }>;
  },
  create: async (body: { name: string; module: string; filters: Record<string, unknown> }) => {
    const response = await api.post('/saved-views', body);
    return response.data.data;
  },
  remove: async (id: string) => {
    await api.delete(`/saved-views/${id}`);
  },
};