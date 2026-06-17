import api from './axios';

export const announcementApi = {
  getCurrent: async () => {
    const response = await api.get<{
      success: boolean;
      data:
        | null
        | {
            source: 'tenant' | 'global';
            enabled: boolean;
            level: 'info' | 'warning' | 'maintenance';
            message: string;
            updatedAt?: string | null;
            updatedByEmployeeId?: string;
          };
    }>('/announcements/current');
    return response.data;
  },
};