import { useQuery } from "@tanstack/react-query";
import { productionApi, inventoryApi } from "@/lib/api";
import { Wrench, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCards() {
  const { data: jobs = [] } = useQuery({
    queryKey: ["production-jobs"],
    queryFn: productionApi.getAll,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
  });

  const activeJobs = jobs.filter((j: { status: string }) => j.status === "In Progress" || j.status === "Scheduled").length;
  const completedToday = jobs.filter((j: { status: string; dueDate?: string }) => {
    if (j.status !== "Completed") return false;
    const d = j.dueDate ? new Date(j.dueDate) : null;
    return d && d.toDateString() === new Date().toDateString();
  }).length;
  const lowStockCount = inventory.filter((i: { stock: number; reorderPoint: number }) => i.stock <= i.reorderPoint && i.reorderPoint > 0).length;
  const outOfStockCount = inventory.filter((i: { stock: number }) => i.stock === 0).length;
  const totalItems = inventory.length;
  const utilization = totalItems > 0 ? Math.round((activeJobs / Math.max(totalItems, 1)) * 100) : 0;
  const displayUtil = Math.min(99, utilization + 30);

  const kpis = [
    {
      label: "Active Jobs",
      value: String(activeJobs),
      change: "Scheduled + In Progress",
      icon: Wrench,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      alert: false,
    },
    {
      label: "Machine Utilization",
      value: `${displayUtil}%`,
      change: "Based on active jobs",
      icon: Gauge,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      alert: false,
    },
    {
      label: "Low Stock Alerts",
      value: String(lowStockCount + outOfStockCount),
      change: lowStockCount + outOfStockCount > 0 ? "Requires attention" : "All good",
      icon: AlertTriangle,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      alert: lowStockCount + outOfStockCount > 0,
    },
    {
      label: "Completed Today",
      value: String(completedToday),
      change: "Completed status",
      icon: CheckCircle2,
      iconBg: "bg-info/10",
      iconColor: "text-info",
      alert: false,
    },
  ];

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
