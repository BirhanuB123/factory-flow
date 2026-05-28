import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, BarChart3, DollarSign, Layers } from "lucide-react";

export function InventoryMetrics() {
  const { symbol } = useCurrency();
  const { data: inventoryData = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const lowStockCount = inventoryData.filter((i: any) => i.stock > 0 && i.stock <= i.reorderPoint).length;
  const totalValue = inventoryData.reduce((sum: number, i: any) => sum + (i.stock * (i.unitCost || 0)), 0);
  const categoriesCount = new Set(inventoryData.map((i: any) => i.category)).size;

  const stats = [
    { 
      label: "Total value", 
      value: `${symbol}${totalValue.toLocaleString()}`, 
      sub: "↑ 3.2% this month",
      icon: DollarSign,
      tone: "text-emerald-600",
    },
    { 
      label: "Categories", 
      value: categoriesCount, 
      sub: "Across all warehouses",
      icon: Layers,
      tone: "text-muted-foreground",
    },
    { 
      label: "Low stock alerts", 
      value: lowStockCount, 
      sub: "Action needed",
      icon: AlertTriangle,
      tone: "text-destructive",
    },
    { 
      label: "Avg turnover", 
      value: "14d", 
      sub: "Average cycle time",
      icon: BarChart3,
      tone: "text-muted-foreground",
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => (
        <Card
          key={idx}
          className="overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
                {stat.label}
              </h3>
            </div>
            <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
            <p className={`mt-2 text-sm font-medium ${stat.tone}`}>{stat.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
