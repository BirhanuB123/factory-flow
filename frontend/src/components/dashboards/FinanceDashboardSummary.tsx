import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FinanceMetrics } from "@/components/FinanceMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, Clock, Wallet, TrendingUp } from "lucide-react";
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
    const recentRevenue = transactions
      .filter(t => t.type === "Income" && t.status === "Paid")
      .slice(0, 5)
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      pendingCount,
      recentRevenue
    };
  }, [transactions]);

  if (loading && financeStats.revenue === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a2744]">Finance Overview</h2>
        <p className="text-sm font-medium text-muted-foreground">Cashflow, operational expenses, and net profit tracking.</p>
      </div>

      <FinanceMetrics stats={financeStats} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Pending Transactions</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black">{metrics.pendingCount}</p>
                  <p className="text-sm font-medium text-muted-foreground">awaiting action</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 w-[45%]" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Recent Collections</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black">{format(metrics.recentRevenue)}</p>
                  <p className="text-sm font-medium text-muted-foreground">last 5 paid</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[70%]" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
