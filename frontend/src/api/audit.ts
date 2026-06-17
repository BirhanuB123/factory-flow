import api from './axios';

export const auditApi = {
  list: async (params?: { limit?: number; skip?: number; action?: string; entityType?: string }) => {
    const response = await api.get('/audit-logs', { params });
    return response.data as {
      success: boolean;
      data: Array<{
        _id: string;
        at: string;
        action: string;
        entityType: string;
        entityId: string;
        summary: string;
        actor?: { name: string; employeeId: string; role?: string };
      }>;
      total: number;
    };
  },
};