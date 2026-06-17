import api from './axios';

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
  getByToken: async (token: string) => {
    const response = await api.get(`/production/job-by-token/${token}`);
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
  createFromOrder: async (body: {
    orderId: string;
    lineIndex: number;
    quantity?: number;
    jobId?: string;
    dueDate?: string;
    priority?: string;
    assignedTo?: string;
  }) => {
    const response = await api.post('/production/from-order', body);
    return response.data.data;
  },
  reserveMaterials: async (jobId: string) => {
    const response = await api.post(`/production/${jobId}/reserve-materials`);
    return response.data.data;
  },
  syncOperations: async (jobId: string) => {
    const response = await api.post(`/production/${jobId}/sync-operations`);
    return response.data.data;
  },
  startOperation: async (jobId: string, opIndex: number) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/start`);
    return response.data.data;
  },
  completeOperation: async (jobId: string, opIndex: number) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/complete`);
    return response.data.data;
  },
  logOperationTime: async (jobId: string, opIndex: number, body: { minutes: number; note?: string }) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/time`, body);
    return response.data.data;
  },
  scrapReworkOperation: async (
    jobId: string,
    opIndex: number,
    body: { scrapQty?: number; reworkQty?: number }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/scrap-rework`, body);
    return response.data.data;
  },
  logOperationWip: async (
    jobId: string,
    opIndex: number,
    body: { wipInQty?: number; wipOutQty?: number }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/wip`, body);
    return response.data.data;
  },
  recordOperationQuality: async (
    jobId: string,
    opIndex: number,
    body: { status: 'pass' | 'fail' | 'waive' }
  ) => {
    const response = await api.post(`/production/${jobId}/operations/${opIndex}/quality`, body);
    return response.data.data;
  },
  issueMaterial: async (
    jobId: string,
    body: {
      productId: string;
      quantity: number;
      operationIndex?: number;
      note?: string;
      lotNumber?: string;
      serialNumber?: string;
    }
  ) => {
    const response = await api.post(`/production/${jobId}/materials/issue`, body);
    return response.data.data;
  },
  returnMaterial: async (
    jobId: string,
    body: {
      productId: string;
      quantity: number;
      operationIndex?: number;
      note?: string;
      lotNumber?: string;
      serialNumber?: string;
    }
  ) => {
    const response = await api.post(`/production/${jobId}/materials/return`, body);
    return response.data.data;
  },
  updateCosting: async (
    jobId: string,
    body: {
      plannedLaborCost?: number;
      plannedMachineCost?: number;
      plannedOverheadCost?: number;
      actualLaborCost?: number;
      actualMachineCost?: number;
      actualOverheadCost?: number;
    }
  ) => {
    const response = await api.patch(`/production/${jobId}/costing`, body);
    return response.data.data;
  },
  getCapacityPlan: async (params?: { from?: string; to?: string; capacityPerDayMinutes?: number }) => {
    const response = await api.get('/production/capacity/plan', { params });
    return response.data.data as Array<{
      day: string;
      workCenterCode: string;
      loadMinutes: number;
      jobs: number;
      capacityMinutes: number;
      utilizationPct: number;
      overloaded: boolean;
    }>;
  },
  getKpis: async (params?: { from?: string; to?: string }) => {
    const response = await api.get('/production/kpis', { params });
    return response.data.data as {
      window: { from: string; to: string };
      jobsCreated: number;
      jobsCompleted: number;
      throughputQty: number;
      scheduleAdherencePct: number;
      scrapRatePct: number;
      oeeProxyPct: number;
    };
  },
};