import api from './axios';

export const qualityApi = {
  getChecklists: async () => {
    const response = await api.get('/quality/checklists');
    return response.data.data;
  },
  createChecklist: async (data: any) => {
    const response = await api.post('/quality/checklists', data);
    return response.data.data;
  },
  updateChecklist: async (id: string, data: any) => {
    const response = await api.patch(`/quality/checklists/${id}`, data);
    return response.data.data;
  },
  searchChecklists: async (type: string) => {
    const response = await api.get('/quality/checklists/search', { params: { type } });
    return response.data.data;
  },
  submitInspection: async (data: any) => {
    const response = await api.post('/quality/inspections/submit', data);
    return response.data.data;
  },
};