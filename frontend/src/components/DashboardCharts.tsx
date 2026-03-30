import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantModuleFlags } from "@/lib/api";
import { productionApi, inventoryApi } from "@/lib/api";

const BAR_PALETTE = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"];

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

function buildProductionTrend(
  jobs: Array<{ status: string; dueDate?: string; updatedAt?: string; createdAt?: string }>
) {
  const rows: { name: string; completion: number; due: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 86400000;
    const label = d.toLocaleDateString(undefined, { weekday: "short" });
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

function inventoryByCategory(products: Array<{ category?: string; stock?: number }>) {
  const map = new Map<string, number>();
  for (const p of products) {
    const raw = (p.category || "").trim();
    const cat = raw || "Uncategorized";
    map.set(cat, (map.get(cat) || 0) + Number(p.stock || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value], i) => ({
      name,
      value,
      color: BAR_PALETTE[i % BAR_PALETTE.length],
    }));
}

export function DashboardCharts() {
  const { user } = useAuth();
  const mfgEnabled = moduleEnabled(user, "manufacturing");
  const invEnabled = moduleEnabled(user, "inventory");

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

  const productionSeries = useMemo(() => buildProductionTrend(jobs as { status: string }[]), [jobs]);
  const inventoryBars = useMemo(() => inventoryByCategory(inventory as { category?: string; stock?: number }[]), [inventory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Production Trend
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">Last 7 days · completed vs due</span>
        </CardHeader>
        <CardContent>
          {!mfgEnabled ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              Manufacturing is disabled for this tenant. Enable the module to see production trends.
            </div>
          ) : jobsLoading ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="completion"
                    name="Completed"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorComp)"
                  />
                  <Area
                    type="monotone"
                    dataKey="due"
                    name="Due (open jobs)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Inventory by category
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">Units on hand</span>
        </CardHeader>
        <CardContent>
          {!invEnabled ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              Inventory is disabled for this tenant. Enable the module to see stock distribution.
            </div>
          ) : invLoading ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : inventoryBars.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No inventory yet.</div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryBars} layout="vertical" margin={{ top: 5, right: 30, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={100}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {inventoryBars.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
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
