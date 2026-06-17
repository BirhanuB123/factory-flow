import api from './axios';

export const manufacturingApi = {
  getWorkCenters: async () => {
    const response = await api.get('/manufacturing/work-centers');
    return response.data.data;
  },
  createWorkCenter: async (data: { code: string; name: string; hoursPerDay?: number; notes?: string }) => {
    const response = await api.post('/manufacturing/work-centers', data);
    return response.data.data;
  },
  listAssets: async () => {
    const response = await api.get('/manufacturing/assets');
    return response.data.data;
  },
  createAsset: async (data: { code: string; name: string; workCenter?: string; manufacturer?: string; serialNumber?: string; notes?: string }) => {
    const response = await api.post('/manufacturing/assets', data);
    return response.data.data;
  },
  listPmSchedules: async () => {
    const response = await api.get('/manufacturing/pm-schedules');
    return response.data.data;
  },
  createPmSchedule: async (data: { asset: string; title: string; frequencyDays: number; nextDueDate: string; notes?: string }) => {
    const response = await api.post('/manufacturing/pm-schedules', data);
    return response.data.data;
  },
  completePm: async (id: string) => {
    const response = await api.post(`/manufacturing/pm-schedules/${id}/complete`);
    return response.data.data;
  },
  listDowntime: async (params?: { assetId?: string; limit?: number }) => {
    const response = await api.get('/manufacturing/downtime', { params });
    return response.data.data;
  },
  createDowntime: async (data: { asset: string; reasonCode?: string; description?: string; reportedBy?: string }) => {
    const response = await api.post('/manufacturing/downtime', data);
    return response.data.data;
  },
  endDowntime: async (id: string) => {
    const response = await api.post(`/manufacturing/downtime/${id}/end`);
    return response.data.data;
  },
};