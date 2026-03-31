import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productionApi, inventoryApi, manufacturingApi, type TenantModuleFlags } from "@/lib/api";
import { Wrench, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { PERMS } from "@/lib/permissions";

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

function assetIdFromDowntime(d: { asset: string | { _id?: string }; endedAt?: string | null }): string | null {
  const a = d.asset;
  if (a && typeof a === "object" && "_id" in a && a._id) return String(a._id);
  if (typeof a === "string") return a;
  return null;
}

export function KpiCards() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const mfgEnabled = moduleEnabled(user, "manufacturing") && can(PERMS.DASHBOARD_MFG);
  const invEnabled = moduleEnabled(user, "inventory") && can(PERMS.DASHBOARD_INVENTORY);

  const { data: jobs = [] } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
    enabled: mfgEnabled,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
    enabled: invEnabled,
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["manufacturing-assets"],
    queryFn: manufacturingApi.listAssets,
    enabled: mfgEnabled,
  });
  const { data: downtime = [] } = useQuery({
    queryKey: ["manufacturing-downtime"],
    queryFn: () => manufacturingApi.listDowntime({ limit: 200 }),
    enabled: mfgEnabled,
  });

  const activeJobs = jobs.filter((j: { status: string }) => j.status === "In Progress" || j.status === "Scheduled").length;
  const completedToday = jobs.filter((j: { status: string; dueDate?: string; updatedAt?: string }) => {
    if (j.status !== "Completed") return false;
    const t = new Date((j as { updatedAt?: string }).updatedAt || j.dueDate || 0).getTime();
    return new Date(t).toDateString() === new Date().toDateString();
  }).length;
  const lowStockCount = inventory.filter((i: { stock: number; reorderPoint: number }) => i.stock <= i.reorderPoint && i.reorderPoint > 0).length;
  const outOfStockCount = inventory.filter((i: { stock: number }) => i.stock === 0).length;

  const fleetAvailabilityPct = useMemo(() => {
    const list = (assets as { _id: string; active?: boolean }[]).filter((a) => a.active !== false);
    if (list.length === 0) return null;
    const open = new Set<string>();
    for (const d of downtime as { asset: string | { _id?: string }; endedAt?: string | null }[]) {
      if (d.endedAt) continue;
      const id = assetIdFromDowntime(d);
      if (id) open.add(id);
    }
    const downCount = list.filter((a) => open.has(String(a._id))).length;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - downCount / list.length))));
  }, [assets, downtime]);

  const workloadPct = useMemo(() => {
    const pool = jobs.filter((j: { status: string }) => j.status !== "Cancelled").length;
    if (pool <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((100 * activeJobs) / pool)));
  }, [jobs, activeJobs]);

  const displayUtil = fleetAvailabilityPct != null ? fleetAvailabilityPct : workloadPct;

  const kpis = [
    {
      label: "Active Jobs",
      value: mfgEnabled ? String(activeJobs) : "—",
      change: "Scheduled + In Progress",
      icon: Wrench,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      alert: false,
      href: "/production-jobs",
    },
    {
      label: "Floor availability",
      value: mfgEnabled ? `${displayUtil}%` : "—",
      change: fleetAvailabilityPct != null ? "Assets not in open downtime" : "Share of open jobs in progress",
      icon: Gauge,
      iconBg: "bg-success/10",
      iconColor: "text-success",
      alert: false,
      href: "/production",
    },
    {
      label: "Low Stock Alerts",
      value: invEnabled ? String(lowStockCount + outOfStockCount) : "—",
      change: invEnabled
        ? lowStockCount + outOfStockCount > 0
          ? "Requires attention"
          : "All good"
        : "Inventory module disabled",
      icon: AlertTriangle,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      alert: invEnabled && lowStockCount + outOfStockCount > 0,
      href: "/inventory",
    },
    {
      label: "Completed Today",
      value: mfgEnabled ? String(completedToday) : "—",
      change: "Completed today (by last update)",
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
