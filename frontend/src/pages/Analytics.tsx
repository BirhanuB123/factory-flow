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
  TrendingUp, 
  Package, 
  Zap, 
  DollarSign, 
  Loader2,
  Calendar,
  Download,
  Filter
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
import { subDays, startOfDay, endOfDay, format } from "date-fns";

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

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
          <p className="text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
        
        <div className="flex items-center gap-2 bg-background border p-1 rounded-xl shadow-erp-sm">
          <div className="flex items-center gap-2 px-3 text-muted-foreground border-r">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest">{t("reports.period")}</span>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 font-bold">
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
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          {/* KPI Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-erp-sm border-none bg-indigo-500/5 backdrop-blur-md hover:bg-indigo-500/10 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-indigo-600/70 uppercase tracking-widest">Avg OEE</p>
                    <h2 className="text-3xl font-black mt-1">
                      {Math.round(oeeData.reduce((acc: number, cur: any) => acc + cur.oee, 0) / (oeeData.length || 1))}%
                    </h2>
                  </div>
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <Zap className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-indigo-600/60 uppercase">
                  <Activity className="h-3 w-3 mr-1" />
                  {oeeData.length} active work centers
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-erp-sm border-none bg-emerald-500/5 backdrop-blur-md hover:bg-emerald-500/10 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-600/70 uppercase tracking-widest">Net Profit</p>
                    <h2 className="text-3xl font-black mt-1">
                      {Math.round(profitData.reduce((acc: number, cur: any) => acc + cur.profit, 0)).toLocaleString()}
                    </h2>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-emerald-600/60 uppercase truncate">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Total profit in period
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-erp-sm border-none bg-amber-500/5 backdrop-blur-md hover:bg-amber-500/10 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-600/70 uppercase tracking-widest">Avg Turnover</p>
                    <h2 className="text-3xl font-black mt-1">
                      {Math.round(turnoverData.reduce((acc: number, cur: any) => acc + cur.turnoverRatio, 0) / (turnoverData.length || 1) * 10) / 10}x
                    </h2>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <Package className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-amber-600/60 uppercase">
                   Velocity of capital
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OEE Chart */}
            <Card className="shadow-erp-lg border-none overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    <Zap className="h-5 w-5 text-indigo-600" />
                    {t("analytics.oee")}
                  </CardTitle>
                  <CardDescription>Efficiency metrics per Work Center</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => downloadCsv(oeeData, "oee-analytics.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[350px]">
                {oeeData.length > 0 ? (
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
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No production data in this period</div>
                )}
              </CardContent>
            </Card>

            {/* Product Profitability */}
            <Card className="shadow-erp-lg border-none overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    {t("analytics.profitability")}
                  </CardTitle>
                  <CardDescription>Revenue vs. Net Profit leaderboard</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => downloadCsv(profitData, "profitability-analytics.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[350px]">
                {profitData.length > 0 ? (
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
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No sales data in this period</div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Turnover */}
            <Card className="shadow-erp-lg border-none overflow-hidden lg:col-span-2 group">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-600" />
                    {t("analytics.inventoryTurnover")}
                  </CardTitle>
                  <CardDescription>Stock velocity vs Days Sales in Inventory (DSI)</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => downloadCsv(turnoverData, "inventory-velocity.csv")}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="h-[400px]">
                {turnoverData.length > 0 ? (
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
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No inventory movement data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Analysis Summary Table */}
          <Card className="shadow-erp-lg border-none overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20">
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
