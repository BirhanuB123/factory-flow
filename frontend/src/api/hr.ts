import api from './axios';
import { downloadReportCsv } from './finance';

export type HrPayrollRow = {
  _id: string;
  month: string;
  basicSalary: number;
  netSalary: number;
  grossCash?: number;
  pensionEmployee?: number;
  incomeTax?: number;
  paymentStatus: string;
  paymentDate?: string;
  employee?: { name: string; employeeId: string; department?: string };
};

export type PayrollPrepareRow = {
  employee: {
    _id: string;
    employeeId: string;
    name: string;
    salary: number;
    department: string;
    status: string;
    tinNumber?: string;
  };
  basicSalary: number;
  transportAllowance: number;
  overtimeNormalHours: number;
  overtimeRestHolidayHours: number;
  otherTaxableAllowances: number;
  otherDeductions: number;
  includeInRun: boolean;
};

export type PayrollMonthStatus = {
  success: boolean;
  month: string;
  payrollRecordCount: number;
  posted: boolean;
  posting: {
    postedAt: string;
    postedBy?: string;
    totals: Record<string, number>;
    journalEntryId?: string;
  } | null;
  closed: boolean;
  closedAt: string | null;
};

export type HrLeaveRow = {
  _id: string;
  employee?: { _id: string; name: string; employeeId: string; department?: string; status?: string };
  leaveType: 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;
  reviewNote?: string;
  reviewedBy?: { _id: string; name: string; employeeId: string; role?: string } | null;
  reviewedAt?: string | null;
};

export const hrLeaveApi = {
  list: async (params?: {
    employeeId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
    from?: string;
    to?: string;
  }) => {
    const r = await api.get('/hr/leaves', { params });
    return r.data as HrLeaveRow[];
  },
  create: async (body: {
    employee: string;
    leaveType: HrLeaveRow['leaveType'];
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const r = await api.post('/hr/leaves', body);
    return r.data as HrLeaveRow;
  },
  review: async (
    leaveId: string,
    body: { status: 'approved' | 'rejected' | 'cancelled'; reviewNote?: string }
  ) => {
    const r = await api.patch(`/hr/leaves/${leaveId}/review`, body);
    return r.data as HrLeaveRow;
  },
  balance: async (employeeId: string, year?: number) => {
    const r = await api.get(`/hr/leaves/balance/${employeeId}`, {
      params: year ? { year } : {},
    });
    return r.data as {
      employee: {
        _id: string;
        employeeId: string;
        name: string;
        department?: string;
        status?: string;
      };
      year: number;
      balances: Record<
        'annual' | 'sick' | 'maternity' | 'paternity' | 'other' | 'unpaid',
        { entitlement: number | null; used: number; remaining: number | null }
      >;
    };
  },
};

export const hrAttendanceApi = {
  reviewOvertime: async (
    attendanceId: string,
    body: { status: 'approved' | 'rejected'; note?: string }
  ) => {
    const r = await api.patch(`/hr/attendance/${attendanceId}/overtime`, body);
    return r.data;
  },
};

export type HrDepartmentRow = {
  _id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
};

export type HrPositionRow = {
  _id: string;
  code: string;
  title: string;
  department?: { _id: string; code: string; name: string } | string | null;
  reportsToPosition?: { _id: string; code: string; title: string } | string | null;
  active: boolean;
};

export const hrOrgApi = {
  listDepartments: async () => {
    const r = await api.get('/hr/departments');
    return r.data as HrDepartmentRow[];
  },
  createDepartment: async (body: {
    code: string;
    name: string;
    description?: string;
    active?: boolean;
  }) => {
    const r = await api.post('/hr/departments', body);
    return r.data as HrDepartmentRow;
  },
  updateDepartment: async (id: string, body: Partial<HrDepartmentRow>) => {
    const r = await api.put(`/hr/departments/${id}`, body);
    return r.data as HrDepartmentRow;
  },
  listPositions: async (departmentId?: string) => {
    const r = await api.get('/hr/positions', {
      params: departmentId ? { departmentId } : {},
    });
    return r.data as HrPositionRow[];
  },
  createPosition: async (body: {
    code: string;
    title: string;
    department?: string | null;
    reportsToPosition?: string | null;
    active?: boolean;
  }) => {
    const r = await api.post('/hr/positions', body);
    return r.data as HrPositionRow;
  },
  updatePosition: async (id: string, body: Record<string, unknown>) => {
    const r = await api.put(`/hr/positions/${id}`, body);
    return r.data as HrPositionRow;
  },
};

export type EmployeeAttendanceRow = {
  _id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  workMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  overtimeApprovalStatus?: string;
  notes?: string;
};

export type AttendanceCorrectionRow = {
  _id: string;
  attendanceDate: string;
  requestedStatus: 'Present' | 'Absent' | 'Late' | 'On Leave';
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewNote?: string;
  reviewedAt?: string | null;
};

export const employeeSelfServiceApi = {
  getTodayAttendance: async () => {
    const r = await api.get('/employee/attendance/today');
    return r.data?.data as EmployeeAttendanceRow | null;
  },
  listAttendance: async () => {
    const r = await api.get('/employee/attendance');
    return r.data as EmployeeAttendanceRow[];
  },
  submitAttendance: async (body: {
    date: string;
    status: 'Present' | 'Absent' | 'Late' | 'On Leave';
    checkIn?: string;
    checkOut?: string;
    notes?: string;
  }) => {
    const r = await api.post('/employee/attendance', body);
    return r.data?.data as EmployeeAttendanceRow;
  },
  checkIn: async (notes?: string) => {
    const r = await api.post('/employee/attendance/check-in', { notes: notes || '' });
    return r.data?.data as EmployeeAttendanceRow;
  },
  checkOut: async (notes?: string) => {
    const r = await api.post('/employee/attendance/check-out', { notes: notes || '' });
    return r.data?.data as EmployeeAttendanceRow;
  },
  listLeaves: async () => {
    const r = await api.get('/employee/leaves');
    return (r.data?.data || []) as HrLeaveRow[];
  },
  requestLeave: async (body: {
    leaveType: HrLeaveRow['leaveType'];
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const r = await api.post('/employee/leaves', body);
    return r.data?.data as HrLeaveRow;
  },
  updateLeave: async (
    leaveId: string,
    body: {
      leaveType?: HrLeaveRow['leaveType'];
      startDate?: string;
      endDate?: string;
      reason?: string;
    }
  ) => {
    const r = await api.put(`/employee/leaves/${leaveId}`, body);
    return r.data?.data as HrLeaveRow;
  },
  cancelLeave: async (leaveId: string) => {
    const r = await api.delete(`/employee/leaves/${leaveId}`);
    return r.data?.data as HrLeaveRow;
  },
  listAttendanceCorrections: async () => {
    const r = await api.get('/employee/attendance-corrections');
    return (r.data?.data || []) as AttendanceCorrectionRow[];
  },
  requestAttendanceCorrection: async (body: {
    attendanceDate: string;
    requestedStatus: 'Present' | 'Absent' | 'Late' | 'On Leave';
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    reason?: string;
  }) => {
    const r = await api.post('/employee/attendance-corrections', body);
    return r.data?.data as AttendanceCorrectionRow;
  },
};

export const hrAttendanceCorrectionApi = {
  list: async (params?: { status?: 'pending' | 'approved' | 'rejected' | 'cancelled'; employeeId?: string }) => {
    const r = await api.get('/hr/attendance-corrections', { params });
    return r.data as Array<
      AttendanceCorrectionRow & {
        employee?: { _id: string; name: string; employeeId: string; department?: string };
      }
    >;
  },
  review: async (
    id: string,
    body: { status: 'approved' | 'rejected' | 'cancelled'; reviewNote?: string }
  ) => {
    const r = await api.patch(`/hr/attendance-corrections/${id}/review`, body);
    return r.data as AttendanceCorrectionRow;
  },
};

export const hrPayrollApi = {
  list: async (month?: string) => {
    const r = await api.get<{ success: boolean; data: HrPayrollRow[] }>('/hr/payroll', {
      params: month ? { month } : {},
    });
    return r.data.data;
  },
  monthStatus: async (month: string) => {
    const r = await api.get<PayrollMonthStatus>(`/hr/payroll/status/${encodeURIComponent(month)}`);
    return r.data;
  },
  postToFinance: async (month: string) => {
    const r = await api.post<{
      success: boolean;
      idempotent?: boolean;
      message?: string;
      data?: unknown;
    }>(`/hr/payroll/${encodeURIComponent(month)}/post-to-finance`);
    return r.data;
  },
  closeMonth: async (month: string) => {
    const r = await api.post<{
      success: boolean;
      idempotent?: boolean;
      message?: string;
      data?: unknown;
    }>(`/hr/payroll/${encodeURIComponent(month)}/close`);
    return r.data;
  },
  prepare: async (month: string) => {
    const r = await api.get<{
      success: boolean;
      month: string;
      rows: PayrollPrepareRow[];
      hint: string | null;
    }>('/hr/payroll/prepare', { params: { month } });
    return r.data;
  },
  runMonth: async (body: { month: string; entries?: unknown[] }) => {
    const r = await api.post<{
      success: boolean;
      count: number;
      skipped?: Array<{ employeeId?: string; name?: string; reason?: string }>;
      data: HrPayrollRow[];
    }>('/hr/payroll/run', body);
    return r.data;
  },
  updateRecord: async (
    id: string,
    body: { paymentStatus?: string; paymentDate?: string | null }
  ) => {
    const r = await api.patch<{ success: boolean; data: HrPayrollRow }>(
      `/hr/payroll/record/${id}`,
      body
    );
    return r.data.data;
  },
};

export async function downloadPayrollPensionCsv(month: string) {
  await downloadReportCsv('/hr/payroll/export/pension', `ethiopia-pension-${month}.csv`, { month });
}

export async function downloadPayrollIncomeTaxCsv(month: string) {
  await downloadReportCsv(
    '/hr/payroll/export/income-tax',
    `ethiopia-income-tax-${month}.csv`,
    { month }
  );
}

export async function openPayrollPayslipHtml(payrollId: string) {
  const response = await api.get(`/hr/payroll/payslip/${payrollId}/html`, {
    responseType: 'text',
  });
  const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked');
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export const hrEmployeesApi = {
  list: async () => {
    const response = await api.get('/hr/employees');
    return response.data;
  },
};