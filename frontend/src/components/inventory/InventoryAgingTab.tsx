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
          <h2 className="text-xl font-bold tracking-tight text-[#1a2744]">Inventory Aging</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identify slow-moving stock based on receipt date. Optimization candidate items are highlighted in red.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-5 py-2.5 shadow-erp-sm">
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
          <Card key={idx} className="relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
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

      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a2744]">
            <Clock className="h-5 w-5 text-primary" />
            Aging Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/25">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="pl-6 text-xs font-bold text-foreground">Age Bucket</TableHead>
                <TableHead className="text-xs font-bold text-foreground">SKU / Product</TableHead>
                <TableHead className="text-right text-xs font-bold text-foreground">Days Old</TableHead>
                <TableHead className="text-right text-xs font-bold text-foreground">Qty on Hand</TableHead>
                <TableHead className="pr-6 text-right text-xs font-bold text-foreground">Extended Value</TableHead>
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
                  <TableRow key={`${bucketName}-${item._id}`} className="hover:bg-muted/30">
                    {idx === 0 ? (
                      <TableCell rowSpan={arr.length} className="pl-6 align-top border-r border-border/40 bg-muted/5">
                        <Badge variant={badgeColor} className="whitespace-nowrap font-semibold tracking-tight shadow-sm">
                          {label}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tracking-tight text-foreground">{item.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-semibold text-muted-foreground">
                      {item.daysAge.toLocaleString()}d
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold">
                      {item.stock}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-mono text-[13px] font-semibold text-[#1a2744]">
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
