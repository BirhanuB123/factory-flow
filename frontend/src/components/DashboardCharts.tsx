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

const BAR_BLUE = "hsl(221, 83%, 53%)";
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
    const label =
      n <= 14
        ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base font-bold text-foreground">{t("charts.assetValue")}</CardTitle>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[150px] rounded-full border-border/60 bg-muted/40 text-xs font-medium">
              <SelectValue placeholder={t("charts.sortByPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("charts.sortMonth")}</SelectItem>
              <SelectItem value="week">{t("charts.sortWeek")}</SelectItem>
              <SelectItem value="day">{t("charts.sortDay")}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
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
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productionSeries} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(228 24% 90%)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(215 16% 46%)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(215 16% 46%)" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(0 0% 100%)",
                        borderColor: "hsl(228 24% 90%)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.08)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      name={t("charts.legendCompleted")}
                      stroke={LINE_PRIMARY}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: LINE_PRIMARY, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="due"
                      name={t("charts.legendScheduled")}
                      stroke={LINE_SECONDARY}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: LINE_SECONDARY, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 border-t border-border/50 pt-3">
                {rangePills.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLineRange(key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      lineRange === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {t(key === "All" ? "charts.range.all" : `charts.range.${key}`)}
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base font-bold text-foreground">{t("charts.stockByCategory")}</CardTitle>
          <Select value={barSortBy} onValueChange={setBarSortBy}>
            <SelectTrigger className="h-9 w-[150px] rounded-full border-border/60 bg-muted/40 text-xs font-medium">
              <SelectValue placeholder={t("charts.sortByPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("charts.sortMonth")}</SelectItem>
              <SelectItem value="week">{t("charts.sortWeek")}</SelectItem>
              <SelectItem value="value">{t("charts.sortValue")}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
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
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryBars} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(228 24% 90%)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(215 16% 46%)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(215 16% 46%)" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(221 91% 97%)" }}
                    contentStyle={{
                      backgroundColor: "hsl(0 0% 100%)",
                      borderColor: "hsl(228 24% 90%)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={48}>
                    {inventoryBars.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={BAR_BLUE}
                        opacity={typeof entry.shade === "number" ? entry.shade : 0.85}
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
