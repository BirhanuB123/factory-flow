import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarRange,
  Download,
  Factory,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/use-settings";
import api, { reportsApi, type ReportPeriod, type TenantModuleFlags } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

type KpiCard = {
  title: string;
  value: string;
  icon: typeof ShoppingCart;
  className?: string;
};

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  ETB: "Br",
};

function formatMoney(amount: number, currencyCode: string): string {
  const sym = currencySymbols[currencyCode] || `${currencyCode} `;
  if (!Number.isFinite(amount)) return `${sym}0`;
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

function salesEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.sales !== false;
}

const PERIOD_META: Record<ReportPeriod, { label: string; hint: string }> = {
  daily: { label: "Daily", hint: "Last 30 days (by calendar day in your company timezone)" },
  weekly: { label: "Weekly", hint: "Up to 12 ISO weeks with activity (company timezone)" },
  monthly: { label: "Monthly", hint: "Last 12 months" },
  yearly: { label: "Yearly", hint: "Last 5 calendar years" },
};

async function downloadReportCsv(urlPath: string, fileName: string) {
  const res = await api.get(urlPath, { responseType: "blob" });
  const blob = res.data as Blob;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(href);
}

export default function Reports() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency?.trim() || "USD";
  const [period, setPeriod] = useState<ReportPeriod>("monthly");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reports-summary", period],
    queryFn: () => reportsApi.getSummary(period),
  });

  const showSalesKpis = data != null ? data.sales : salesEnabled(user);
  const chartData = useMemo(() => data?.series ?? [], [data?.series]);

  const kpiSections = useMemo(() => {
    if (!data) return { period: [] as KpiCard[], lifetime: [] as KpiCard[] };
    const k = data.kpis;
    const L = data.kpisLifetime;
    const periodCards: KpiCard[] = [];

    if (data.sales) {
      periodCards.push(
        { title: "Orders (this range)", value: String(k.ordersCount), icon: ShoppingCart },
        {
          title: "Order revenue (this range)",
          value: formatMoney(k.ordersRevenue, currency),
          icon: BarChart3,
          className: "text-[hsl(221,83%,53%)]",
        },
        { title: "New clients (this range)", value: String(k.newClients), icon: Users }
      );
    }

    if (data.finance) {
      periodCards.push(
        {
          title: "Paid invoices (this range)",
          value: formatMoney(k.paidRevenue ?? 0, currency),
          icon: BarChart3,
          className: "text-[hsl(152,69%,42%)]",
        },
        {
          title: "Expenses + payroll (this range)",
          value: formatMoney(k.expensesTotal ?? 0, currency),
          icon: CalendarRange,
        },
        {
          title: "Profit (this range)",
          value: formatMoney(k.profit ?? 0, currency),
          icon: BarChart3,
          className: (k.profit ?? 0) >= 0 ? "text-[hsl(152,69%,42%)]" : "text-destructive",
        },
        { title: "Open AR invoices", value: String(k.pendingInvoicesCount ?? 0), icon: CalendarRange }
      );
    }

    if (data.manufacturing) {
      periodCards.push(
        { title: "Jobs created", value: String(k.jobsCreated), icon: Factory },
        { title: "Jobs completed", value: String(k.jobsCompleted), icon: Factory, className: "text-[hsl(32,95%,45%)]" }
      );
    }

    if (data.procurement) {
      periodCards.push(
        { title: "POs raised", value: String(k.poCount), icon: Truck },
        {
          title: "PO line value (est.)",
          value: formatMoney(k.poValue, currency),
          icon: Truck,
          className: "text-muted-foreground",
        }
      );
    }

    if (data.shipments) {
      periodCards.push({
        title: "Shipments completed",
        value: String(k.shipmentsShipped),
        icon: Truck,
        className: "text-[hsl(221,83%,53%)]",
      });
    }

    if (data.inventory) {
      periodCards.push(
        { title: "Active SKUs", value: String(k.inventorySkus), icon: Package },
        { title: "Stock on hand (units)", value: String(k.inventoryUnits), icon: Package },
        {
          title: "Inventory value (est.)",
          value: formatMoney(k.inventoryValue, currency),
          icon: Package,
          className: "text-[hsl(152,69%,42%)]",
        }
      );
    }

    const lifetimeCards: KpiCard[] = [];
    if (data.sales) {
      lifetimeCards.push(
        { title: "All-time orders", value: String(L.totalOrders), icon: ShoppingCart },
        { title: "All-time clients", value: String(L.totalClients), icon: Users }
      );
    }
    if (data.inventory) {
      lifetimeCards.push({ title: "All-time products", value: String(L.totalProducts), icon: Package });
    }

    return { period: periodCards, lifetime: lifetimeCards };
  }, [data, currency]);

  const errMsg =
    error && typeof error === "object" && "response" in error
      ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || "")
      : "";

  const onExport = async (path: string, file: string) => {
    try {
      await downloadReportCsv(path, file);
      toast.success("Download started");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(status === 403 ? "You do not have access to this export." : "Export failed. Try again.");
    }
  };

  return (
    <ModuleDashboardLayout
      title={t("pages.reports.title")}
      description={t("pages.reports.subtitle")}
      icon={BarChart3}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <Download className="h-4 w-4" />
              {t("pages.reports.exportCsv")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onExport("/reports/export/orders", "orders.csv")}>
              Orders
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("/reports/export/inventory", "inventory.csv")}>
              Inventory
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("/reports/export/production", "production.csv")}>
              Production jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("/reports/export/ar", "ar.csv")}>AR</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("/reports/export/ap", "ap.csv")}>AP</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{PERIOD_META[period].hint}</p>
          {data?.window && (
            <p className="mt-1 text-xs text-muted-foreground/80">
              <span className="font-mono">
                {new Date(data.window.start).toLocaleString()} — {new Date(data.window.end).toLocaleString()}
              </span>
              {data.timezone ? (
                <span className="ml-2 text-muted-foreground">· {data.timezone}</span>
              ) : null}
            </p>
          )}
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => {
            if (v) setPeriod(v as ReportPeriod);
          }}
          className="justify-start rounded-xl border border-border/60 bg-muted/30 p-1"
        >
          {(Object.keys(PERIOD_META) as ReportPeriod[]).map((p) => (
            <ToggleGroupItem
              key={p}
              value={p}
              aria-label={PERIOD_META[p].label}
              className="rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              {PERIOD_META[p].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Could not load reports</CardTitle>
            <CardDescription>
              {errMsg || "Check your connection and try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {kpiSections.lifetime.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Lifetime totals</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : kpiSections.lifetime.map((c) => (
                  <Card key={c.title} className="rounded-2xl border-border/60 bg-muted/20 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                      <c.icon className={cn("h-4 w-4 text-muted-foreground", c.className)} aria-hidden />
                    </CardHeader>
                    <CardContent>
                      <p className={cn("text-xl font-bold tracking-tight", c.className)}>{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          This period ({PERIOD_META[period].label.toLowerCase()})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
            : kpiSections.period.length > 0
              ? kpiSections.period.map((c) => (
                  <Card key={c.title} className="rounded-2xl border-border/60 shadow-erp-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                      <c.icon className={cn("h-4 w-4 text-muted-foreground", c.className)} aria-hidden />
                    </CardHeader>
                    <CardContent>
                      <p className={cn("text-2xl font-bold tracking-tight", c.className)}>{c.value}</p>
                    </CardContent>
                  </Card>
                ))
              : data && (
                  <Card className="rounded-2xl border-dashed border-border/60 sm:col-span-2 lg:col-span-4">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No KPIs for your access or disabled modules. Enable sales, finance, manufacturing, procurement, or
                      inventory for this company.
                    </CardContent>
                  </Card>
                )}
        </div>
      </div>

      {!showSalesKpis && !isLoading && data && (
        <p className="text-sm text-muted-foreground">
          Sales module is off for this company — other metrics may still show if those modules are enabled.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-1">
        <Card className="rounded-2xl border-border/60 shadow-erp-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sales &amp; revenue</CardTitle>
            <CardDescription>Order value and order count from your sales data.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] w-full min-w-0 pt-2">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : !data?.sales ? (
              <p className="text-sm text-muted-foreground">Sales module disabled.</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {period === "weekly"
                  ? "No activity in the last ~14 weeks — add orders or switch to Monthly."
                  : "No data points in this range."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: period === "daily" ? 28 : 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={period === "daily" ? 4 : 0}
                    angle={period === "daily" ? -35 : 0}
                    textAnchor={period === "daily" ? "end" : "middle"}
                    height={period === "daily" ? 52 : 28}
                  />
                  <YAxis
                    yAxisId="money"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                    width={44}
                  />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === "Orders") return [value, name];
                      return [formatMoney(value, currency), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="money"
                    dataKey="ordersRevenue"
                    name="Order revenue"
                    fill="hsl(221, 83%, 53%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="ordersCount"
                    name="Orders"
                    stroke="hsl(32, 95%, 45%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {(data?.finance || isLoading) && (
          <Card className="rounded-2xl border-border/60 shadow-erp-sm">
            <CardHeader>
              <CardTitle className="text-lg">Finance</CardTitle>
              <CardDescription>Paid invoice revenue and expenses (including payroll journals) per bucket.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] w-full min-w-0 pt-2">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : !data?.finance ? (
                <p className="text-sm text-muted-foreground">No finance access or module disabled.</p>
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No finance activity in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: period === "daily" ? 28 : 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={period === "daily" ? 4 : 0}
                      angle={period === "daily" ? -35 : 0}
                      textAnchor={period === "daily" ? "end" : "middle"}
                      height={period === "daily" ? 52 : 28}
                    />
                    <YAxis
                      yAxisId="money"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number, name: string) => [formatMoney(value, currency), name]}
                    />
                    <Legend />
                    <Bar
                      yAxisId="money"
                      dataKey="paidRevenue"
                      name="Paid invoices"
                      fill="hsl(152, 69%, 42%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Line
                      yAxisId="money"
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="hsl(262, 83%, 58%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {(data?.manufacturing || data?.procurement || data?.shipments || isLoading) && (
          <Card className="rounded-2xl border-border/60 shadow-erp-sm">
            <CardHeader>
              <CardTitle className="text-lg">Operations</CardTitle>
              <CardDescription>Production jobs, purchase orders, and shipments over time.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] w-full min-w-0 pt-2">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : !data?.manufacturing && !data?.procurement && !data?.shipments ? (
                <p className="text-sm text-muted-foreground">No operations access for your role or modules off.</p>
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operations data in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: period === "daily" ? 28 : 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={period === "daily" ? 4 : 0}
                      angle={period === "daily" ? -35 : 0}
                      textAnchor={period === "daily" ? "end" : "middle"}
                      height={period === "daily" ? 52 : 28}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={36} />
                    <YAxis
                      yAxisId="money"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      width={40}
                      tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number, name: string) => {
                        if (name === "PO value") return [formatMoney(value, currency), name];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    {data.manufacturing ? (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="jobsCreated"
                        name="Jobs created"
                        stroke="hsl(221, 83%, 53%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    ) : null}
                    {data.manufacturing ? (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="jobsCompleted"
                        name="Jobs completed"
                        stroke="hsl(32, 95%, 45%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    ) : null}
                    {data.procurement ? (
                      <Bar
                        yAxisId="left"
                        dataKey="poCount"
                        name="PO count"
                        fill="hsl(152, 69%, 42%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      />
                    ) : null}
                    {data.procurement ? (
                      <Line
                        yAxisId="money"
                        type="monotone"
                        dataKey="poValue"
                        name="PO value"
                        stroke="hsl(262, 83%, 58%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    ) : null}
                    {data.shipments ? (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="shipmentsShipped"
                        name="Shipments"
                        stroke="hsl(200, 85%, 45%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

    </ModuleDashboardLayout>
  );
}
