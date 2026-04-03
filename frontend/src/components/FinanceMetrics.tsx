import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, CircleDollarSign, Receipt } from "lucide-react";
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
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Expenses",
      value: format(stats.expenses ?? 0),
      sub: "Operational outflows",
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Net position",
      value: format(stats.profit ?? 0),
      sub: "Revenue − expenses",
      icon: CircleDollarSign,
      color: (stats.profit ?? 0) >= 0 ? "text-primary" : "text-destructive",
      bg: (stats.profit ?? 0) >= 0 ? "bg-primary/10" : "bg-destructive/10",
    },
    {
      label: "Pending",
      value: format(stats.pending ?? 0),
      sub: "Unsettled / open",
      icon: Receipt,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m, i) => (
        <Card
          key={i}
          className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${m.bg}`} />
          <CardContent className="flex items-center gap-4 p-5">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.bg} transition-transform duration-300 group-hover:scale-110`}
            >
              <m.icon className={`h-6 w-6 ${m.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p className="truncate text-2xl font-bold tracking-tight">{m.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{m.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
