import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HrMetrics } from "@/components/HrMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, CalendarDays, Briefcase } from "lucide-react";

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

  const stats = useMemo(() => {
    const employeesList = Array.isArray(employees) ? employees : [];
    const attendanceList = Array.isArray(attendance) ? attendance : [];

    const activeEmployees = employeesList.filter(e => e?.status === "Active").length;
    const onLeaveEmployees = employeesList.filter(e => e?.status === "On Leave").length;
    const totalEmployees = employeesList.length;
    
    const totalPayroll = employeesList.reduce((acc, e) => {
      const salary = Number(e?.salary);
      return acc + (isNaN(salary) ? 0 : salary);
    }, 0);
    
    const attendanceRate = attendanceList.length > 0 
      ? Math.round((attendanceList.filter(a => a?.status === "Present").length / attendanceList.length) * 100)
      : 0;

    return {
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      totalPayroll,
      attendanceRate
    };
  }, [employees, attendance]);

  if (loading && stats.totalEmployees === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a2744]">HR Overview</h2>
        <p className="text-sm font-medium text-muted-foreground">Quick glance at headcount, attendance, and payroll.</p>
      </div>

      <HrMetrics 
        totalEmployees={stats.totalEmployees}
        activeEmployees={stats.activeEmployees}
        onLeaveEmployees={stats.onLeaveEmployees}
        attendanceRate={stats.attendanceRate}
        totalPayroll={stats.totalPayroll}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active Force</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black">{stats.activeEmployees}</p>
                  <p className="text-sm font-medium text-muted-foreground">out of {stats.totalEmployees}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${stats.totalEmployees > 0 ? (stats.activeEmployees / stats.totalEmployees) * 100 : 0}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">On Leave</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black">{stats.onLeaveEmployees}</p>
                  <p className="text-sm font-medium text-muted-foreground">currently away</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500" 
                style={{ width: `${stats.totalEmployees > 0 ? (stats.onLeaveEmployees / stats.totalEmployees) * 100 : 0}%` }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
