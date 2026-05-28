import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HrMetrics } from "@/components/HrMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, HeartPulse, UserCheck, Users } from "lucide-react";

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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-[0_20px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-emerald-400" />
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_320px] lg:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              <Users className="h-3.5 w-3.5" />
              People command center
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">HR Overview</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                  Headcount, attendance, payroll exposure, and workforce availability in one glance.
                </p>
              </div>
              <Badge
                variant={stats.attendanceRate >= 80 ? "success" : "secondary"}
                className="w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              >
                {stats.attendanceRate >= 80 ? "Healthy attendance" : "Attendance review"}
              </Badge>
            </div>
          </div>

          <div className="rounded-[16px] border border-border/60 bg-background/70 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attendance pulse</p>
                <p className="mt-1 text-3xl font-black tracking-tight">{stats.attendanceRate}%</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                <HeartPulse className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, stats.attendanceRate))}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[12px] bg-secondary/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active</p>
                <p className="mt-1 text-xl font-black">{stats.activeEmployees}</p>
              </div>
              <div className="rounded-[12px] bg-secondary/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">On leave</p>
                <p className="mt-1 text-xl font-black">{stats.onLeaveEmployees}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HrMetrics 
        totalEmployees={stats.totalEmployees}
        activeEmployees={stats.activeEmployees}
        onLeaveEmployees={stats.onLeaveEmployees}
        attendanceRate={stats.attendanceRate}
        totalPayroll={stats.totalPayroll}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-blue-500/10 text-blue-600">
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
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${stats.totalEmployees > 0 ? (stats.activeEmployees / stats.totalEmployees) * 100 : 0}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-purple-500/10 text-purple-600">
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
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
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
