import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";
import { PackageOpen, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function InventoryAgingTab() {
  const { symbol } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-aging'],
    queryFn: () => inventoryApi.getAging(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 font-medium">Loading aging data...</p>
      </div>
    );
  }

  const buckets = data?.buckets || { days0_30: [], days31_90: [], days91_180: [], days180plus: [] };
  const totals = data?.totals || { days0_30: 0, days31_90: 0, days91_180: 0, days180plus: 0, totalInventoryValue: 0 };

  const summaryCards = [
    { label: "0-30 Days", value: totals.days0_30, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "31-90 Days", value: totals.days31_90, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "91-180 Days", value: totals.days91_180, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "180+ Days (Obsolete)", value: totals.days180plus, color: "text-rose-600", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aging analysis</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-foreground">Inventory Aging</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identify slow-moving stock based on receipt date. Optimization candidate items are highlighted in red.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-[14px] border border-border/60 bg-card px-5 py-2.5 shadow-sm">
          <PackageOpen className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Stock Value</span>
            <span className="font-mono text-sm font-bold text-foreground">
              {symbol}
              {totals.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, idx) => (
          <Card key={idx} className="relative overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${card.bg}`} />
            <CardContent className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
              <p className={`mt-2 font-mono text-2xl font-bold ${card.color}`}>
                {symbol}
                {card.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-amber-400/80 to-primary/70" />
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            Aging Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/25">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="pl-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Age Bucket</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">SKU / Product</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Days Old</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Qty on Hand</TableHead>
                <TableHead className="pr-6 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Extended Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(buckets).flatMap(([bucketName, items]) => {
                const arr = items as Array<any>;
                if (arr.length === 0) return [];
                
                const label = bucketName.replace("days0_30", "0-30 Days")
                  .replace("days31_90", "31-90 Days")
                  .replace("days91_180", "91-180 Days")
                  .replace("days180plus", "180+ Days");

                const badgeColor = bucketName === "days180plus" ? "destructive"
                  : bucketName === "days91_180" ? "warning"
                  : bucketName === "days31_90" ? "info"
                  : "success";

                return arr.map((item, idx) => (
                  <TableRow key={`${bucketName}-${item._id}`} className="hover:bg-muted/30 border-border/40">
                    {idx === 0 ? (
                      <TableCell rowSpan={arr.length} className="pl-6 align-top border-r border-border/40 bg-muted/5">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-bold ${
                          badgeColor === "destructive" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-sm" :
                          badgeColor === "warning" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm" :
                          badgeColor === "info" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-sm" :
                          "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm"
                        }`}>
                          {label}
                        </span>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold tracking-tight text-foreground">{item.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground/80">{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold text-muted-foreground">
                      {item.daysAge.toLocaleString()}d
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-black">
                      {item.stock}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-mono text-[13px] font-bold text-[#1a2744]">
                      {symbol}{(item.extendedValue || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ));
              })}
              
              {Object.values(buckets).every((arr: any) => arr.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No active inventory found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
