import { Wrench, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const kpis = [
  {
    label: "Active Jobs",
    value: "14",
    change: "+2 from yesterday",
    icon: Wrench,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    label: "Machine Utilization",
    value: "82%",
    change: "↑ 3% this week",
    icon: Gauge,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    label: "Low Stock Alerts",
    value: "3",
    change: "Requires attention",
    icon: AlertTriangle,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    alert: true,
  },
  {
    label: "Completed Today",
    value: "5",
    change: "On track for target",
    icon: CheckCircle2,
    iconBg: "bg-info/10",
    iconColor: "text-info",
  },
];

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className={`text-3xl font-bold tracking-tight ${kpi.alert ? "text-destructive" : "text-foreground"}`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-muted-foreground">{kpi.change}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
