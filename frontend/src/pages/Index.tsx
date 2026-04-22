import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCards } from "@/components/KpiCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardFeedsCalendar } from "@/components/DashboardFeedsCalendar";
import { FinanceDashboardSummary } from "@/components/dashboards/FinanceDashboardSummary";
import { HrDashboardSummary } from "@/components/dashboards/HrDashboardSummary";
import { EmployeeDashboardSummary } from "@/components/dashboards/EmployeeDashboardSummary";
import { ProcurementDashboardSummary } from "@/components/dashboards/ProcurementDashboardSummary";
import { useAuth } from "@/contexts/AuthContext";
import { productionApi, manufacturingApi } from "@/lib/api";
import type { TenantModuleFlags } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, Zap, LayoutGrid, Users, DollarSign, Activity } from "lucide-react";
import { PERMS } from "@/lib/permissions";
import { useLocale } from "@/contexts/LocaleContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function subscriptionBadgeVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "suspended" || status === "archived") return "destructive";
  return "outline";
}

function dashboardMfgEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined
) {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.manufacturing !== false;
}

const Index = () => {
  const { t } = useLocale();
  const { user, can } = useAuth();

  function subscriptionStatusLabel(status?: string): string {
    if (status === "active") return t("sub.active");
    if (status === "trial") return t("sub.trial");
    if (status === "suspended") return t("sub.suspended");
    if (status === "archived") return t("sub.archived");
    return t("sub.unknown");
  }
  const mfgDash = dashboardMfgEnabled(user) && can(PERMS.DASHBOARD_MFG);
  const showOpsDashboard = can(PERMS.DASHBOARD_MFG) || can(PERMS.DASHBOARD_INVENTORY);

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
  const trialDate = tenantSubscription?.trialEndDate ? new Date(tenantSubscription.trialEndDate) : null;
  const trialDaysLeft =
    trialDate != null
      ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
  const isTrialExpired = typeof trialDaysLeft === "number" && trialDaysLeft < 0;
  const isSuspendedOrArchived =
    tenantSubscription?.status === "suspended" || tenantSubscription?.status === "archived";
  const moduleFlags = user?.tenantModuleFlags as Partial<TenantModuleFlags> | undefined;
  const disabledModules = (
    [
      { key: "manufacturing" as const, labelKey: "dashboard.moduleMfg" as const },
      { key: "inventory" as const, labelKey: "dashboard.moduleInv" as const },
      { key: "sales" as const, labelKey: "dashboard.moduleSales" as const },
      { key: "procurement" as const, labelKey: "dashboard.moduleProc" as const },
      { key: "finance" as const, labelKey: "dashboard.moduleFin" as const },
      { key: "hr" as const, labelKey: "dashboard.moduleHr" as const },
    ] as const
  ).filter((m) => moduleFlags?.[m.key as keyof TenantModuleFlags] === false);

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("dashboard.title")}</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="hidden items-center gap-6 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("dashboard.systemHealth")}
            </p>
            <p
              className={`text-sm font-semibold ${
                !mfgDash ? "text-muted-foreground" : hasOpenDowntime ? "text-amber-600" : "text-[hsl(152,69%,36%)]"
              }`}
            >
              {!mfgDash ? "—" : hasOpenDowntime ? t("dashboard.checkAssets") : t("dashboard.operational")}
            </p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("dashboard.oeeProxy")}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {!mfgDash || kpis == null ? "—" : `${kpis.oeeProxyPct}%`}
            </p>
          </div>
        </div>
      </div>

      {tenantSubscription && user?.platformRole !== "super_admin" && (
        <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-erp">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("dashboard.subscriptionStatus")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={subscriptionBadgeVariant(tenantSubscription.status)} className="px-2.5 py-1">
                    {subscriptionStatusLabel(tenantSubscription.status)}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {tenantSubscription.displayName || t("dashboard.currentTenant")}
                  </span>
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
                  <span className="text-muted-foreground">{t("dashboard.plan")}</span>
                  <span className="font-semibold uppercase tracking-wide text-foreground">
                    {tenantSubscription.plan || "starter"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("dashboard.trialEnds")}</span>
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
                      {isTrialExpired
                        ? t("dashboard.trialExpired")
                        : t("dashboard.trialDaysLeft", { n: Math.max(0, trialDaysLeft) })}
                    </span>
                  ) : tenantSubscription.status === "active" ? (
                    <span>{t("dashboard.subscriptionGood")}</span>
                  ) : (
                    <span>{t("dashboard.reviewSettings")}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {user?.platformRole !== "super_admin" && (
        <Card className="rounded-2xl border border-border/60 bg-card shadow-erp-sm">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                {t("dashboard.moduleAccess")}
              </span>
              {disabledModules.length === 0 ? (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {t("dashboard.allEnabled")}
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                  {disabledModules.length} {t("dashboard.disabledPolicy")}
                </Badge>
              )}
            </div>
            {disabledModules.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {disabledModules.map((mod) => (
                  <Badge key={mod.key} variant="outline" className="text-[10px] uppercase tracking-wider">
                    {t(mod.labelKey)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {user?.platformRole === "super_admin" || user?.role === "Admin" ? (
        <Tabs defaultValue="operations" className="space-y-6">
          <TabsList className="bg-transparent p-0 border-b border-border/50 rounded-none w-full justify-start h-auto flex-wrap">
            <TabsTrigger
              value="operations"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Activity className="mr-2 h-4 w-4" />
              Operations
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Finance
            </TabsTrigger>
            <TabsTrigger
              value="hr"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Users className="mr-2 h-4 w-4" />
              Human Resources
            </TabsTrigger>
            <TabsTrigger
              value="procurement"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Truck className="mr-2 h-4 w-4" />
              Procurement
            </TabsTrigger>
          </TabsList>
          <TabsContent value="operations" className="mt-0 space-y-6 focus-visible:outline-none">
            <KpiCards />
            <DashboardCharts />
            <DashboardFeedsCalendar />
          </TabsContent>
          <TabsContent value="finance" className="mt-0 space-y-6 focus-visible:outline-none">
            <FinanceDashboardSummary />
          </TabsContent>
          <TabsContent value="hr" className="mt-0 space-y-6 focus-visible:outline-none">
            <HrDashboardSummary />
          </TabsContent>
          <TabsContent value="procurement" className="mt-0 space-y-6 focus-visible:outline-none">
            <ProcurementDashboardSummary />
          </TabsContent>
        </Tabs>
      ) : user?.role === "finance_head" || user?.role === "finance_viewer" ? (
        <FinanceDashboardSummary />
      ) : user?.role === "hr_head" ? (
        <HrDashboardSummary />
      ) : user?.role === "purchasing_head" || user?.role === "warehouse_head" ? (
        <ProcurementDashboardSummary />
      ) : user?.role === "employee" ? (
        <EmployeeDashboardSummary />
      ) : showOpsDashboard ? (
        <div className="space-y-6">
          <KpiCards />
          <DashboardCharts />
          <DashboardFeedsCalendar />
        </div>
      ) : null}
    </div>
  );
};

export default Index;
