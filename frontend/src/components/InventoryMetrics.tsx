import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function InventoryMetrics() {
  const { symbol } = useCurrency();
  const { data: inventoryData = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const lowStockCount = inventoryData.filter((i: any) => i.stock > 0 && i.stock <= i.reorderPoint).length;
  const outOfStockCount = inventoryData.filter((i: any) => i.stock === 0).length;
  const totalValue = inventoryData.reduce((sum: number, i: any) => sum + (i.stock * (i.unitCost || 0)), 0);
  const categoriesCount = new Set(inventoryData.map((i: any) => i.category)).size;

  const stats = [
    { 
      label: "Inventory Assets", 
      value: inventoryData.length, 
      sub: `${categoriesCount} categories`,
      icon: Package, 
      color: "text-blue-500", 
      bg: "bg-blue-500/10",
      trend: "+12%",
      trendUp: true
    },
    { 
      label: "Low Level Alerts", 
      value: lowStockCount, 
      sub: "Needs reorder",
      icon: AlertTriangle, 
      color: "text-amber-500", 
      bg: "bg-amber-500/10",
      trend: "Critical",
      trendUp: false
    },
    { 
      label: "Critical Shortage", 
      value: outOfStockCount, 
      sub: "Out of stock",
      icon: TrendingDown, 
      color: "text-rose-500", 
      bg: "bg-rose-500/10",
      trend: "-5%",
      trendUp: false
    },
    { 
      label: "Total Asset Value", 
      value: `${symbol}${totalValue.toLocaleString()}`, 
      sub: "Base valuation",
      icon: DollarSign, 
      color: "text-emerald-500", 
      bg: "bg-emerald-500/10",
      trend: "+3.2%",
      trendUp: true
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => (
        <Card
          key={idx}
          className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <CardContent className="relative p-6">
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
            
            <div className="flex justify-between items-start mb-4">
              <div className={`h-12 w-12 rounded-2xl ${stat.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                stat.trendUp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              }`}>
                {stat.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.trend}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                {stat.label}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tighter italic">
                  {stat.value}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {stat.sub}
                </span>
              </div>
            </div>
            
            <div className="mt-4 h-1 w-full bg-muted/30 rounded-full overflow-hidden">
              <div 
                className={`h-full ${stat.bg.replace('/10', '')} transition-all duration-1000`} 
                style={{ width: stat.trendUp ? '70%' : '30%' }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
