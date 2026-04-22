import { useQuery } from "@tanstack/react-query";
import { purchaseOrdersApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Clock, Package, AlertCircle } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLocale } from "@/contexts/LocaleContext";

export function ProcurementDashboardSummary() {
  const { t } = useLocale();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-[#1a2744]">Procurement Overview</h2>
        <p className="text-sm font-medium text-muted-foreground">Monitoring purchase orders, sourcing activities, and incoming supplies.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Committment</p>
                <p className="text-xl font-black">{format(stats.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Draft POs</p>
                <p className="text-xl font-black">{stats.draftCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Receipt</p>
                <p className="text-xl font-black">{stats.toReceiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active POs</p>
                <p className="text-xl font-black">{stats.openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden">
          <CardContent className="p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#1a2744] mb-6">Recent Sourcing Activity</h3>
            <div className="space-y-4">
              {pos.slice(0, 5).map((po: any) => (
                <div key={po._id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
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

        <Card className="rounded-2xl border-0 bg-card shadow-erp overflow-hidden bg-gradient-to-br from-primary/[0.02] to-transparent">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <AlertCircle className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#1a2744]">Supply Chain Health</h3>
            </div>
            <div className="space-y-6">
                <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Import Status</p>
                    <div className="flex justify-between items-baseline">
                        <p className="text-2xl font-black text-amber-600">{pos.filter((p: any) => p.supplyType === 'import' && p.status !== 'received').length}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Active imports in transit</p>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Fulfillment Rate</p>
                    <div className="flex justify-between items-baseline">
                        <p className="text-2xl font-black text-emerald-600">
                            {pos.length > 0 ? Math.round((pos.filter((p: any) => p.status === 'received').length / pos.length) * 100) : 0}%
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
