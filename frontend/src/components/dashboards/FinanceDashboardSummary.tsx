import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FinanceMetrics } from "@/components/FinanceMetrics";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE_URL = `${getApiBaseUrl()}/finance`;

export function FinanceDashboardSummary() {
  const { token } = useAuth();
  const [financeStats, setFinanceStats] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    pending: 0
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/stats`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setFinanceStats({
            revenue: data.data.revenue || 0,
            expenses: data.data.expenses || 0,
            profit: data.data.profit || 0,
            pending: data.data.pending || 0
          });
        }
      })
      .catch((err) => console.error("Failed to fetch finance stats on dashboard", err));
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-[#1a2744]">Finance Overview</h2>
        <p className="text-sm text-muted-foreground">Cashflow, operational expenses, and net profit tracking.</p>
      </div>
      <FinanceMetrics stats={financeStats} />
    </div>
  );
}
