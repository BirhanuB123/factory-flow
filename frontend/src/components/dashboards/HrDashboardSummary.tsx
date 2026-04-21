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
      .then(data => setEmployees(data || []))
      .catch(() => {});

    fetch(`${API_BASE}/attendance`, { headers })
      .then(res => res.json())
      .then(data => setAttendance(data || []))
      .catch(() => {});

    fetch(`${API_BASE}/leaves`, { headers })
      .then(res => res.json())
      .then(data => setLeaves(data?.data || data || []))
      .catch(() => {});
      
  }, [token]);

  const activeEmployees = employees.filter(e => e.status === "Active").length;
  const onLeaveEmployees = employees.filter(e => e.status === "On Leave").length;
  const totalEmployees = employees.length;
  const totalPayroll = useMemo(() => employees.reduce((acc, e) => acc + (e.salary || 0), 0), [employees]);
  
  const attendanceRate = attendance.length > 0 
    ? Math.round((attendance.filter(a => a.status === "Present").length / attendance.length) * 100)
    : 100;

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
