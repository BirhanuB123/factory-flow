import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Receipt, TrendingDown, TrendingUp } from "lucide-react";
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
  const { format } = useCurrency();

  const metrics = [
    {
      label: "Revenue",
      value: format(stats.revenue ?? 0),
      sub: "Recorded inflows",
      icon: TrendingUp,
      delta: "+ inflow",
      trendIcon: ArrowUpRight,
      accent: "from-emerald-500/18 to-teal-500/5",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Expenses",
      value: format(stats.expenses ?? 0),
      sub: "Operational outflows",
      icon: TrendingDown,
      delta: "- outflow",
      trendIcon: ArrowDownRight,
      accent: "from-rose-500/16 to-orange-500/5",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      label: "Net position",
      value: format(stats.profit ?? 0),
      sub: "Revenue minus expenses",
      icon: CircleDollarSign,
      delta: (stats.profit ?? 0) >= 0 ? "healthy" : "watch",
      trendIcon: (stats.profit ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight,
      accent: (stats.profit ?? 0) >= 0 ? "from-blue-500/18 to-cyan-500/5" : "from-rose-500/16 to-orange-500/5",
      color: (stats.profit ?? 0) >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400",
      bg: (stats.profit ?? 0) >= 0 ? "bg-primary/10" : "bg-rose-500/10",
      border: (stats.profit ?? 0) >= 0 ? "border-primary/20" : "border-rose-500/20",
    },
    {
      label: "Pending",
      value: format(stats.pending ?? 0),
      sub: "Unsettled / open",
      icon: Receipt,
      delta: "needs review",
      trendIcon: ArrowUpRight,
      accent: "from-amber-500/18 to-yellow-500/5",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m, i) => (
        <Card
          key={i}
          className={`group relative overflow-hidden rounded-2xl border bg-card shadow-erp-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-erp ${m.border}`}
        >
          <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${m.accent}`} />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.bg}`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div className={`inline-flex items-center gap-1 rounded-full ${m.bg} px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${m.color}`}>
                <m.trendIcon className="h-3 w-3" />
                {m.delta}
              </div>
            </div>
            <div className="mt-5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p className="mt-1 truncate text-2xl font-black tracking-tight">{m.value}</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{m.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
