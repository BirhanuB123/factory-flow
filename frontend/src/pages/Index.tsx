import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCards } from "@/components/KpiCards";
import { ProductionJobsTable } from "@/components/ProductionJobsTable";
import { QuickActions } from "@/components/QuickActions";
import { DashboardCharts } from "@/components/DashboardCharts";
import { MachineStatus } from "@/components/MachineStatus";
import { useAuth } from "@/contexts/AuthContext";
import { productionApi, manufacturingApi } from "@/lib/api";
import type { TenantModuleFlags } from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, Sparkles, Zap } from "lucide-react";
import type { TenantModuleFlags } from "@/lib/api";

function subscriptionBadgeVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "suspended" || status === "archived") return "destructive";
  return "outline";
}

function subscriptionStatusLabel(status?: string): string {
  if (status === "active") return "Active";
  if (status === "trial") return "Trial";
  if (status === "suspended") return "Suspended";
  if (status === "archived") return "Archived";
  return "Unknown";
}

function dashboardMfgEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined
) {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.manufacturing !== false;
}

const Index = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const mfgDash = dashboardMfgEnabled(user);

  const { data: kpis } = useQuery({
    queryKey: ["production-kpis", "30d"],
    queryFn: () => productionApi.getKpis(),
    enabled: mfgDash,
  });

  const { data: downtime = [] } = useQuery({
    queryKey: ["manufacturing-downtime"],
    queryFn: () => manufacturingApi.listDowntime({ limit: 200 }),
    enabled: mfgDash,
  });

  const hasOpenDowntime = useMemo(
    () => (downtime as { endedAt?: string | null }[]).some((d) => !d.endedAt),
    [downtime]
  );
  const tenantSubscription = user?.tenantSubscription;
  const userName = user?.name || settings.displayName || "Operator";
  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Good Morning" : hours < 18 ? "Good Afternoon" : "Good Evening";
  const trialDate = tenantSubscription?.trialEndDate ? new Date(tenantSubscription.trialEndDate) : null;
  const trialDaysLeft =
    trialDate != null
      ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
  const isTrialExpired = typeof trialDaysLeft === "number" && trialDaysLeft < 0;
  const isSuspendedOrArchived =
    tenantSubscription?.status === "suspended" || tenantSubscription?.status === "archived";
  const moduleFlags = user?.tenantModuleFlags as Partial<TenantModuleFlags> | undefined;
  const disabledModules = [
    { key: "manufacturing", label: "Manufacturing & production" },
    { key: "inventory", label: "Inventory & stock" },
    { key: "sales", label: "Sales & orders" },
    { key: "procurement", label: "Procurement & POs" },
    { key: "finance", label: "Finance & AP/AR" },
    { key: "hr", label: "HR & payroll" },
  ].filter((m) => moduleFlags?.[m.key as keyof TenantModuleFlags] === false);

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
              {greeting}, {userName.split(' ')[0]}
            </h1>
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-sm font-medium text-muted-foreground max-w-md">
            Your factory is humming. Here's what's happening on the floor right now.
          </p>
        </div>
        
        <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-secondary/50 rounded-2xl backdrop-blur-sm border border-border/50">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">System Health</p>
            <p
              className={`text-sm font-mono font-bold ${
                !mfgDash ? "text-muted-foreground" : hasOpenDowntime ? "text-amber-500" : "text-success"
              }`}
            >
              {!mfgDash ? "—" : hasOpenDowntime ? "CHECK ASSETS" : "OPERATIONAL"}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">OEE proxy (30d)</p>
            <p className="text-sm font-mono font-bold">
              {!mfgDash || kpis == null ? "—" : `${kpis.oeeProxyPct}%`}
            </p>
          </div>
        </div>
      </div>

      {tenantSubscription && user?.platformRole !== "super_admin" && (
        <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent shadow-lg shadow-primary/10">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    Subscription status
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={subscriptionBadgeVariant(tenantSubscription.status)} className="px-2.5 py-1">
                    {subscriptionStatusLabel(tenantSubscription.status)}
                  </Badge>
                  <span className="text-sm font-semibold">{tenantSubscription.displayName || "Current tenant"}</span>
                </div>
                {isSuspendedOrArchived && tenantSubscription.statusReason ? (
                  <p className="text-xs text-destructive inline-flex items-center gap-1.5">
                    <Ban className="h-3.5 w-3.5" />
                    {tenantSubscription.statusReason}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 text-xs">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold uppercase tracking-wide text-foreground">
                    {tenantSubscription.plan || "starter"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Trial ends</span>
                  <span className="font-semibold text-foreground">
                    {trialDate ? trialDate.toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                  {tenantSubscription.status === "active" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  {tenantSubscription.status === "trial" && trialDaysLeft != null ? (
                    <span>
                      {isTrialExpired ? "Trial expired" : `${Math.max(0, trialDaysLeft)} day(s) left in trial`}
                    </span>
                  ) : tenantSubscription.status === "active" ? (
                    <span>Subscription is in good standing</span>
                  ) : (
                    <span>Review subscription details in Settings</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {user?.platformRole !== "super_admin" && (
        <Card className="rounded-2xl border-border/70 bg-background/70">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Module access
              </span>
              {disabledModules.length === 0 ? (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  All enabled
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                  {disabledModules.length} disabled by tenant policy
                </Badge>
              )}
            </div>
            {disabledModules.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {disabledModules.map((mod) => (
                  <Badge key={mod.key} variant="outline" className="text-[10px] uppercase tracking-wider">
                    {mod.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <KpiCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <DashboardCharts />
          <ProductionJobsTable />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <MachineStatus />
        </div>
      </div>
    </div>
  );
};

export default Index;
