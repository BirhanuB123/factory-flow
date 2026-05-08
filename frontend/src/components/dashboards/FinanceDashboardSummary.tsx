import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Gauge,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = `${getApiBaseUrl()}/finance`;

export function FinanceDashboardSummary() {
  const { token } = useAuth();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [financeStats, setFinanceStats] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    pending: 0
  });
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE_URL}/stats`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      }).then(res => res.json()),
      fetch(`${API_BASE_URL}/transactions`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      }).then(res => res.json())
    ])
      .then(([statsData, transData]) => {
        if (statsData.success) {
          setFinanceStats({
            revenue: statsData.data.revenue || 0,
            expenses: statsData.data.expenses || 0,
            profit: statsData.data.profit || 0,
            pending: statsData.data.pending || 0
          });
        }
        setTransactions(Array.isArray(transData) ? transData : []);
      })
      .catch((err) => console.error("Failed to fetch finance summary", err))
      .finally(() => setLoading(false));
  }, [token]);

  const metrics = useMemo(() => {
    const pendingCount = transactions.filter(t => t.status === "Pending").length;
    const overdueCount = transactions.filter(t => t.status === "Overdue").length;
    const settledCount = transactions.filter(t => t.status === "Paid" || t.status === "Posted").length;
    const totalCount = transactions.length || 1;
    const recentRevenue = transactions
      .filter(t => t.type === "Income" && t.status === "Paid")
      .slice(0, 5)
      .reduce((acc, t) => acc + t.amount, 0);
    const collectionRate = Math.round((settledCount / totalCount) * 100);
    const expenseRatio = financeStats.revenue > 0 ? Math.round((financeStats.expenses / financeStats.revenue) * 100) : 0;
    const pendingPressure = Math.min(100, Math.max(8, pendingCount * 12));
    const collectionProgress = Math.min(100, Math.max(8, collectionRate || 0));
    const marginHealth = financeStats.revenue > 0 ? Math.round((financeStats.profit / financeStats.revenue) * 100) : 0;

    return {
      pendingCount,
      overdueCount,
      recentRevenue,
      collectionRate,
      expenseRatio,
      pendingPressure,
      collectionProgress,
      marginHealth
    };
  }, [financeStats.expenses, financeStats.profit, financeStats.revenue, transactions]);

  if (loading && financeStats.revenue === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-card shadow-erp">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_88%_0%,hsl(var(--erp-emerald)/0.18),transparent_28%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)/0.58))]" />
        <div className="absolute -bottom-12 right-8 h-32 w-32 rounded-full border border-primary/15" />
        <div className="absolute -bottom-20 right-24 h-44 w-44 rounded-full border border-emerald-500/15" />
        <div className="relative grid gap-5 p-6 lg:grid-cols-[1fr_340px] lg:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              <WalletCards className="h-3.5 w-3.5" />
              Finance command center
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Finance Overview</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                  Cashflow, expenses, open balances, and collection momentum in one glance.
                </p>
              </div>
              <Badge
                variant={(financeStats.profit ?? 0) >= 0 ? "success" : "destructive"}
                className="w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              >
                {(financeStats.profit ?? 0) >= 0 ? "Healthy margin" : "Margin review"}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Revenue",
                  value: format(financeStats.revenue ?? 0),
                  sub: "Recorded inflows",
                  icon: TrendingUp,
                  tone: "text-emerald-600 dark:text-emerald-400",
                  bg: "bg-emerald-500/10",
                  border: "border-emerald-500/25",
                  chip: "+ Inflow",
                },
                {
                  label: "Expenses",
                  value: format(financeStats.expenses ?? 0),
                  sub: "Operational outflows",
                  icon: TrendingDown,
                  tone: "text-rose-600 dark:text-rose-400",
                  bg: "bg-rose-500/10",
                  border: "border-rose-500/25",
                  chip: "- Outflow",
                },
                {
                  label: "Net position",
                  value: format(financeStats.profit ?? 0),
                  sub: `${metrics.marginHealth}% margin signal`,
                  icon: Banknote,
                  tone: (financeStats.profit ?? 0) >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400",
                  bg: (financeStats.profit ?? 0) >= 0 ? "bg-primary/10" : "bg-rose-500/10",
                  border: (financeStats.profit ?? 0) >= 0 ? "border-primary/25" : "border-rose-500/25",
                  chip: (financeStats.profit ?? 0) >= 0 ? "Healthy" : "Watch",
                },
                {
                  label: "Pending",
                  value: format(financeStats.pending ?? 0),
                  sub: "Unsettled / open",
                  icon: Receipt,
                  tone: "text-amber-600 dark:text-amber-400",
                  bg: "bg-amber-500/10",
                  border: "border-amber-500/25",
                  chip: "Needs review",
                },
              ].map((item) => (
                <Card
                  key={item.label}
                  className={`group overflow-hidden rounded-2xl border bg-background/78 shadow-erp-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-erp ${item.border}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                        <item.icon className={`h-5 w-5 ${item.tone}`} />
                      </div>
                      <span className={`rounded-full ${item.bg} px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${item.tone}`}>
                        {item.chip}
                      </span>
                    </div>
                    <div className="mt-5 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                      <p className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">{item.value}</p>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{item.sub}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/76 p-5 shadow-erp-sm backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Collection pulse</p>
                <p className="mt-1 text-3xl font-black tracking-tight">{metrics.collectionRate}%</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Gauge className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>Settled activity</span>
                  <span>{metrics.collectionRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${metrics.collectionProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>Expense ratio</span>
                  <span>{metrics.expenseRatio}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(8, metrics.expenseRatio))}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/45 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overdue</p>
                <p className="mt-1 text-xl font-black text-rose-600">{metrics.overdueCount}</p>
              </div>
              <div className="rounded-xl bg-secondary/45 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last 5 paid</p>
                <p className="mt-1 truncate text-xl font-black">{format(metrics.recentRevenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border border-amber-500/20 bg-card shadow-erp-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Pending Transactions</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black">{metrics.pendingCount}</p>
                    <p className="text-sm font-semibold text-muted-foreground">awaiting action</p>
                  </div>
                </div>
              </div>
              <AlertCircle className="hidden h-5 w-5 text-amber-600 sm:block" />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${metrics.pendingPressure}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-card shadow-erp-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowUpRight className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Recent Collections</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black">{format(metrics.recentRevenue)}</p>
                    <p className="text-sm font-semibold text-muted-foreground">last 5 paid</p>
                  </div>
                </div>
              </div>
              <CheckCircle2 className="hidden h-5 w-5 text-emerald-600 sm:block" />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metrics.collectionProgress}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Collections", value: `${metrics.collectionRate}%`, detail: "settled ledger activity", icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Expense control", value: `${metrics.expenseRatio}%`, detail: "expenses against revenue", icon: ArrowDownRight, tone: "text-amber-600", bg: "bg-amber-500/10" },
          { label: "Review queue", value: String(metrics.pendingCount + metrics.overdueCount), detail: "pending and overdue items", icon: Sparkles, tone: "text-primary", bg: "bg-primary/10" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-erp-sm">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.tone}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-xl font-black tracking-tight">{item.value}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
