import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantModuleFlags } from "@/lib/api";
import { productionApi, inventoryApi } from "@/lib/api";
import { PERMS } from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

const LINE_PRIMARY = "hsl(221, 83%, 53%)";
const LINE_SECONDARY = "hsl(152, 69%, 42%)";

const RANGE_DAYS: Record<string, number | null> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
  All: null,
};

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

function buildProductionTrend(
  jobs: Array<{ status: string; dueDate?: string; updatedAt?: string; createdAt?: string }>,
  days: number
) {
  const rows: { name: string; completion: number; due: number }[] = [];
  const n = Math.min(Math.max(days, 1), 90);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 86400000;
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const completion = jobs.filter((j) => {
      if (j.status !== "Completed") return false;
      const t = new Date(j.updatedAt || j.dueDate || 0).getTime();
      return t >= start && t < end;
    }).length;
    const due = jobs.filter((j) => {
      if (j.status === "Cancelled") return false;
      if (!j.dueDate) return false;
      const t = new Date(j.dueDate).getTime();
      return t >= start && t < end;
    }).length;
    rows.push({ name: label, completion, due });
  }
  return rows;
}

function inventoryWeeklyBars(products: Array<{ category?: string; stock?: number }>) {
  const total = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const byCat = new Map<string, number>();
  for (const p of products) {
    const raw = (p.category || "").trim();
    const cat = raw || "Uncategorized";
    byCat.set(cat, (byCat.get(cat) || 0) + Number(p.stock || 0));
  }
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  if (sorted.length === 0) {
    return [
      { name: "Week 1", value: Math.max(0, Math.round(total * 0.15)), shade: 0.78 },
      { name: "Week 2", value: Math.max(0, Math.round(total * 0.22)), shade: 0.86 },
      { name: "Week 3", value: Math.max(0, Math.round(total * 0.18)), shade: 0.82 },
      { name: "Week 4", value: Math.max(0, Math.round(total * 0.25)), shade: 0.9 },
    ];
  }
  return sorted.map(([name, value], i) => ({
    name: name.length > 10 ? name.slice(0, 9) + "…" : name,
    value,
    shade: 0.75 + (i % 3) * 0.08,
  }));
}

const BAR_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(221, 83%, 60%)",
  "hsl(221, 75%, 67%)",
  "hsl(221, 65%, 72%)",
  "hsl(221, 55%, 76%)",
  "hsl(221, 45%, 80%)",
  "hsl(221, 35%, 84%)",
];

export function DashboardCharts() {
  const { t } = useLocale();
  const { user, can } = useAuth();
  const mfgEnabled = moduleEnabled(user, "manufacturing") && can(PERMS.DASHBOARD_MFG);
  const invEnabled = moduleEnabled(user, "inventory") && can(PERMS.DASHBOARD_INVENTORY);

  const [lineRange, setLineRange] = useState<keyof typeof RANGE_DAYS>("1m");
  const [sortBy, setSortBy] = useState("month");
  const [barSortBy, setBarSortBy] = useState("month");

  const rawDays = RANGE_DAYS[lineRange];
  const days = rawDays == null ? 90 : rawDays;

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
    enabled: mfgEnabled,
  });

  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
    enabled: invEnabled,
  });

  const productionSeries = useMemo(
    () => buildProductionTrend(jobs as { status: string }[], Math.min(days, 60)),
    [jobs, days]
  );

  const inventoryBars = useMemo(
    () => inventoryWeeklyBars(inventory as { category?: string; stock?: number }[]),
    [inventory]
  );

  const rangePills: (keyof typeof RANGE_DAYS)[] = ["1d", "1w", "1m", "3m", "1y", "All"];

  const tooltipStyle = {
    backgroundColor: "hsl(0 0% 100%)",
    borderColor: "hsl(214 32% 91%)",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 500,
    boxShadow: "0 8px 30px -6px rgba(15, 23, 42, 0.1)",
    padding: "8px 12px",
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Production Flow Chart */}
      <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Production flow
            </p>
            <CardTitle className="mt-1 text-base font-bold text-foreground">
              {t("charts.assetValue")}
            </CardTitle>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 w-[130px] rounded-lg border-border/50 bg-muted/30 text-xs font-medium">
              <SelectValue placeholder={t("charts.sortByPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("charts.sortMonth")}</SelectItem>
              <SelectItem value="week">{t("charts.sortWeek")}</SelectItem>
              <SelectItem value="day">{t("charts.sortDay")}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pt-2">
          {!moduleEnabled(user, "manufacturing") ? (
            <div className="flex h-[260px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t("charts.mfgDisabled")}
            </div>
          ) : !can(PERMS.DASHBOARD_MFG) ? (
            <div className="flex h-[260px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t("charts.noPermChart")}
            </div>
          ) : jobsLoading ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : (
            <>
              <div className="h-[250px] w-full rounded-xl bg-muted/15 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productionSeries} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="lineGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={LINE_PRIMARY} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={LINE_PRIMARY} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" strokeOpacity={0.6} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(215 16% 56%)", fontWeight: 500 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(215 16% 56%)", fontWeight: 500 }}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      name={t("charts.legendCompleted")}
                      stroke={LINE_PRIMARY}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="due"
                      name={t("charts.legendScheduled")}
                      stroke={LINE_SECONDARY}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Legend + range pills */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                <div className="flex gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span className="h-0.5 w-4 rounded-full bg-primary" />
                    {t("charts.legendCompleted")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span className="h-0.5 w-4 rounded-full bg-emerald-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(152 69% 42%) 0, hsl(152 69% 42%) 4px, transparent 4px, transparent 7px)' }} />
                    {t("charts.legendScheduled")}
                  </span>
                </div>
                <div className="flex gap-1">
                  {rangePills.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLineRange(key)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        lineRange === key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      {t(key === "All" ? "charts.range.all" : `charts.range.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Inventory Mix Chart */}
      <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Inventory mix
            </p>
            <CardTitle className="mt-1 text-base font-bold text-foreground">
              {t("charts.stockByCategory")}
            </CardTitle>
          </div>
          <Select value={barSortBy} onValueChange={setBarSortBy}>
            <SelectTrigger className="h-8 w-[130px] rounded-lg border-border/50 bg-muted/30 text-xs font-medium">
              <SelectValue placeholder={t("charts.sortByPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("charts.sortMonth")}</SelectItem>
              <SelectItem value="week">{t("charts.sortWeek")}</SelectItem>
              <SelectItem value="value">{t("charts.sortValue")}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pt-2">
          {!moduleEnabled(user, "inventory") ? (
            <div className="flex h-[260px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t("charts.invDisabled")}
            </div>
          ) : !can(PERMS.DASHBOARD_INVENTORY) ? (
            <div className="flex h-[260px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t("charts.noPermChart")}
            </div>
          ) : invLoading ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : inventoryBars.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              {t("charts.noInventory")}
            </div>
          ) : (
            <div className="h-[280px] w-full rounded-xl bg-muted/15 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryBars} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(215 16% 56%)", fontWeight: 500 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(215 16% 56%)", fontWeight: 500 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(221 91% 97%)", radius: 8 }}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={44}>
                    {inventoryBars.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
