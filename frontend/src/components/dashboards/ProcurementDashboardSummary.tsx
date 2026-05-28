import { useQuery } from "@tanstack/react-query";
import { purchaseOrdersApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Package, Truck } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export function ProcurementDashboardSummary() {
  const { format } = useCurrency();

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersApi.getAll,
  });

  const stats = {
    totalValue: pos.reduce((acc: number, po: any) => {
        // Simple heuristic: lines total in invoice currency
        const lineTotal = (po.lines || []).reduce((s: number, l: any) => s + (l.quantityOrdered * (l.unitCost || 0)), 0);
        return acc + lineTotal;
    }, 0),
    openCount: pos.filter((p: any) => p.status !== "received" && p.status !== "cancelled").length,
    draftCount: pos.filter((p: any) => p.status === "draft").length,
    toReceiveCount: pos.filter((p: any) => ["approved", "partial_received"].includes(p.status)).length,
  };
  const importCount = pos.filter((p: any) => p.supplyType === "import" && p.status !== "received").length;
  const fulfillmentRate = pos.length > 0 ? Math.round((pos.filter((p: any) => p.status === "received").length / pos.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-[0_20px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-primary to-emerald-400" />
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_320px] lg:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              <Truck className="h-3.5 w-3.5" />
              Procurement command center
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Procurement Overview</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                  Purchase commitments, sourcing activity, receipts, and supply chain health in one glance.
                </p>
              </div>
              <Badge
                variant={stats.toReceiveCount > 0 ? "secondary" : "success"}
                className="w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              >
                {stats.toReceiveCount > 0 ? "Receipts pending" : "Receipts clear"}
              </Badge>
            </div>
          </div>

          <div className="rounded-[16px] border border-border/60 bg-background/70 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fulfillment pulse</p>
                <p className="mt-1 text-3xl font-black tracking-tight">{fulfillmentRate}%</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(8, fulfillmentRate))}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[12px] bg-secondary/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Imports</p>
                <p className="mt-1 text-xl font-black text-amber-600">{importCount}</p>
              </div>
              <div className="rounded-[12px] bg-secondary/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Open POs</p>
                <p className="mt-1 text-xl font-black">{stats.openCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Commitment</p>
                <p className="text-xl font-black">{format(stats.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber-500/10 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Draft POs</p>
                <p className="text-xl font-black">{stats.draftCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-emerald-500/10 text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Receipt</p>
                <p className="text-xl font-black">{stats.toReceiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-blue-500/10 text-blue-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active POs</p>
                <p className="text-xl font-black">{stats.openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
          <CardContent className="p-8">
            <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-foreground">Recent Sourcing Activity</h3>
            <div className="space-y-4">
              {pos.slice(0, 5).map((po: any) => (
                <div key={po._id} className="flex items-center justify-between rounded-[12px] border-b border-border/50 px-3 py-3 transition-colors last:border-0 hover:bg-muted/35">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-mono">{po.poNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{po.supplierName}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black uppercase tracking-tighter">{po.status}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{format(po.lines?.reduce((s: number, l: any) => s + (l.quantityOrdered * (l.unitCost || 0)), 0))}</span>
                  </div>
                </div>
              ))}
              {pos.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4">No recent activity detected.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <AlertCircle className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Supply Chain Health</h3>
            </div>
            <div className="space-y-6">
                <div className="rounded-[14px] border border-border/50 bg-background/60 p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Import Status</p>
                    <div className="flex justify-between items-baseline">
                        <p className="text-2xl font-black text-amber-600">{importCount}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Active imports in transit</p>
                    </div>
                </div>
                <div className="rounded-[14px] border border-border/50 bg-background/60 p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fulfillment Rate</p>
                    <div className="flex justify-between items-baseline">
                        <p className="text-2xl font-black text-emerald-600">
                            {fulfillmentRate}%
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">POs fully received</p>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
