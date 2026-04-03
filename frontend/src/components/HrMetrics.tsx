import { Card, CardContent } from "@/components/ui/card";
import { Users, CalendarCheck, Clock, CreditCard } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface HrMetricsProps {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  attendanceRate: number;
  totalPayroll: number;
}

export function HrMetrics({
  totalEmployees,
  activeEmployees,
  onLeaveEmployees,
  attendanceRate,
  totalPayroll,
}: HrMetricsProps) {
  const { format } = useCurrency();
  const activePct = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;

  const stats = [
    {
      label: "Headcount",
      value: String(totalEmployees),
      sub: `${onLeaveEmployees} on leave`,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active",
      value: `${activePct}%`,
      sub: `${activeEmployees} active`,
      icon: CalendarCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Attendance",
      value: `${attendanceRate}%`,
      sub: "Present rate (period)",
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Payroll base",
      value: format(totalPayroll),
      sub: "Sum of monthly basic",
      icon: CreditCard,
      color: "text-info",
      bg: "bg-info/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => (
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
  );
}
