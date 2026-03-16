import { Card, CardContent } from "@/components/ui/card";
import { Users, CalendarCheck, CreditCard, Clock, TrendingUp } from "lucide-react";

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
  const metrics = [
    {
      title: "Total Talent",
      value: totalEmployees,
      subValue: `+${Math.round(totalEmployees * 0.05)} new`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      trend: "up",
    },
    {
      title: "Active Force",
      value: `${Math.round((activeEmployees / totalEmployees) * 100)}%`,
      subValue: `${activeEmployees} active`,
      icon: CalendarCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      trend: "neutral",
    },
    {
      title: "Attendance",
      value: `${attendanceRate}%`,
      subValue: "Daily Average",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      trend: "up",
    },
    {
      title: "Payroll Velocity",
      value: `$${(totalPayroll / 1000).toFixed(1)}k`,
      subValue: "Current Month",
      icon: CreditCard,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      trend: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, i) => (
        <Card key={i} className="relative overflow-hidden bg-card/40 backdrop-blur-xl border-white/5 hover:border-white/10 transition-all duration-300 group">
          <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 blur-3xl transition-opacity group-hover:opacity-10 ${metric.color.replace('text-', 'bg-')}`} />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`h-12 w-12 rounded-2xl ${metric.bg} flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                <metric.icon className={`h-6 w-6 ${metric.color}`} />
              </div>
              {metric.trend === "up" && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-[10px] font-black uppercase text-emerald-500 italic tracking-widest leading-none">
                  <TrendingUp className="h-3 w-3" />
                  Growth
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">
                {metric.title}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black tracking-tighter italic bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text">
                  {metric.value}
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground italic">
                  {metric.subValue}
                </span>
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
      ))}
    </div>
  );
}
