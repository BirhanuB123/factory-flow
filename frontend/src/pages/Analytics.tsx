import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from "recharts";
import { 
  Activity, 
  ArrowUpRight,
  TrendingUp, 
  TrendingDown,
  Package, 
  Zap, 
  DollarSign, 
  Loader2,
  Calendar,
  Download,
  BarChart3,
  Boxes,
  CheckCircle2,
  Gauge,
  LineChart as LineChartIcon,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subDays, startOfDay, endOfDay } from "date-fns";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

export default function Analytics() {
  const { t } = useLocale();
  const [period, setPeriod] = useState("30"); // days

  const dateParams = useMemo(() => {
    if (period === "all") return {};
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, parseInt(period)));
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [period]);

  const { data: oeeData = [], isLoading: oeeLoading } = useQuery({
    queryKey: ['analytics', 'oee', dateParams],
    queryFn: () => analyticsApi.getOee(dateParams),
  });

  const { data: profitData = [], isLoading: profitLoading } = useQuery({
    queryKey: ['analytics', 'profitability', dateParams],
    queryFn: () => analyticsApi.getProfitability(dateParams),
  });

  const { data: turnoverData = [], isLoading: turnoverLoading } = useQuery({
    queryKey: ['analytics', 'inventory-turnover', dateParams],
    queryFn: () => analyticsApi.getInventoryTurnover(dateParams),
  });

  const downloadCsv = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = oeeLoading || profitLoading || turnoverLoading;
  const avgOee = Math.round(oeeData.reduce((acc: number, cur: any) => acc + cur.oee, 0) / (oeeData.length || 1));
  const totalProfit = Math.round(profitData.reduce((acc: number, cur: any) => acc + cur.profit, 0));
  const totalRevenue = Math.round(profitData.reduce((acc: number, cur: any) => acc + cur.revenue, 0));
  const avgTurnover = Math.round(
    turnoverData.reduce((acc: number, cur: any) => acc + cur.turnoverRatio, 0) / (turnoverData.length || 1) * 10
  ) / 10;
  const topMargin = profitData.length
    ? Math.max(...profitData.map((item: any) => Number(item.margin || 0)))
    : 0;
  const slowInventory = turnoverData.filter((item: any) => Number(item.dsi || 0) > 90).length;
  const oeeProgress = Math.min(100, Math.max(8, avgOee));
  const turnoverProgress = Math.min(100, Math.max(8, avgTurnover * 18));

  return (
    <div className="relative -m-3 min-h-full space-y-6 overflow-hidden bg-[linear-gradient(180deg,hsl(var(--accent)/0.5),hsl(var(--background))_32rem)] p-3 pb-10 animate-in fade-in duration-500 sm:-m-4 sm:p-4 lg:-m-6 lg:p-6 lg:pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),transparent_44%,hsl(var(--success)/0.09))]" />

      <div className="relative overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(180_65%_28%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics control room
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-100">Business intelligence made readable</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{t("analytics.title")}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">{t("analytics.subtitle")}</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                {period === "all" ? "All time" : `${period} day window`}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "OEE signal", value: `${avgOee}%`, detail: `${oeeData.length} work centers`, icon: Gauge, tone: "text-primary", bg: "bg-primary/10" },
                { label: "Margin peak", value: `${Math.round(topMargin)}%`, detail: "best product margin", icon: TrendingUp, tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Slow stock", value: String(slowInventory), detail: "items over 90 DSI", icon: Boxes, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/[0.09] p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{item.label}</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-white">{item.value}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/12">
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white/68">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-white/15 bg-white/[0.09] p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Report period</p>
                <p className="mt-1 text-xl font-black tracking-tight text-white">
                  {period === "all" ? "All Time" : `Last ${period} Days`}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white/12 text-white">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="mt-5 h-11 rounded-[12px] border-white/20 bg-white/10 font-bold text-white shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/68">
                  <span>Factory efficiency</span>
                  <span>{avgOee}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-cyan-300" style={{ width: `${oeeProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/68">
                  <span>Inventory velocity</span>
                  <span>{avgTurnover}x</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${turnoverProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          {/* KPI Overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                label: "Avg OEE",
                value: `${avgOee}%`,
                sub: `${oeeData.length} active work centers`,
                icon: Zap,
                helper: Activity,
                tone: "text-indigo-600 dark:text-indigo-400",
                bg: "bg-indigo-500/10",
                border: "border-indigo-500/20",
              },
              {
                label: "Net Profit",
                value: totalProfit.toLocaleString(),
                sub: "Total profit in period",
                icon: DollarSign,
                helper: TrendingUp,
                tone: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
              {
                label: "Avg Turnover",
                value: `${avgTurnover}x`,
                sub: "Velocity of capital",
                icon: Package,
                helper: Sparkles,
                tone: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
              },
            ].map((item) => (
              <Card
                key={item.label}
                className={`group overflow-hidden rounded-[16px] border bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)] ${item.border}`}
              >
                <div className="h-1 bg-gradient-to-r from-primary/70 via-emerald-400/70 to-amber-400/70 opacity-0 transition-opacity group-hover:opacity-100" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className={`text-sm font-black uppercase tracking-widest ${item.tone}`}>{item.label}</p>
                      <h2 className="mt-1 truncate text-3xl font-black tracking-tight">{item.value}</h2>
                    </div>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${item.bg}`}>
                      <item.icon className={`h-6 w-6 ${item.tone}`} />
                    </div>
                  </div>
                  <div className={`mt-4 flex items-center text-xs font-black uppercase ${item.tone}`}>
                    <item.helper className="mr-1 h-3.5 w-3.5" />
                    {item.sub}
                    <ArrowUpRight className="ml-auto h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {[
              { label: "Revenue measured", value: totalRevenue.toLocaleString(), icon: LineChartIcon, tone: "text-primary", bg: "bg-primary/10" },
              { label: "Products ranked", value: String(profitData.length), icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-500/10" },
              { label: "Inventory plotted", value: String(turnoverData.length), icon: Boxes, tone: "text-amber-600", bg: "bg-amber-500/10" },
              { label: "Review signals", value: String(slowInventory), icon: TrendingDown, tone: "text-rose-600", bg: "bg-rose-500/10" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-[16px] border border-border/60 bg-card/95 p-4 shadow-sm">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.tone}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-xl font-black tracking-tight">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* OEE Chart */}
            <Card className="group overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
              <div className="h-1 bg-gradient-to-r from-primary/75 to-cyan-400/70" />
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Factory signal</p>
                  <CardTitle className="mt-1 flex items-center gap-2 text-lg font-black">
                    <Zap className="h-5 w-5 text-indigo-600" />
                    {t("analytics.oee")}
                  </CardTitle>
                  <CardDescription>Efficiency metrics per Work Center</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full opacity-0 transition-opacity group-hover:opacity-100" onClick={() => downloadCsv(oeeData, "oee-analytics.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[350px]">
                {oeeData.length > 0 ? (
                  <div className="h-full rounded-[14px] bg-gradient-to-b from-background/60 to-muted/20 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={oeeData} layout="vertical" margin={{ left: 40, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                      <XAxis type="number" domain={[0, 100]} stroke="#888888" fontSize={10} />
                      <YAxis dataKey="workCenter" type="category" stroke="#888888" fontSize={10} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="oee" name="OEE %" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                      <Bar dataKey="availability" name={t("analytics.availability")} fill="#a5b4fc" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No production data in this period</div>
                )}
              </CardContent>
            </Card>

            {/* Product Profitability */}
            <Card className="group overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
              <div className="h-1 bg-gradient-to-r from-emerald-400/80 to-violet-500/70" />
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commercial signal</p>
                  <CardTitle className="mt-1 flex items-center gap-2 text-lg font-black">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    {t("analytics.profitability")}
                  </CardTitle>
                  <CardDescription>Revenue vs. Net Profit leaderboard</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full opacity-0 transition-opacity group-hover:opacity-100" onClick={() => downloadCsv(profitData, "profitability-analytics.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[350px]">
                {profitData.length > 0 ? (
                  <div className="h-full rounded-[14px] bg-gradient-to-b from-background/60 to-muted/20 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} hide />
                      <YAxis stroke="#888888" fontSize={10} />
                      <Tooltip 
                         contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name={t("analytics.revenue")} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name={t("analytics.profit")} fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No sales data in this period</div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Turnover */}
            <Card className="group overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm lg:col-span-2">
              <div className="h-1 bg-gradient-to-r from-amber-400/80 to-primary/70" />
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory signal</p>
                  <CardTitle className="mt-1 flex items-center gap-2 text-lg font-black">
                    <Package className="h-5 w-5 text-amber-600" />
                    {t("analytics.inventoryTurnover")}
                  </CardTitle>
                  <CardDescription>Stock velocity vs Days Sales in Inventory (DSI)</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full opacity-0 transition-opacity group-hover:opacity-100" onClick={() => downloadCsv(turnoverData, "inventory-velocity.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[400px]">
                {turnoverData.length > 0 ? (
                  <div className="h-full rounded-[14px] bg-gradient-to-b from-background/60 to-muted/20 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" dataKey="turnoverRatio" name="Ratio" unit="x" stroke="#888888" fontSize={10} label={{ value: 'Turnover Ratio', position: 'bottom', fontSize: 10, offset: -5 }} />
                      <YAxis type="number" dataKey="dsi" name="DSI" unit="d" stroke="#888888" fontSize={10} label={{ value: 'Days Sales in Inv', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <ZAxis type="number" dataKey="inventoryValue" range={[50, 600]} name="Value" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                      <Scatter name="Products" data={turnoverData}>
                        {turnoverData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.6} stroke={COLORS[index % COLORS.length]} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No inventory movement data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Analysis Summary Table */}
          <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/25">
               <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Efficiency Ranking</CardTitle>
                  <CardDescription>Top performing work centers and high-margin products</CardDescription>
               </div>
               <Badge variant="outline" className="bg-background/50 font-mono text-[10px]">{period} days window</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Resource / Product</th>
                      <th className="px-6 py-4">Metric</th>
                      <th className="px-6 py-4">Velocity / Quality</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {oeeData.slice(0, 5).map((item: any) => (
                      <tr key={item.workCenter} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                                 <Zap className="h-4 w-4 text-indigo-600" />
                              </div>
                              <span className="font-bold">{item.workCenter}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col">
                              <span className="font-mono text-xs font-bold">OEE {item.oee}%</span>
                              <span className="text-[10px] opacity-50 uppercase tracking-tighter">Machine Efficiency</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${item.oee > 85 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                                style={{ width: `${item.oee}%` }} 
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Badge 
                            variant={item.oee > 80 ? 'outline' : 'secondary'} 
                            className={`text-[10px] uppercase font-black ${item.oee > 80 ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : ''}`}
                          >
                            {item.oee > 80 ? 'Optimal' : 'Review'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {profitData.slice(0, 5).map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                 <TrendingUp className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="font-bold">{item.name}</span>
                                 <span className="text-[10px] opacity-40 font-mono uppercase">{item.sku}</span>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col">
                              <span className="font-mono text-xs font-bold">{item.margin}% Margin</span>
                              <span className="text-[10px] opacity-50 uppercase tracking-tighter">Net Profitability</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-1000" 
                                style={{ width: `${Math.min(100, item.margin * 2.5)}%` }} 
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Badge 
                            variant={item.margin > 25 ? 'outline' : 'secondary'} 
                            className={`text-[10px] uppercase font-black ${item.margin > 25 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}`}
                          >
                            {item.margin > 25 ? 'High Value' : 'Standard'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
