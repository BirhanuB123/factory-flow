import api from './axios';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReportsSeriesRow = {
  key: string;
  label: string;
  ordersCount: number;
  ordersRevenue: number;
  newClients: number;
  paidRevenue: number;
  expenses: number;
  jobsCreated: number;
  jobsCompleted: number;
  poCount: number;
  poValue: number;
  shipmentsShipped: number;
};

export type ReportsSummaryResponse = {
  period: ReportPeriod;
  timezone: string;
  window: { start: string; end: string };
  sales: boolean;
  finance: boolean;
  manufacturing: boolean;
  procurement: boolean;
  inventory: boolean;
  shipments: boolean;
  kpis: {
    ordersCount: number;
    ordersRevenue: number;
    newClients: number;
    paidRevenue?: number;
    expensesTotal?: number;
    profit?: number;
    pendingInvoicesCount?: number;
    jobsCreated: number;
    jobsCompleted: number;
    poCount: number;
    poValue: number;
    shipmentsShipped: number;
    inventorySkus: number;
    inventoryUnits: number;
    inventoryValue: number;
  };
  kpisLifetime: {
    totalOrders: number;
    totalClients: number;
    totalProducts: number;
  };
  series: ReportsSeriesRow[];
};

export const reportsApi = {
  getSummary: async (period: ReportPeriod) => {
    const response = await api.get<ReportsSummaryResponse>('/reports/summary', { params: { period } });
    return response.data;
  },
};