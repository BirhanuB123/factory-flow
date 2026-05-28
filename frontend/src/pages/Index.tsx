import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KpiCards } from "@/components/KpiCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardFeedsCalendar } from "@/components/DashboardFeedsCalendar";
import { FinanceDashboardSummary } from "@/components/dashboards/FinanceDashboardSummary";
import { HrDashboardSummary } from "@/components/dashboards/HrDashboardSummary";
import { EmployeeDashboardSummary } from "@/components/dashboards/EmployeeDashboardSummary";
import { ProcurementDashboardSummary } from "@/components/dashboards/ProcurementDashboardSummary";
import { useAuth } from "@/contexts/AuthContext";
import { manufacturingApi, productionApi } from "@/lib/api";
import type { TenantModuleFlags } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Factory,
  Gauge,
  LayoutDashboard,
  PackageCheck,
  ShieldCheck,
  Truck,
  Users,
  Zap,
} from "lucide-react";
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
    trialDate != null ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
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
  const isSuperAdmin = user?.platformRole === "super_admin";
  const enabledModuleCount = 6 - disabledModules.length;
  const displayName = user?.name?.split(" ")?.[0] || "there";
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const systemHealthLabel = !mfgDash
    ? "Platform overview"
    : hasOpenDowntime
      ? t("dashboard.checkAssets")
      : t("dashboard.operational");
  const oeeProxyLabel = !mfgDash || kpis == null ? "0%" : `${kpis.oeeProxyPct}%`;

  const attentionSummary = useMemo(() => {
    if (isSuperAdmin) {
      if (hasOpenDowntime) {
        return {
          label: "Needs attention",
          value: "Open maintenance event",
          detail: "Operations has an active downtime signal that needs review.",
          icon: AlertTriangle,
          tone: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/10",
        };
      }

      return {
        label: "Needs attention",
        value: "No active blockers",
        detail: "Platform services and tenant access are stable.",
        icon: CheckCircle2,
        tone: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      };
    }

    if (isSuspendedOrArchived) {
      return {
        label: "Needs attention",
        value: "Subscription blocked",
        detail: tenantSubscription?.statusReason || "Review the tenant status before continuing.",
        icon: Ban,
        tone: "text-destructive",
        bg: "bg-destructive/10",
      };
    }

    if (isTrialExpired) {
      return {
        label: "Needs attention",
        value: "Trial expired",
        detail: "Renew access or move the tenant to an active plan.",
        icon: AlertTriangle,
        tone: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
      };
    }

    if (tenantSubscription?.status === "trial" && trialDaysLeft != null && trialDaysLeft <= 7) {
      return {
        label: "Needs attention",
        value: `${Math.max(0, trialDaysLeft)} days left`,
        detail: "The tenant is close to the trial deadline.",
        icon: CalendarClock,
        tone: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
      };
    }

    if (disabledModules.length > 0) {
      return {
        label: "Needs attention",
        value: `${disabledModules.length} module limits`,
        detail: "Some workspace areas are unavailable to this tenant.",
        icon: Factory,
        tone: "text-primary",
        bg: "bg-primary/10",
      };
    }

    return {
      label: "Needs attention",
      value: "No blockers",
      detail: mfgDash ? "Workspace is healthy enough to proceed." : "Role access is ready.",
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  }, [
    disabledModules.length,
    hasOpenDowntime,
    isSuperAdmin,
    isSuspendedOrArchived,
    isTrialExpired,
    mfgDash,
    tenantSubscription?.status,
    tenantSubscription?.statusReason,
    trialDaysLeft,
  ]);

  const roleAction = useMemo(() => {
    if (isSuperAdmin) {
      return {
        label: "Open platform admin",
        href: "/platform",
        detail: "Manage tenants, audit logs, and global controls.",
      };
    }

    if (user?.role === "finance_head" || user?.role === "finance_viewer") {
      return {
        label: "Open finance work",
        href: "/finance",
        detail: "Review cash, AP/AR, and finance summaries.",
      };
    }

    if (user?.role === "hr_head") {
      return {
        label: "Open HR work",
        href: "/hr",
        detail: "Review headcount, payroll, and employee actions.",
      };
    }

    if (user?.role === "purchasing_head" || user?.role === "warehouse_head") {
      return {
        label: "Open procurement work",
        href: "/purchase-orders",
        detail: "Move on sourcing, receiving, and inventory flow.",
      };
    }

    if (user?.role === "employee") {
      return {
        label: "Open my HR",
        href: "/my-hr",
        detail: "Review personal tasks, attendance, and requests.",
      };
    }

    if (showOpsDashboard) {
      return {
        label: can(PERMS.DASHBOARD_MFG) ? "Open production" : "Open inventory",
        href: can(PERMS.DASHBOARD_MFG) ? "/production" : "/inventory",
        detail: "Jump into the operational summary for today.",
      };
    }

    return {
      label: "Open profile",
      href: "/profile",
      detail: "Review your access and account details.",
    };
  }, [can, isSuperAdmin, showOpsDashboard, user?.role]);

  const changeSummary = useMemo(() => {
    if (tenantSubscription?.status === "trial") {
      return {
        label: "What changed",
        value: trialDaysLeft != null ? `${Math.max(0, trialDaysLeft)} days left` : "Trial active",
        detail: trialDate ? `Trial ends ${trialDate.toLocaleDateString()}` : "Trial status updated recently.",
        icon: CalendarClock,
        tone: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
      };
    }

    if (tenantSubscription?.status) {
      return {
        label: "What changed",
        value: subscriptionStatusLabel(tenantSubscription.status),
        detail: tenantSubscription.displayName || t("dashboard.currentTenant"),
        icon: ShieldCheck,
        tone: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      };
    }

    return {
      label: "What changed",
      value: mfgDash && hasOpenDowntime ? "Open downtime" : "Live snapshot",
      detail: mfgDash ? (hasOpenDowntime ? t("dashboard.checkAssets") : t("dashboard.operational")) : "Role-based view loaded.",
      icon: Activity,
      tone: "text-primary",
      bg: "bg-primary/10",
    };
  }, [
    hasOpenDowntime,
    mfgDash,
    t,
    tenantSubscription?.displayName,
    tenantSubscription?.status,
    trialDate,
    trialDaysLeft,
  ]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: isSuperAdmin ? "Platform status" : "System health",
        value: isSuperAdmin
          ? hasOpenDowntime
            ? "Open maintenance signal"
            : "No active blockers"
          : systemHealthLabel,
        detail: isSuperAdmin
          ? hasOpenDowntime
            ? "Operations has an active downtime signal that needs review."
            : "Platform services and tenant access are stable."
          : mfgDash
            ? "Manufacturing signal for the last 30 days"
            : "Role-based access and tenant status",
        icon: isSuperAdmin ? (hasOpenDowntime ? AlertTriangle : CheckCircle2) : CheckCircle2,
        tone: isSuperAdmin
          ? hasOpenDowntime
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400"
          : hasOpenDowntime
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400",
        bg: isSuperAdmin
          ? hasOpenDowntime
            ? "bg-amber-500/10"
            : "bg-emerald-500/10"
          : hasOpenDowntime
            ? "bg-amber-500/10"
            : "bg-emerald-500/10",
      },
      {
        label: isSuperAdmin ? "Platform scope" : "Module access",
        value: isSuperAdmin ? "Team-based view" : `${enabledModuleCount}/6`,
        detail: isSuperAdmin
          ? "Role-specific controls loaded for today."
          : disabledModules.length === 0
            ? "All core modules enabled"
            : `${disabledModules.length} restricted`,
        icon: isSuperAdmin ? LayoutDashboard : Factory,
        tone: isSuperAdmin ? "text-primary" : "text-primary",
        bg: "bg-primary/10",
      },
      {
        label: isSuperAdmin ? "Live activity" : "OEE proxy",
        value: isSuperAdmin ? (hasOpenDowntime ? "Downtime active" : "Monitoring") : oeeProxyLabel,
        detail: isSuperAdmin ? "Changes and alerts surfaced first." : "30-day manufacturing signal",
        icon: isSuperAdmin ? Activity : BarChart3,
        tone: isSuperAdmin ? "text-primary" : "text-amber-600 dark:text-amber-400",
        bg: isSuperAdmin ? "bg-primary/10" : "bg-amber-500/10",
      },
    ];
  }, [
    disabledModules.length,
    enabledModuleCount,
    hasOpenDowntime,
    isSuperAdmin,
    mfgDash,
    oeeProxyLabel,
    systemHealthLabel,
  ]);

  const quickLinks = useMemo(
    () => [
      {
        label: "Production",
        href: "/production",
        icon: Factory,
        enabled: can(PERMS.DASHBOARD_MFG),
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: PackageCheck,
        enabled: can(PERMS.DASHBOARD_INVENTORY),
      },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        enabled: can(PERMS.DASHBOARD_VIEW),
      },
    ],
    [can]
  );

  return (
    <div className="relative -m-3 min-h-full space-y-6 overflow-hidden bg-[linear-gradient(180deg,hsl(var(--accent)/0.55),hsl(var(--background))_34rem)] p-3 pb-8 animate-in fade-in duration-500 sm:-m-4 sm:p-4 lg:-m-6 lg:p-6 lg:pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),transparent_42%,hsl(var(--success)/0.10))]" />

      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <section className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_26%)_52%,hsl(180_65%_28%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12))] lg:block" />
            <div className="relative max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                  {isSuperAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />}
                  {isSuperAdmin ? "Platform command center" : "Operations command center"}
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {todayLabel}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-cyan-100">Welcome back, {displayName}</p>
                <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  {t("dashboard.title")}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                  {t("dashboard.subtitle")}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[attentionSummary, changeSummary].map((item) => (
                  <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/[0.09] p-4 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{item.label}</p>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black tracking-tight text-white">{item.value}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-white/68">{item.detail}</p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white/12">
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-[18px] border border-border/70 bg-card/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current role</p>
                <CardTitle className="text-2xl font-black tracking-tight">
                  {isSuperAdmin ? "Super Admin" : user?.role || "User"}
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground">
                  {isSuperAdmin ? "Platform access" : "Tenant workspace"}
                </CardDescription>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="rounded-[14px] border border-border/60 bg-[linear-gradient(135deg,hsl(var(--secondary)/0.58),hsl(var(--background)/0.85))] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next action</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{roleAction.detail}</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <Button asChild className="h-11 w-full rounded-[12px] text-sm font-semibold shadow-sm">
              <Link to={roleAction.href}>
                {roleAction.label}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-[12px] bg-secondary/35 px-4 py-3">
                <span className="font-semibold text-muted-foreground">Operational scope</span>
                <span className="font-black">{isSuperAdmin ? "All tenants" : "Tenant scoped"}</span>
              </div>
              <div className="flex items-center justify-between rounded-[12px] bg-secondary/35 px-4 py-3">
                <span className="font-semibold text-muted-foreground">Modules enabled</span>
                <span className="font-black">{enabledModuleCount}/6</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickLinks
                .filter((item) => item.enabled)
                .map((item) => (
                  <Button
                    key={item.label}
                    asChild
                    variant="outline"
                    className="h-auto flex-col gap-1 rounded-[12px] border-border/70 py-3 text-xs"
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4 text-primary" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <Card key={item.label} className="group overflow-hidden rounded-[16px] border border-border/70 bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
            <div className="h-1 bg-gradient-to-r from-primary/70 via-emerald-400/70 to-amber-400/70 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-foreground">{item.value}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isSuperAdmin && tenantSubscription ? (
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/15 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("dashboard.subscriptionStatus")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={subscriptionBadgeVariant(tenantSubscription.status)} className="px-2.5 py-1">
                    {subscriptionStatusLabel(tenantSubscription.status)}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {tenantSubscription.displayName || t("dashboard.currentTenant")}
                  </span>
                </div>
                {isSuspendedOrArchived && tenantSubscription.statusReason ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
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
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {user?.platformRole !== "super_admin" && disabledModules.length > 0 ? (
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                {t("dashboard.moduleAccess")}
              </span>
              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                {disabledModules.length} {t("dashboard.disabledPolicy")}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {disabledModules.map((mod) => (
                <Badge key={mod.key} variant="outline" className="text-[10px] uppercase tracking-wider">
                  {t(mod.labelKey)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {user?.platformRole === "super_admin" || user?.role === "Admin" ? (
        <Tabs defaultValue="operations" className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[18px] border border-border/60 bg-card/90 p-2 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
            <TabsTrigger
              value="operations"
              className="rounded-[12px] px-4 py-2.5 font-bold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <Activity className="mr-2 h-4 w-4" />
              Operations
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-[12px] px-4 py-2.5 font-bold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Finance
            </TabsTrigger>
            <TabsTrigger
              value="hr"
              className="rounded-[12px] px-4 py-2.5 font-bold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <Users className="mr-2 h-4 w-4" />
              Human Resources
            </TabsTrigger>
            <TabsTrigger
              value="procurement"
              className="rounded-[12px] px-4 py-2.5 font-bold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
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
