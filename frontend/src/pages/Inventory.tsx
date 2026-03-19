import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, inventoryMovementsApi, inventoryAlertsApi, downloadReportCsv } from "@/lib/api";
import { submitInventoryMovementWhenOnline } from "@/lib/offlineCriticalActions";
import { SavedViewsBar } from "@/components/SavedViewsBar";
import { useCurrency } from "@/hooks/use-currency";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Plus, Package, AlertTriangle, TrendingDown, Eye, Edit, Trash2, DollarSign, History, Download,
} from "lucide-react";
import { InventoryMetrics } from "@/components/InventoryMetrics";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

type StockLevel = "In Stock" | "Low Stock" | "Out of Stock";

const stockBadgeVariant: Record<StockLevel, "success" | "warning" | "destructive"> = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "destructive",
};

interface InventoryItem {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  reorderPoint: number;
  unitCost: number;
  supplier: string;
  location: string;
  lastReceived?: string;
}

const defaultForm: Partial<InventoryItem> = {
  name: "",
  sku: "",
  description: "",
  category: "Raw Metal",
  price: 0,
  stock: 0,
  unit: "pcs",
  reorderPoint: 0,
  unitCost: 0,
  supplier: "",
  location: "",
};

const categories = ["All", "Raw Metal", "Tooling", "Hardware", "Consumables", "Finished Good"];

const ITEMS_PER_PAGE = 8;

export default function Inventory({
  initialCategory = "All",
  embedded = false,
}: {
  initialCategory?: string;
  /** When true (e.g. Production tab), skip module hero to avoid duplicate chrome */
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { symbol } = useCurrency();
  const canPostInventory = can("inventory:post");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [stockFilter, setStockFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({ ...defaultForm });
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [movFilterProductId, setMovFilterProductId] = useState("");
  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [movProductId, setMovProductId] = useState("");
  const [movKind, setMovKind] = useState<"receipt" | "issue" | "adjustment">("receipt");
  const [movQty, setMovQty] = useState(1);
  const [movNote, setMovNote] = useState("");

  const { data: inventoryData = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inventoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      toast.success("Item added successfully");
      setFormOpen(false);
      setFormValues({ ...defaultForm });
    },
    onError: (err: { response?: { data?: { message?: string; error?: string } } }) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to add item");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inventoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      toast.success("Item updated successfully");
      setFormOpen(false);
      setEditingItem(null);
      setSelectedItem(null);
      setFormValues({ ...defaultForm });
    },
    onError: (err: { response?: { data?: { message?: string; error?: string } } }) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to update item");
    },
  });

  const { data: stockAlerts = [] } = useQuery({
    queryKey: ["inventory-alerts"],
    queryFn: inventoryAlertsApi.getAlerts,
    enabled: !embedded,
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory-movements", movFilterProductId],
    queryFn: () =>
      inventoryMovementsApi.getAll({
        productId: movFilterProductId || undefined,
        limit: 100,
      }),
    enabled: !embedded,
  });

  const movementMutation = useMutation({
    mutationFn: (body: {
      productId: string;
      kind: "receipt" | "issue" | "adjustment";
      quantity: number;
      note?: string;
    }) => submitInventoryMovementWhenOnline(body),
    onSuccess: (result) => {
      if (result.queued) {
        toast.success("Movement queued — will sync when online.");
        setMovDialogOpen(false);
        setMovProductId("");
        setMovQty(1);
        setMovNote("");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      toast.success("Stock movement recorded");
      setMovDialogOpen(false);
      setMovProductId("");
      setMovQty(1);
      setMovNote("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Movement failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success("Item deleted");
      setDeleteTarget(null);
      setSelectedItem(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to delete item");
    },
  });

  useEffect(() => {
    if (editingItem) {
      setFormValues({
        name: editingItem.name,
        sku: editingItem.sku,
        description: editingItem.description ?? "",
        category: editingItem.category ?? "Raw Metal",
        price: editingItem.price ?? 0,
        stock: editingItem.stock ?? 0,
        unit: editingItem.unit ?? "pcs",
        reorderPoint: editingItem.reorderPoint ?? 0,
        unitCost: editingItem.unitCost ?? 0,
        supplier: editingItem.supplier ?? "",
        location: editingItem.location ?? "",
      });
    } else {
      setFormValues({ ...defaultForm });
    }
  }, [editingItem]);

  const getStockLevel = (item: InventoryItem): StockLevel => {
    if (item.stock === 0) return "Out of Stock";
    if (item.stock <= item.reorderPoint) return "Low Stock";
    return "In Stock";
  };

  const filtered = inventoryData.filter((item: InventoryItem) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item._id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    
    const status = getStockLevel(item);
    const matchesStock = stockFilter === "All" || status === stockFilter;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const lowStockTotal = inventoryData.filter(
    (i: InventoryItem) => i.stock > 0 && i.stock <= i.reorderPoint
  ).length;
  const outStockTotal = inventoryData.filter((i: InventoryItem) => i.stock === 0).length;
  const catTotal = new Set(inventoryData.map((i: InventoryItem) => i.category)).size;

  const addButton = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="gap-2 rounded-xl h-11"
        onClick={() =>
          downloadReportCsv("/reports/export/inventory", `inventory-${Date.now()}.csv`).catch(() =>
            toast.error("Export failed")
          )
        }
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      <Button
        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl px-6 h-11 transition-all hover:-translate-y-0.5"
        onClick={() => {
          setEditingItem(null);
          setFormValues({ ...defaultForm });
          setFormOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        <span className="font-bold">Inbound Material</span>
      </Button>
    </div>
  );

  const ledger = (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden">
      <CardHeader className="pb-6 border-b border-white/5 bg-white/5">
        {embedded && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase">
                  Raw Materials Ledger
                </h2>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Real-time material tracking and stock management
              </p>
            </div>
            {addButton}
          </div>
        )}
        <div className={`flex flex-col lg:flex-row gap-4 ${embedded ? "" : "pt-0"}`}>
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search resources, SKUs, or locations..."
                className="pl-10 bg-background/50 border-border/50 focus-visible:ring-primary/20 h-11 rounded-xl transition-all"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-background/50 border-border/50 h-11 rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background/50 border-border/50 h-11 rounded-xl">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Stocks</SelectItem>
                  <SelectItem value="In Stock">Healthy</SelectItem>
                  <SelectItem value="Low Stock">Warning</SelectItem>
                  <SelectItem value="Out of Stock">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
        </div>
        {!embedded && (
          <SavedViewsBar
            module="inventory"
            filters={{ search, categoryFilter, stockFilter }}
            onApply={(f) => {
              if (f.search != null) setSearch(String(f.search));
              if (f.categoryFilter != null) setCategoryFilter(String(f.categoryFilter));
              if (f.stockFilter != null) setStockFilter(String(f.stockFilter));
              setPage(1);
            }}
          />
        )}
      </CardHeader>
      <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 pl-6 h-12">Serial/ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12">Resource Name</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12 hidden md:table-cell">Classification</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12 text-right">Qty/Balance</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12 hidden lg:table-cell text-right">Unit Val</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12">Supply Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50 h-12 hidden lg:table-cell">Bay/Loc</TableHead>
                  <TableHead className="w-[80px] pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-24 text-muted-foreground font-medium italic">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Scanning inventory grid...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-24 text-muted-foreground font-medium">
                      Zero matching records in current partition.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => {
                    const status = getStockLevel(item);
                    return (
                      <TableRow
                        key={item._id}
                        className="cursor-pointer transition-all hover:bg-white/5 border-white/5 group/row"
                        onClick={() => setSelectedItem(item)}
                      >
                        <TableCell className="pl-6 font-mono text-[10px] font-bold text-muted-foreground/40 group-hover/row:text-primary transition-colors">
                          {item._id.substring(item._id.length - 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-[13px] tracking-tight text-foreground group-hover/row:translate-x-1 transition-transform duration-300">{item.name}</span>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter opacity-70 italic">{item.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-[9px] font-black uppercase rounded-md px-1.5 py-0 border-white/10 bg-white/5">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-mono text-[13px] font-black">
                              {item.stock} <span className="text-[9px] text-muted-foreground/50 font-medium">{item.unit}</span>
                            </div>
                            <div className="w-16 h-1 bg-muted/30 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${status === 'Out of Stock' ? 'bg-rose-500' : status === 'Low Stock' ? 'bg-amber-500' : 'bg-emerald-500'} transition-all`}
                                style={{ width: `${Math.min(100, (item.stock / (item.reorderPoint * 2 || 100)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono text-[13px] font-black text-emerald-500/80">
                          {symbol}{item.unitCost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockBadgeVariant[status]} className="text-[9px] font-black uppercase tracking-tight py-0 px-2 rounded-md">
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground/60 text-[10px] font-black uppercase tracking-tighter italic">
                          {item.location}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg opacity-20 group-hover/row:opacity-100 transition-all hover:bg-primary/20 hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/2">
              <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest hidden sm:block">
                Partition Segment: {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} resources
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 border-white/10 bg-white/5 rounded-lg hover:bg-white/10"
                  disabled={page === 1} 
                  onClick={() => setPage(page - 1)}
                >
                  <Plus className="h-4 w-4 rotate-[135deg]" />
                </Button>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg font-mono text-[11px] font-black">
                  <span className="text-primary">{page}</span>
                  <span className="text-muted-foreground/30">/</span>
                  <span className="text-muted-foreground">{totalPages}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 border-white/10 bg-white/5 rounded-lg hover:bg-white/10"
                  disabled={page === totalPages} 
                  onClick={() => setPage(page + 1)}
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <InventoryMetrics />
          {ledger}
        </div>
      ) : (
        <ModuleDashboardLayout
          title="Inventory Control"
          description="Full-facility stock visibility, reorder signals, and valuation in one place."
          icon={Package}
          actions={addButton}
          healthStats={[
            { label: "SKUs tracked", value: String(inventoryData.length) },
            { label: "Categories", value: String(catTotal) },
            {
              label: "Stock alerts",
              value: `${lowStockTotal} low · ${outStockTotal} out`,
              accent:
                outStockTotal > 0
                  ? "text-destructive"
                  : lowStockTotal > 0
                    ? "text-amber-500"
                    : "text-success",
            },
          ]}
        >
          <div className="space-y-6">
            <InventoryMetrics />
            {stockAlerts.length > 0 && (
              <Card className="border-none shadow-lg bg-amber-500/5 border border-amber-500/20 overflow-hidden">
                <CardHeader className="py-3 pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base font-black uppercase tracking-tight">
                      ATP ≤ reorder (Phase 2)
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available = on hand − reserved (orders + job materials). Restock when at or below reorder point.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {stockAlerts.slice(0, 12).map((a) => (
                      <div
                        key={a.productId}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          a.severity === "critical"
                            ? "border-destructive/50 bg-destructive/10"
                            : a.severity === "high"
                              ? "border-amber-500/40 bg-amber-500/10"
                              : "border-border bg-muted/30"
                        }`}
                      >
                        <span className="font-mono font-bold">{a.sku}</span>
                        <span className="text-muted-foreground mx-1">·</span>
                        <span className="font-medium">ATP {a.available}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span>OH {a.onHand}</span>
                        {a.reserved > 0 && (
                          <>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span>Res {a.reserved}</span>
                          </>
                        )}
                        <span className="text-muted-foreground mx-1">·</span>
                        <span>ROP {a.reorderPoint}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {ledger}
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-black tracking-tight uppercase">
                    Stock ledger (movements)
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={movFilterProductId || "__all__"}
                    onValueChange={(v) => setMovFilterProductId(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="w-[220px] h-10 rounded-xl bg-background/50">
                      <SelectValue placeholder="All SKUs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All products</SelectItem>
                      {inventoryData.map((p: InventoryItem) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.sku} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-10 rounded-xl font-bold"
                    disabled={!canPostInventory}
                    title={!canPostInventory ? "Warehouse / Admin only (inventory:post)" : undefined}
                    onClick={() => canPostInventory && setMovDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Record movement
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/30 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-black pl-6">When</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">SKU</TableHead>
                        <TableHead className="text-[10px] uppercase font-black">Type</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-right">Δ Qty</TableHead>
                        <TableHead className="text-[10px] uppercase font-black text-right pr-6">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            Loading movements…
                          </TableCell>
                        </TableRow>
                      ) : movements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            No movements yet. Receipts, issues, production completions, and adjustments appear here.
                          </TableCell>
                        </TableRow>
                      ) : (
                        movements.map((m) => (
                          <TableRow key={m._id} className="border-white/5">
                            <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">
                              {m.product?.sku ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-black uppercase">
                                {m.movementType.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono font-black ${m.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {m.delta >= 0 ? "+" : ""}
                              {m.delta}
                            </TableCell>
                            <TableCell className="text-right font-mono pr-6">{m.balanceAfter}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </ModuleDashboardLayout>
      )}

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden p-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-emerald-500" />
          
          <div className="p-8">
            <DialogHeader className="mb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Resource Profile</p>
                  <DialogTitle className="text-3xl font-black tracking-tighter italic uppercase text-foreground">
                    {selectedItem?.name}
                  </DialogTitle>
                </div>
                <div className={`h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20`}>
                  <Package className="h-7 w-7 text-primary" />
                </div>
              </div>
              <DialogDescription className="text-xs font-bold text-muted-foreground pt-2">
                SKU: <span className="text-foreground">{selectedItem?.sku}</span> • SYSTEM ID: <span className="text-foreground font-mono">{selectedItem?._id}</span>
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Classification</p>
                  <p className="text-sm font-bold text-foreground italic">{selectedItem.category}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Availability</p>
                  <Badge variant={stockBadgeVariant[getStockLevel(selectedItem)]} className="text-[10px] uppercase font-black">
                    {getStockLevel(selectedItem)}
                  </Badge>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Inventory Loc</p>
                  <p className="text-sm font-bold text-foreground italic">{selectedItem.location || 'N/A'}</p>
                </div>
                
                <div className="bg-gradient-to-br from-background to-white/5 rounded-2xl p-4 border border-white/5 col-span-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Current Balance</p>
                  <p className="text-xl font-black tracking-tighter italic text-foreground">
                    {selectedItem.stock} <span className="text-[10px] font-medium not-italic text-muted-foreground uppercase">{selectedItem.unit}</span>
                  </p>
                </div>
                <div className="bg-gradient-to-br from-background to-white/5 rounded-2xl p-4 border border-white/5 col-span-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Unit Valuation</p>
                  <p className="text-xl font-black tracking-tighter italic text-emerald-500">
                    {symbol}{selectedItem.unitCost.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-background to-white/5 rounded-2xl p-4 border border-white/5 col-span-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Exposure</p>
                  <p className="text-xl font-black tracking-tighter italic text-foreground">
                    {symbol}{(selectedItem.stock * selectedItem.unitCost).toLocaleString()}
                  </p>
                </div>
                
                <div className="col-span-2 md:col-span-3 bg-white/2 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-primary/50" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reorder Threshold</p>
                      <p className="text-sm font-bold">{selectedItem.reorderPoint} {selectedItem.unit} <span className="text-[10px] text-muted-foreground font-normal ml-2">Alert triggers below this level</span></p>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 md:col-span-3 grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Primary Supplier</p>
                    <p className="text-xs font-bold text-foreground">{selectedItem.supplier || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Logistics Trace</p>
                    <p className="text-xs font-bold text-foreground">
                      {selectedItem.lastReceived ? `Last received ${new Date(selectedItem.lastReceived).toLocaleDateString()}` : 'No logistics history'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 sm:justify-between pt-4 border-t border-white/5">
              <Button variant="outline" className="gap-2 rounded-xl h-11 border-white/10 hover:bg-white/5 transition-all w-full sm:w-auto font-black italic uppercase text-xs" onClick={() => setDeleteTarget(selectedItem)}>
                <Trash2 className="h-4 w-4 text-rose-500" /> Remove Resource
              </Button>
              <Button className="gap-2 rounded-xl h-11 px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 w-full sm:w-auto font-black italic uppercase text-xs" onClick={() => { setEditingItem(selectedItem); setFormOpen(true); }}>
                <Edit className="h-4 w-4" /> Adjust Parameters
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-2xl p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plus className={`h-6 w-6 text-primary transition-transform duration-500 ${editingItem ? 'rotate-180' : ''}`} />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tighter uppercase italic">
                  {editingItem ? "Update Resource Specs" : "Register New Material"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs font-bold text-muted-foreground tracking-wide uppercase">
                {editingItem ? "Modifying engineering parameters and stock counts." : "Establishing new inventory record in the ledger."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Asset Nomenclature</Label>
                  <Input
                    className="h-11 rounded-xl bg-white/5 border-white/10 focus-visible:ring-primary/20 font-bold"
                    value={(formValues.name as string) ?? ""}
                    onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Al-6061 Aerospace Grade Billet"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Stock Keeping Unit (SKU)</Label>
                  <Input
                    className="h-11 rounded-xl bg-white/5 border-white/10 focus-visible:ring-primary/20 font-mono font-bold"
                    value={(formValues.sku as string) ?? ""}
                    onChange={(e) => setFormValues((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="MAT-AL-6061"
                    disabled={!!editingItem}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Technical Description</Label>
                <Input
                  className="h-11 rounded-xl bg-white/5 border-white/10 focus-visible:ring-primary/20 text-xs font-medium"
                  value={(formValues.description as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Material properties, grades, or usage notes..."
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Logistics Class</Label>
                  <Select
                    value={(formValues.category as string) ?? "Raw Metal"}
                    onValueChange={(v) => setFormValues((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 focus:ring-primary/20 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                      {categories.filter((c) => c !== "All").map((c) => (
                        <SelectItem key={c} value={c} className="font-bold uppercase text-[10px]">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Storage Unit</Label>
                  <Select
                    value={(formValues.unit as string) ?? "pcs"}
                    onValueChange={(v) => setFormValues((p) => ({ ...p, unit: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold uppercase italic text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                      <SelectItem value="pcs" className="font-bold uppercase text-[10px]">pcs</SelectItem>
                      <SelectItem value="kg" className="font-bold uppercase text-[10px]">kg</SelectItem>
                      <SelectItem value="m" className="font-bold uppercase text-[10px]">m</SelectItem>
                      <SelectItem value="L" className="font-bold uppercase text-[10px]">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 hidden md:block">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Logistics loc</Label>
                  <Input
                    className="h-11 rounded-xl bg-white/5 border-white/10 focus-visible:ring-primary/20 font-bold italic"
                    value={(formValues.location as string) ?? ""}
                    onChange={(e) => setFormValues((p) => ({ ...p, location: e.target.value }))}
                    placeholder="Bay A-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Current Count</Label>
                  <Input
                    className="h-11 rounded-xl bg-white/5 border-white/10 font-mono font-black italic text-lg"
                    type="number"
                    min={0}
                    value={(formValues.stock as number) ?? 0}
                    onChange={(e) => setFormValues((p) => ({ ...p, stock: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-amber-500">Threshold</Label>
                  <Input
                    className="h-11 rounded-xl bg-white/5 border-white/10 border-amber-500/20 font-mono font-black italic text-lg text-amber-500"
                    type="number"
                    min={0}
                    value={(formValues.reorderPoint as number) ?? 0}
                    onChange={(e) => setFormValues((p) => ({ ...p, reorderPoint: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-emerald-500">Unit Cost</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-500 opacity-50">{symbol}</span>
                    <Input
                      className="h-11 pl-7 rounded-xl bg-white/5 border-white/10 border-emerald-500/20 font-mono font-black italic text-lg text-emerald-500"
                      type="number"
                      min={0}
                      step={0.01}
                      value={(formValues.unitCost as number) ?? 0}
                      onChange={(e) => setFormValues((p) => ({ ...p, unitCost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Market Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-50">{symbol}</span>
                    <Input
                      className="h-11 pl-7 rounded-xl bg-white/5 border-white/10 font-mono font-black italic text-lg"
                      type="number"
                      min={0}
                      step={0.01}
                      value={(formValues.price as number) ?? 0}
                      onChange={(e) => setFormValues((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Primary Vendor</Label>
                <Input
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                  value={(formValues.supplier as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, supplier: e.target.value }))}
                  placeholder="Manufacturer or Trade Partner"
                />
              </div>
            </div>

            <DialogFooter className="mt-8 gap-3">
              <Button variant="ghost" className="h-12 rounded-xl px-8 font-black uppercase italic text-xs tracking-widest" onClick={() => setFormOpen(false)}>Abort</Button>
              <Button
                className="h-12 rounded-xl px-12 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 animate-pulse-slow active:scale-95 transition-all"
                onClick={() => {
                  const payload = {
                    name: formValues.name,
                    sku: formValues.sku,
                    description: formValues.description || undefined,
                    category: formValues.category,
                    price: Number(formValues.price),
                    unitCost: Number(formValues.unitCost),
                    stock: Number(formValues.stock),
                    reorderPoint: Number(formValues.reorderPoint),
                    unit: formValues.unit,
                    supplier: formValues.supplier || undefined,
                    location: formValues.location || undefined,
                  };
                  if (editingItem) {
                    updateMutation.mutate({ id: editingItem._id, data: payload });
                  } else {
                    if (!payload.name || !payload.sku) {
                      toast.error("Resource name and SKU identification required");
                      return;
                    }
                    createMutation.mutate(payload);
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingItem ? "Commit Specs" : "Authorize Record"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record stock movement</DialogTitle>
            <DialogDescription>
              Receipt and issue use positive quantities. Adjustment uses a signed delta (+ or −).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={movProductId || "__none__"}
                onValueChange={(v) => setMovProductId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select SKU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {inventoryData.map((p: InventoryItem) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={movKind}
                onValueChange={(v) => setMovKind(v as "receipt" | "issue" | "adjustment")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt (inbound)</SelectItem>
                  <SelectItem value="issue">Issue (outbound)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (signed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{movKind === "adjustment" ? "Delta (+/−)" : "Quantity"}</Label>
              <Input
                type="number"
                value={movQty}
                onChange={(e) => setMovQty(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={movNote} onChange={(e) => setMovNote(e.target.value)} placeholder="PO #, reason…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!movProductId || movementMutation.isPending}
              onClick={() => {
                if (!movProductId) {
                  toast.error("Select a product");
                  return;
                }
                const q =
                  movKind === "adjustment"
                    ? movQty
                    : Math.abs(movQty);
                if (movKind !== "adjustment" && q <= 0) {
                  toast.error("Quantity must be positive");
                  return;
                }
                movementMutation.mutate({
                  productId: movProductId,
                  kind: movKind,
                  quantity: q,
                  note: movNote || undefined,
                });
              }}
            >
              Post to ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-2xl border-white/10 shadow-3xl max-w-md">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase italic tracking-tighter">Decommission Resource?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-muted-foreground">
              You are about to purge <span className="text-foreground font-black">{deleteTarget?.name}</span> from the active ledger. This protocol is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-11 rounded-xl bg-white/5 border-white/10 font-bold uppercase text-[10px]">Cancel Protocol</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
            >
              Confirm Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
