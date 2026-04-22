import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, CheckCircle2, TrendingUp, AlertCircle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { employeeSelfServiceApi } from "@/lib/api";

export function EmployeeDashboardSummary() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [attData, leaveData] = await Promise.all([
          employeeSelfServiceApi.listAttendance(),
          employeeSelfServiceApi.listLeaves()
        ]);
        setAttendance(Array.isArray(attData) ? attData : []);
        setLeaves(Array.isArray(leaveData) ? leaveData : []);
      } catch (error) {
        console.error("Error fetching employee summary:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const attList = Array.isArray(attendance) ? attendance : [];
    const leaveList = Array.isArray(leaves) ? leaves : [];

    const presentCount = attList.filter(a => a.status === "Present").length;
    const attendanceRate = attList.length > 0 ? Math.round((presentCount / attList.length) * 100) : 100;
    
    const pendingLeaves = leaveList.filter(l => l.status === "pending").length;
    const approvedLeaves = leaveList.filter(l => l.status === "approved").length;

    return {
      attendanceRate,
      pendingLeaves,
      approvedLeaves,
      totalEntries: attList.length
    };
  }, [attendance, leaves]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a2744]">Welcome, {user?.name || "Employee"}!</h2>
        <p className="text-sm font-medium text-muted-foreground">Here's your activity overview and quick tools.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Attendance Rate",
            value: `${metrics.attendanceRate}%`,
            sub: "Overall presence",
            icon: TrendingUp,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Pending Leaves",
            value: String(metrics.pendingLeaves),
            sub: "Awaiting review",
            icon: AlertCircle,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: "Approved Leaves",
            value: String(metrics.approvedLeaves),
            sub: "This year",
            icon: CheckCircle2,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Work Logs",
            value: String(metrics.totalEntries),
            sub: "Total entries",
            icon: FileText,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
          },
        ].map((stat, idx) => (
          <Card
            key={idx}
            className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="truncate text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all hover:shadow-lg">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Time & Attendance</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Review your recent clock-in histories and hours worked.
            </p>
            <Button asChild className="w-full rounded-full bg-primary hover:bg-primary/90">
              <Link to="/hr/my-profile">View Attendance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all hover:shadow-lg">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 text-amber-600 group-hover:scale-110 transition-transform">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Leave Requests</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Check your leave balances and submit a new request.
            </p>
            <Button asChild variant="outline" className="w-full rounded-full border-border/60 shadow-none hover:bg-secondary/50">
              <Link to="/hr/my-profile">Manage Leaves</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all hover:shadow-lg">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Your Tasks</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              You are all caught up! No critical actions required.
            </p>
            <Button variant="ghost" className="w-full rounded-full text-muted-foreground" disabled>
              All Done
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
