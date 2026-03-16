import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, CircleDollarSign, Receipt, Sparkles } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface FinanceMetricsProps {
  stats: {
    revenue: number;
    expenses: number;
    profit: number;
    pending: number;
  };
}

export function FinanceMetrics({ stats }: FinanceMetricsProps) {
  const { symbol } = useCurrency();

  const metrics = [
    {
      title: "Gross Revenue",
      value: `${symbol}${stats.revenue.toLocaleString()}`,
      change: "+12.5%",
      trend: "up",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "Total incoming capital influx"
    },
    {
      title: "Operational Outflux",
      value: `${symbol}${stats.expenses.toLocaleString()}`,
      change: "-4.2%",
      trend: "down",
      icon: TrendingDown,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      description: "Resource & logistics expense"
    },
    {
      title: "Net Net Profit",
      value: `${symbol}${stats.profit.toLocaleString()}`,
      change: "+8.1%",
      trend: "up",
      icon: CircleDollarSign,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      description: "Retained liquid earnings"
    },
    {
      title: "Pending Liquidity",
      value: `${symbol}${stats.pending.toLocaleString()}`,
      change: "Critical",
      trend: "neutral",
      icon: Receipt,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      description: "Unrealized invoice value"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {metrics.map((m, i) => (
        <Card key={i} className="relative overflow-hidden group border-white/5 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/5">
          <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <m.icon className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`h-12 w-12 rounded-2xl ${m.bg} flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500`}>
                <m.icon className={`h-6 w-6 ${m.color}`} />
              </div>
              <div className="flex flex-col items-end">
                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-white/5 border border-white/10 ${m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-rose-500' : 'text-amber-500'}`}>
                  {m.change}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{m.title}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic tracking-tighter text-foreground leading-none">{m.value}</span>
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tight pt-1">{m.description}</p>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
        </Card>
      ))}
    </div>
  );
}
