import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productionApi, inventoryApi } from "@/lib/api";
import { Wrench, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCards() {
  const navigate = useNavigate();
  const { data: jobs = [] } = useQuery({
    queryKey: ["productions"],
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
      href: "/production-jobs",
    },
    {
      label: "Machine Utilization",
      value: `${displayUtil}%`,
      change: "Based on active jobs",
      icon: Gauge,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      alert: false,
      href: "/production",
    },
    {
      label: "Low Stock Alerts",
      value: String(lowStockCount + outOfStockCount),
      change: lowStockCount + outOfStockCount > 0 ? "Requires attention" : "All good",
      icon: AlertTriangle,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      alert: lowStockCount + outOfStockCount > 0,
      href: "/inventory",
    },
    {
      label: "Completed Today",
      value: String(completedToday),
      change: "Completed status",
      icon: CheckCircle2,
      iconBg: "bg-info/10",
      iconColor: "text-info",
      alert: false,
      href: "/production-jobs?status=Completed",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card 
          key={kpi.label} 
          role="link"
          tabIndex={0}
          className="relative overflow-hidden group border-none shadow-md bg-card/60 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => navigate(kpi.href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(kpi.href);
            }
          }}
        >
          {/* Subtle gradient overlay */}
          <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30 ${kpi.iconBg}`} />
          
          <CardContent className="p-6">
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
                  {kpi.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <h3 className={`text-4xl font-extrabold tracking-tighter ${kpi.alert ? "text-destructive" : "text-foreground"}`}>
                    {kpi.value}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${kpi.alert ? "bg-destructive animate-pulse" : "bg-success"}`} />
                  <p className="text-[11px] font-medium text-muted-foreground inline-flex items-center">
                    {kpi.change}
                  </p>
                </div>
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 ${kpi.iconBg}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
