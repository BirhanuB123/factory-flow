import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HrMetrics } from "@/components/HrMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = `${getApiBaseUrl()}/hr`;

export function HrDashboardSummary() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    if (!token) {
      setLoading(false);
      return;
    }
    
    async function fetchData() {
      const headers = { Authorization: `Bearer ${token}` };
      
      try {
        setLoading(true);
        // We fetch these in parallel for efficiency
        const [empRes, attRes] = await Promise.all([
          fetch(`${API_BASE}/employees`, { headers }),
          fetch(`${API_BASE}/attendance`, { headers })
        ]);

        if (mounted) {
          if (empRes.ok) {
            const empData = await empRes.json();
            const list = Array.isArray(empData) ? empData : (empData?.data && Array.isArray(empData.data) ? empData.data : []);
            setEmployees(list);
          }
          
          if (attRes.ok) {
            const attData = await attRes.json();
            const list = Array.isArray(attData) ? attData : (attData?.data && Array.isArray(attData.data) ? attData.data : []);
            setAttendance(list);
          }
        }
      } catch (error) {
        console.error("Error fetching HR summary data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    return () => { mounted = false; };
  }, [token]);

  const employeesList = Array.isArray(employees) ? employees : [];
  const attendanceList = Array.isArray(attendance) ? attendance : [];

  const activeEmployees = employeesList.filter(e => e?.status === "Active").length;
  const onLeaveEmployees = employeesList.filter(e => e?.status === "On Leave").length;
  const totalEmployees = employeesList.length;
  const totalPayroll = useMemo(() => {
    return employeesList.reduce((acc, e) => {
      const salary = Number(e?.salary);
      return acc + (isNaN(salary) ? 0 : salary);
    }, 0);
  }, [employeesList]);
  
  const attendanceRate = attendanceList.length > 0 
    ? Math.round((attendanceList.filter(a => a?.status === "Present").length / attendanceList.length) * 100)
    : 0;

  if (loading && totalEmployees === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
