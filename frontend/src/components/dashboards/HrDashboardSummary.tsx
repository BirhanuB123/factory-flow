import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HrMetrics } from "@/components/HrMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = `${getApiBaseUrl()}/hr`;

export function HrDashboardSummary() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  
  useEffect(() => {
    if (!token) return;
    
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_BASE}/employees`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEmployees(data);
        else if (data?.data && Array.isArray(data.data)) setEmployees(data.data);
        else setEmployees([]);
      })
      .catch(() => setEmployees([]));

    fetch(`${API_BASE}/attendance`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAttendance(data);
        else if (data?.data && Array.isArray(data.data)) setAttendance(data.data);
        else setAttendance([]);
      })
      .catch(() => setAttendance([]));

    fetch(`${API_BASE}/leaves`, { headers })
      .then(res => res.json())
      .then(data => {
        const arr = data?.data || data;
        setLeaves(Array.isArray(arr) ? arr : []);
      })
      .catch(() => setLeaves([]));
      
  }, [token]);

  const employeesList = Array.isArray(employees) ? employees : [];
  const attendanceList = Array.isArray(attendance) ? attendance : [];

  const activeEmployees = employeesList.filter(e => e?.status === "Active").length;
  const onLeaveEmployees = employeesList.filter(e => e?.status === "On Leave").length;
  const totalEmployees = employeesList.length;
  const totalPayroll = useMemo(() => employeesList.reduce((acc, e) => acc + (e?.salary || 0), 0), [employeesList]);
  
  const attendanceRate = attendanceList.length > 0 
    ? Math.round((attendanceList.filter(a => a?.status === "Present").length / attendanceList.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-[#1a2744]">HR Overview</h2>
        <p className="text-sm text-muted-foreground">Quick glance at headcount, attendance, and payroll.</p>
      </div>
      <HrMetrics 
        totalEmployees={totalEmployees}
        activeEmployees={activeEmployees}
        onLeaveEmployees={onLeaveEmployees}
        attendanceRate={attendanceRate}
        totalPayroll={totalPayroll}
      />
    </div>
  );
}
