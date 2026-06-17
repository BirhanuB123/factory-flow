import api from './axios';

export const tenantApi = {
  getSettings: async () => {
    const response = await api.get('/tenant/settings');
    return response.data.data;
  },
  updateDocumentSettings: async (documentSettings: any) => {
    const response = await api.patch('/tenant/document-settings', { documentSettings });
    return response.data.data;
  },
  updateInfo: async (info: any) => {
    const response = await api.patch('/tenant/info', info);
    return response.data.data;
  },
};