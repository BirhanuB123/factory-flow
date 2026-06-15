import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KpiCards } from "@/components/KpiCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardFeedsCalendar } from "@/components/DashboardFeedsCalendar";
import { FinanceDashboardSummary } from "@/components/dashboards/FinanceDashboardSummary";
import { HrDashboardSummary } from "@/components/dashboards/HrDashboardSummary";
import { EmployeeDashboardSummary } from "@/components/dashboards/EmployeeDashboardSummary";
import { ProcurementDashboardSummary } from "@/components/dashboards/ProcurementDashboardSummary";
import { useAuth } from "@/contexts/AuthContext";
import { manufacturingApi, productionApi, TENANT_MODULE_KEYS } from "@/lib/api";
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
  Sparkles,
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
  const navigate = useNavigate();
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
    refetchInterval: 60_000,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["manufacturing-assets"],
    queryFn: manufacturingApi.listAssets,
    enabled: mfgDash,
  });

  type DowntimeRow = { endedAt?: string | null; asset?: { code: string; name: string } };
  const typedDowntime = downtime as DowntimeRow[];
  const openDowntimes = useMemo(() => typedDowntime.filter((d) => !d.endedAt), [typedDowntime]);
  const hasOpenDowntime = openDowntimes.length > 0;
  const openCount = openDowntimes.length;
  const firstOpenAsset = openDowntimes[0]?.asset ?? null;
  const assetCount = (assets as unknown[]).length;

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
      { key: "crm" as const, labelKey: "dashboard.moduleCrm" as const },
      { key: "pos" as const, labelKey: "dashboard.modulePos" as const },
      { key: "global_trade" as const, labelKey: "dashboard.moduleGlobalTrade" as const },
      { key: "analytics" as const, labelKey: "dashboard.moduleAnalytics" as const },
    ] as const
  ).filter((m) => moduleFlags?.[m.key as keyof TenantModuleFlags] === false);
  const isSuperAdmin = user?.platformRole === "super_admin";
  const enabledModuleCount = TENANT_MODULE_KEYS.length - disabledModules.length;
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
      return { label: "Open platform admin", href: "/platform", detail: "Manage tenants, audit logs, and global controls." };
    }
    if (user?.role === "finance_head" || user?.role === "finance_viewer") {
      return { label: "Open finance work", href: "/finance", detail: "Review cash, AP/AR, and finance summaries." };
    }
    if (user?.role === "hr_head") {
      return { label: "Open HR work", href: "/hr", detail: "Review headcount, payroll, and employee actions." };
    }
    if (user?.role === "purchasing_head" || user?.role === "warehouse_head") {
      return { label: "Open procurement work", href: "/purchase-orders", detail: "Move on sourcing, receiving, and inventory flow." };
    }
    if (user?.role === "employee") {
      return { label: "Open my HR", href: "/my-hr", detail: "Review personal tasks, attendance, and requests." };
    }
    if (showOpsDashboard) {
      return {
        label: can(PERMS.DASHBOARD_MFG) ? "Open production" : "Open inventory",
        href: can(PERMS.DASHBOARD_MFG) ? "/production" : "/inventory",
        detail: "Jump into the operational summary for today.",
      };
    }
    return { label: "Open profile", href: "/profile", detail: "Review your access and account details." };
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
  }, [hasOpenDowntime, mfgDash, t, tenantSubscription?.displayName, tenantSubscription?.status, trialDate, trialDaysLeft]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: isSuperAdmin ? "Platform status" : "System health",
        value: isSuperAdmin
          ? hasOpenDowntime
            ? `${openCount} open event${openCount !== 1 ? "s" : ""}`
            : "All clear"
          : systemHealthLabel,
        detail: isSuperAdmin
          ? hasOpenDowntime
            ? firstOpenAsset
              ? `${firstOpenAsset.code} — ${firstOpenAsset.name} is currently down`
              : `${openCount} asset${openCount !== 1 ? "s" : ""} need attention`
            : "No active downtime events"
          : mfgDash ? "Manufacturing signal — 30 days" : "Role-based access and tenant status",
        icon: isSuperAdmin ? (hasOpenDowntime ? AlertTriangle : CheckCircle2) : CheckCircle2,
        tone: hasOpenDowntime
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400",
        bg: hasOpenDowntime ? "bg-amber-500/10" : "bg-emerald-500/10",
        accent: hasOpenDowntime
          ? "border-amber-200/60 dark:border-amber-800/40"
          : "border-emerald-200/60 dark:border-emerald-800/40",
        href: hasOpenDowntime && isSuperAdmin ? "/maintenance" : undefined,
      },
      {
        label: isSuperAdmin ? "Assets tracked" : "Module access",
        value: isSuperAdmin
          ? assetCount > 0 ? `${assetCount} asset${assetCount !== 1 ? "s" : ""}` : "No assets"
          : `${enabledModuleCount}/${TENANT_MODULE_KEYS.length}`,
        detail: isSuperAdmin
          ? openCount > 0
            ? `${openCount} downtime event${openCount !== 1 ? "s" : ""} currently open`
            : "All assets operational"
          : disabledModules.length === 0 ? "All core modules enabled" : `${disabledModules.length} restricted`,
        icon: isSuperAdmin ? LayoutDashboard : Factory,
        tone: isSuperAdmin && openCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-primary",
        bg: isSuperAdmin && openCount > 0 ? "bg-amber-500/10" : "bg-primary/10",
        accent: "border-blue-200/60 dark:border-blue-800/40",
        href: isSuperAdmin ? "/maintenance" : undefined,
      },
      {
        label: isSuperAdmin ? "Downtime" : "OEE proxy",
        value: isSuperAdmin
          ? hasOpenDowntime ? `${openCount} active` : "None active"
          : oeeProxyLabel,
        detail: isSuperAdmin
          ? hasOpenDowntime
            ? openDowntimes
                .slice(0, 2)
                .map((d) => d.asset?.code ?? "Unknown")
                .join(", ") + (openCount > 2 ? ` +${openCount - 2} more` : "")
            : "No unplanned stoppages"
          : "30-day manufacturing signal",
        icon: isSuperAdmin ? (hasOpenDowntime ? AlertTriangle : Activity) : BarChart3,
        tone: isSuperAdmin && hasOpenDowntime
          ? "text-amber-600 dark:text-amber-400"
          : isSuperAdmin
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
        bg: isSuperAdmin && hasOpenDowntime ? "bg-amber-500/10" : isSuperAdmin ? "bg-emerald-500/10" : "bg-amber-500/10",
        accent: isSuperAdmin && hasOpenDowntime
          ? "border-amber-200/60 dark:border-amber-800/40"
          : "border-blue-200/60 dark:border-blue-800/40",
        href: isSuperAdmin ? "/maintenance" : undefined,
      },
    ];
  }, [assetCount, disabledModules.length, enabledModuleCount, firstOpenAsset, hasOpenDowntime, isSuperAdmin, mfgDash, openCount, openDowntimes, oeeProxyLabel, systemHealthLabel]);

  const quickLinks = useMemo(
    () => [
      { label: "Production", href: "/production", icon: Factory, enabled: can(PERMS.DASHBOARD_MFG) },
      { label: "Inventory", href: "/inventory", icon: PackageCheck, enabled: can(PERMS.DASHBOARD_INVENTORY) },
      { label: "Reports", href: "/reports", icon: BarChart3, enabled: can(PERMS.DASHBOARD_VIEW) },
    ],
    [can]
  );

  return (
    <div className="relative min-h-full animate-in fade-in duration-500">
      {/* Subtle ambient background */}
      <div className="pointer-events-none absolute inset-0 -m-3 sm:-m-4 lg:-m-6">
        <div className="absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-primary/[0.04] via-primary/[0.02] to-transparent" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute left-0 top-32 h-64 w-64 rounded-full bg-emerald-500/[0.03] blur-3xl" />
      </div>

      <div className="relative space-y-8 pb-8 lg:pb-10">
        {/* ──────── Hero Section ──────── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Main welcome card */}
          <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Decorative mesh */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-emerald-500/15 blur-3xl" />
              <div className="absolute right-1/4 top-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
            </div>
            <div className="relative p-6 sm:p-8">
              <div className="max-w-3xl space-y-6">
                {/* Top badges */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                    {isSuperAdmin ? <ShieldCheck className="h-3.5 w-3.5 text-blue-300" /> : <Gauge className="h-3.5 w-3.5 text-cyan-300" />}
                    {isSuperAdmin ? "Platform command center" : "Operations command center"}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white/60">
                    <Sparkles className="h-3 w-3" />
                    {todayLabel}
                  </span>
                </div>

                {/* Greeting */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-cyan-200/80">Welcome back, {displayName}</p>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                    {t("dashboard.title")}
                  </h1>
                  <p className="max-w-xl text-[15px] leading-relaxed text-white/50">
                    {t("dashboard.subtitle")}
                  </p>
                </div>

                {/* Status cards inside hero */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[attentionSummary, changeSummary].map((item) => (
                    <div
                      key={item.label}
                      className="group rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.09]"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        {item.label}
                      </p>
                      <div className="mt-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold tracking-tight text-white">{item.value}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-white/50">{item.detail}</p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
                          <item.icon className="h-[18px] w-[18px] text-white/70" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Sidebar card: role + quick links */}
          <div className="flex flex-col gap-4">
            <Card className="flex-1 rounded-2xl border-border/50 bg-card shadow-sm">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Current role
                    </p>
                    <CardTitle className="text-xl font-bold tracking-tight">
                      {isSuperAdmin ? "Super Admin" : user?.role || "User"}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {isSuperAdmin ? "Platform access" : "Tenant workspace"}
                    </CardDescription>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                {/* Next action */}
                <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Next action
                  </p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                    {roleAction.detail}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <Button asChild className="h-10 w-full rounded-xl text-sm font-semibold">
                  <Link to={roleAction.href}>
                    {roleAction.label}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-xl bg-muted/25 px-3.5 py-2.5">
                    <span className="font-medium text-muted-foreground">Operational scope</span>
                    <span className="font-bold">{isSuperAdmin ? "All tenants" : "Tenant scoped"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/25 px-3.5 py-2.5">
                    <span className="font-medium text-muted-foreground">Modules enabled</span>
                    <span className="font-bold">{enabledModuleCount}/{TENANT_MODULE_KEYS.length}</span>
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-3 gap-2">
                  {quickLinks
                    .filter((item) => item.enabled)
                    .map((item) => (
                      <Button
                        key={item.label}
                        asChild
                        variant="outline"
                        className="h-auto flex-col gap-1.5 rounded-xl border-border/50 py-3 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary/5"
                      >
                        <Link to={item.href}>
                          <item.icon className="h-4 w-4 text-primary/70" />
                          {item.label}
                        </Link>
                      </Button>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ──────── Summary metric cards ──────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          {summaryCards.map((item) => (
            <Card
              key={item.label}
              className={`group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.accent} ${item.href ? "cursor-pointer" : ""}`}
              onClick={item.href ? () => navigate(item.href!) : undefined}
            >
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-xl font-bold tracking-tight text-foreground">{item.value}</p>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">{item.detail}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className={`h-[18px] w-[18px] ${item.tone}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ──────── Subscription banner ──────── */}
        {!isSuperAdmin && tenantSubscription ? (
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardContent className="py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("dashboard.subscriptionStatus")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={subscriptionBadgeVariant(tenantSubscription.status)} className="px-2.5 py-0.5 text-xs">
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

                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <span className="text-muted-foreground">{t("dashboard.plan")}</span>
                    <span className="font-bold uppercase tracking-wide text-foreground">
                      {tenantSubscription.plan || "starter"}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("dashboard.trialEnds")}</span>
                    <span className="font-bold text-foreground">
                      {trialDate ? trialDate.toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ──────── Disabled modules banner ──────── */}
        {user?.platformRole !== "super_admin" && disabledModules.length > 0 ? (
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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

        {/* ──────── Main tabbed content ──────── */}
        {user?.platformRole === "super_admin" || user?.role === "Admin" ? (
          <Tabs defaultValue="operations" className="space-y-6">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-sm">
              <TabsTrigger
                value="operations"
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Activity className="mr-2 h-4 w-4" />
                Operations
              </TabsTrigger>
              <TabsTrigger
                value="finance"
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger
                value="hr"
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="mr-2 h-4 w-4" />
                Human Resources
              </TabsTrigger>
              <TabsTrigger
                value="procurement"
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
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
    </div>
  );
};

export default Index;
