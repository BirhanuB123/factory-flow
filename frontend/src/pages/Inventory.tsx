import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, inventoryMovementsApi, inventoryAlertsApi, downloadReportCsv, locationsApi } from "@/lib/api";
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
  Search,
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { InventoryMetrics } from "@/components/InventoryMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryAgingTab } from "@/components/inventory/InventoryAgingTab";
import { LocationsTab } from "@/components/inventory/LocationsTab";
import { Clock } from "lucide-react";
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
  trackingMethod: 'none' | 'batch' | 'serial';
  hasExpiry: boolean;
  lastReceived?: string;
}

interface LotBalance {
  _id: string;
  lotNumber: string;
  serialNumber: string;
  quantity: number;
  expirationDate?: string;
  location?: string;
  updatedAt: string;
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
  trackingMethod: "none",
  hasExpiry: false,
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
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [movKind, setMovKind] = useState<"receipt" | "issue" | "adjustment" | "transfer">("receipt");
  const [movQty, setMovQty] = useState(1);
  const [movNote, setMovNote] = useState("");
  const [movLotNumber, setMovLotNumber] = useState("");
  const [movBatchNumber, setMovBatchNumber] = useState("");
  const [movSerialNumber, setMovSerialNumber] = useState("");
  const [movExpirationDate, setMovExpirationDate] = useState("");
  const [movLocationId, setMovLocationId] = useState("");
  const [movToLocationId, setMovToLocationId] = useState("");

  useEffect(() => {
    if (embedded) return;
    if (searchParams.get("action") !== "receipt") return;

    const clearAction = () =>
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("action");
          return n;
        },
        { replace: true },
      );

    if (!canPostInventory) {
      toast.error("You don't have permission to record inventory receipts.");
      clearAction();
      return;
    }

    setMovKind("receipt");
    setMovDialogOpen(true);
    clearAction();
  }, [embedded, searchParams, setSearchParams, canPostInventory]);

  const { data: inventoryData = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: locationsApi.getAll,
    enabled: !embedded,
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
        setMovLotNumber("");
        setMovBatchNumber("");
        setMovSerialNumber("");
        setMovExpirationDate("");
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
      setMovLotNumber("");
      setMovBatchNumber("");
      setMovSerialNumber("");
      setMovExpirationDate("");
      setMovLocationId("");
      setMovToLocationId("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Movement failed");
    },
  });

  const { data: lotBalances = [], isLoading: lotsLoading } = useQuery({
    queryKey: ["inventory-lots", selectedItem?._id],
    queryFn: () => inventoryApi.getLots(selectedItem!._id),
    enabled: !!selectedItem && (selectedItem.trackingMethod !== 'none'),
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
        trackingMethod: editingItem.trackingMethod ?? "none",
        hasExpiry: editingItem.hasExpiry ?? false,
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
  const inStockTotal = inventoryData.filter((i: InventoryItem) => getStockLevel(i) === "In Stock").length;

  const stockFilterOptions = [
    { key: "All" as const, label: "All" },
    { key: "In Stock" as const, label: "In stock" },
    { key: "Low Stock" as const, label: "Low" },
    { key: "Out of Stock" as const, label: "Out" },
  ] as const;

  const stockFilterCount = (key: (typeof stockFilterOptions)[number]["key"]) => {
    if (key === "All") return inventoryData.length;
    return inventoryData.filter((i: InventoryItem) => getStockLevel(i) === key).length;
  };

  const inventoryFiltersCard = (
    <Card className="rounded-2xl border-0 bg-card shadow-erp">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1a2744]">
              {embedded ? "Stock library" : "Search & filters"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {embedded
                ? "Category, stock level, and SKU lookup"
                : "Category, availability chips, saved views, and export"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-full border-primary/20 shadow-erp-sm"
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
              className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={() => {
                setEditingItem(null);
                setFormValues({ ...defaultForm });
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Inbound material
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="group relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search SKUs, names, or locations…"
              className="h-10 rounded-full border-0 bg-[#EEF2F7] pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-full border-border/60 bg-muted/40 lg:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 p-1">
          {stockFilterOptions.map(({ key, label }) => {
            const count = stockFilterCount(key);
            const active = stockFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStockFilter(key);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-primary-foreground/20" : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

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
      </CardContent>
    </Card>
  );

  const inventoryRegisterCard = (
    <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
        <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Stock register</CardTitle>
        <p className="text-sm font-medium text-muted-foreground">
          Click a row for valuation, reorder, and edit — paginated for large catalogs
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/25">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="h-12 pl-6 text-xs font-bold text-foreground">ID</TableHead>
                <TableHead className="h-12 text-xs font-bold text-foreground">SKU / name</TableHead>
                <TableHead className="hidden h-12 text-xs font-bold text-foreground md:table-cell">Category</TableHead>
                <TableHead className="h-12 text-right text-xs font-bold text-foreground">Qty</TableHead>
                <TableHead className="hidden h-12 text-right text-xs font-bold text-foreground lg:table-cell">
                  Unit cost
                </TableHead>
                <TableHead className="h-12 text-xs font-bold text-foreground">Status</TableHead>
                <TableHead className="hidden h-12 text-xs font-bold text-foreground lg:table-cell">Location</TableHead>
                <TableHead className="h-12 w-[80px] pr-6 text-xs font-bold text-foreground" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading inventory…
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center font-medium text-muted-foreground">
                    No SKUs match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => {
                  const status = getStockLevel(item);
                  return (
                    <TableRow
                      key={item._id}
                      className="group/row cursor-pointer border-border/40 transition-colors hover:bg-muted/35"
                      onClick={() => setSelectedItem(item)}
                    >
                      <TableCell className="pl-6 font-mono text-[10px] font-medium text-muted-foreground opacity-70 group-hover/row:opacity-100">
                        {item._id.substring(item._id.length - 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold tracking-tight text-foreground">{item.name}</span>
                          <span className="text-[10px] font-medium text-muted-foreground">{item.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="rounded-md border-border/60 px-2 text-[10px] font-medium">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="font-mono text-[13px] font-semibold">
                            {item.stock}{" "}
                            <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                          </div>
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted/40">
                            <div
                              className={`h-full transition-all ${
                                status === "Out of Stock"
                                  ? "bg-rose-500"
                                  : status === "Low Stock"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.min(100, (item.stock / (item.reorderPoint * 2 || 100)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-[13px] font-semibold text-[hsl(152,69%,36%)] lg:table-cell">
                        {symbol}
                        {item.unitCost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockBadgeVariant[status]} className="rounded-md px-2 py-0 text-[10px] font-semibold">
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-[11px] font-medium text-muted-foreground lg:table-cell">
                        {item.location || "—"}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full opacity-0 transition-all group-hover/row:opacity-100 hover:bg-primary/10 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
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

        {totalPages > 1 && (
          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border/50 bg-muted/10 px-6 py-4 sm:flex-row sm:items-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}{" "}
              SKUs
            </p>
            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/60 bg-card shadow-erp-sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 font-mono text-xs font-bold shadow-erp-sm">
                {page} <span className="text-muted-foreground">/</span> {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/60 bg-card shadow-erp-sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const atRiskTotal = lowStockTotal + outStockTotal;

  return (
    <>
      <div className={`${embedded ? "space-y-6" : "space-y-8"} pb-8 animate-in fade-in duration-500`}>
        {!embedded && (
          <>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.inventory.title")}</h1>
                <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">{t("pages.inventory.subtitle")}</p>
              </div>

              <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SKUs</p>
                  <p className="text-sm font-semibold text-foreground">{inventoryData.length}</p>
                </div>
                <div className="h-8 w-px bg-border/70" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categories</p>
                  <p className="text-sm font-semibold text-muted-foreground">{catTotal}</p>
                </div>
                <div className="h-8 w-px bg-border/70" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alerts</p>
                  <p
                    className={`text-sm font-semibold ${
                      outStockTotal > 0 ? "text-destructive" : lowStockTotal > 0 ? "text-amber-600" : "text-[hsl(152,69%,36%)]"
                    }`}
                  >
                    {lowStockTotal} low · {outStockTotal} out
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "SKUs tracked",
                  value: String(inventoryData.length),
                  icon: Package,
                  color: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  label: "Categories",
                  value: String(catTotal),
                  icon: Layers,
                  color: "text-info",
                  bg: "bg-info/10",
                },
                {
                  label: "In stock",
                  value: String(inStockTotal),
                  icon: CheckCircle2,
                  color: "text-success",
                  bg: "bg-success/10",
                },
                {
                  label: "At risk (low + out)",
                  value: String(atRiskTotal),
                  icon: AlertTriangle,
                  color: outStockTotal > 0 ? "text-destructive" : lowStockTotal > 0 ? "text-warning" : "text-muted-foreground",
                  bg: outStockTotal > 0 ? "bg-destructive/10" : lowStockTotal > 0 ? "bg-warning/10" : "bg-muted/40",
                },
              ].map((stat, idx) => (
                <Card
                  key={idx}
                  className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <InventoryMetrics />

        {!embedded && stockAlerts.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-0 border-l-4 border-l-amber-500/80 bg-card shadow-erp">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">ATP ≤ reorder</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Available = on hand − reserved (orders + job materials). Restock when at or below reorder point.
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                {stockAlerts.slice(0, 12).map((a) => (
                  <div
                    key={a.productId}
                    className={`rounded-xl border px-3 py-2 text-xs shadow-erp-sm ${
                      a.severity === "critical"
                        ? "border-destructive/40 bg-destructive/5"
                        : a.severity === "high"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border/60 bg-muted/30"
                    }`}
                  >
                    <span className="font-mono font-semibold">{a.sku}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="font-medium">ATP {a.available}</span>
                    <span className="mx-1 text-muted-foreground">/</span>
                    <span>OH {a.onHand}</span>
                    {a.reserved > 0 && (
                      <>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span>Res {a.reserved}</span>
                      </>
                    )}
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span>ROP {a.reorderPoint}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="register" className="space-y-6">
          <TabsList className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-start gap-2 bg-transparent p-0 border-b border-border/50 rounded-none mb-6">
            <TabsTrigger
              value="register"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Package className="mr-2 h-4 w-4" />
              Stock Register
            </TabsTrigger>
            <TabsTrigger
              value="aging"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Clock className="mr-2 h-4 w-4" />
              Inventory Aging
            </TabsTrigger>
            <TabsTrigger
              value="locations"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Locations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-0 space-y-6 focus-visible:outline-none">
            {inventoryFiltersCard}
            {inventoryRegisterCard}

            {!embedded && (
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="flex flex-col gap-4 border-b border-border/50 bg-muted/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Stock movements</CardTitle>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Receipts, issues, production completions, and adjustments
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={movFilterProductId || "__all__"}
                      onValueChange={(v) => setMovFilterProductId(v === "__all__" ? "" : v)}
                    >
                      <SelectTrigger className="h-10 w-full rounded-full border-border/60 bg-muted/40 sm:w-[220px]">
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
                      className="h-10 rounded-full px-5 font-semibold shadow-sm"
                      disabled={!canPostInventory}
                      title={!canPostInventory ? "Warehouse / Admin only (inventory:post)" : undefined}
                      onClick={() => canPostInventory && setMovDialogOpen(true)}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Record movement
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted/25">
                        <TableRow className="border-border/40">
                          <TableHead className="pl-6 text-xs font-bold text-foreground">When</TableHead>
                          <TableHead className="text-xs font-bold text-foreground">SKU</TableHead>
                          <TableHead className="text-xs font-bold text-foreground">Type</TableHead>
                          <TableHead className="text-right text-xs font-bold text-foreground">Δ Qty</TableHead>
                          <TableHead className="pr-6 text-right text-xs font-bold text-foreground">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movementsLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                              Loading movements…
                            </TableCell>
                          </TableRow>
                        ) : movements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                              No movements yet. Receipts, issues, production completions, and adjustments appear here.
                            </TableCell>
                          </TableRow>
                        ) : (
                          movements.map((m) => (
                            <TableRow key={m._id} className="border-border/40">
                              <TableCell className="whitespace-nowrap pl-6 text-xs text-muted-foreground">
                                {new Date(m.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold">{m.product?.sku ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-md text-[10px] font-semibold uppercase">
                                  {m.movementType.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono text-sm font-semibold ${m.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                {m.delta >= 0 ? "+" : ""}
                                {m.delta}
                              </TableCell>
                              <TableCell className="pr-6 text-right font-mono text-sm">{m.balanceAfter}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="aging" className="mt-0 focus-visible:outline-none">
            <InventoryAgingTab />
          </TabsContent>

          <TabsContent value="locations" className="mt-0 focus-visible:outline-none">
            <LocationsTab />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-0 shadow-erp sm:max-w-xl">
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

                {selectedItem.trackingMethod !== 'none' && (
                  <div className="col-span-2 md:col-span-3 border-t border-white/5 pt-6 mt-2">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Live Balance by Lot/Serial</p>
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                      <Table className="bg-white/2">
                        <TableHeader className="bg-white/5">
                          <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="h-9 text-[9px] font-black uppercase text-muted-foreground">Identifier</TableHead>
                            <TableHead className="h-9 text-right text-[9px] font-black uppercase text-muted-foreground">Qty</TableHead>
                            <TableHead className="h-9 text-right text-[9px] font-black uppercase text-muted-foreground uppercase">Expires</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lotsLoading ? (
                            <TableRow>
                              <TableCell colSpan={3} className="h-12 text-center text-[10px] text-muted-foreground">Synchronizing lot ledger...</TableCell>
                            </TableRow>
                          ) : lotBalances.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="h-12 text-center text-[10px] text-muted-foreground">No active lots in terminal</TableCell>
                            </TableRow>
                          ) : (
                            lotBalances.map((lb: LotBalance) => (
                              <TableRow key={lb._id} className="border-white/5 group/lot">
                                <TableCell className="py-2">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-foreground">
                                      {lb.serialNumber ? `SN: ${lb.serialNumber}` : (lb.lotNumber || 'Default Lot')}
                                    </span>
                                    {lb.location && <span className="text-[9px] text-muted-foreground uppercase font-medium">{lb.location}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  <span className="text-[11px] font-black text-emerald-500 italic">{lb.quantity}</span>
                                </TableCell>
                                <TableCell className="py-2 text-right text-[10px] font-medium text-muted-foreground">
                                  {lb.expirationDate ? new Date(lb.expirationDate).toLocaleDateString() : '—'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-0 shadow-erp sm:max-w-2xl">
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

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Tracking Protocol</Label>
                  <Select
                    value={(formValues.trackingMethod as string) ?? "none"}
                    onValueChange={(v) => setFormValues((p) => ({ ...p, trackingMethod: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold uppercase italic text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                      <SelectItem value="none" className="font-bold uppercase text-[10px]">None (Bulk)</SelectItem>
                      <SelectItem value="batch" className="font-bold uppercase text-[10px]">Batch / Lot</SelectItem>
                      <SelectItem value="serial" className="font-bold uppercase text-[10px]">Individual (Serial)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasExpiry"
                      className="h-4 w-4 rounded border-white/10 bg-white/5 accent-primary"
                      checked={(formValues.hasExpiry as boolean) ?? false}
                      onChange={(e) => setFormValues((p) => ({ ...p, hasExpiry: e.target.checked }))}
                    />
                    <Label htmlFor="hasExpiry" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest cursor-pointer">
                      Enforce Expiration Tracking
                    </Label>
                  </div>
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
                    trackingMethod: formValues.trackingMethod,
                    hasExpiry: !!formValues.hasExpiry,
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
        <DialogContent className="rounded-2xl border border-border/60 shadow-erp sm:max-w-md">
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
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className={`grid ${movKind === 'transfer' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div className="space-y-2">
                <Label>{movKind === 'transfer' ? 'From Location' : 'Location'}</Label>
                <Select
                  value={movLocationId || "__none__"}
                  onValueChange={(v) => setMovLocationId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Default (None)</SelectItem>
                    {locations.map((loc: any) => (
                      <SelectItem key={loc._id} value={loc._id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {movKind === 'transfer' && (
                <div className="space-y-2">
                  <Label>To Location</Label>
                  <Select
                    value={movToLocationId || "__none__"}
                    onValueChange={(v) => setMovToLocationId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select destination</SelectItem>
                      {locations.map((loc: any) => (
                        <SelectItem key={loc._id} value={loc._id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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

            {(() => {
              const p = inventoryData.find((i: InventoryItem) => i._id === movProductId);
              if (!p) return null;
              
              const isReceipt = movKind === 'receipt';
              const showBatch = p.trackingMethod === 'batch';
              const showSerial = p.trackingMethod === 'serial';
              const showExpiry = p.hasExpiry && isReceipt;

              if (!showBatch && !showSerial && !showExpiry) return null;

              return (
                <div className="grid gap-4 pt-2 border-t border-border/40 mt-2">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">Tracking Requirements</p>
                  <div className="grid grid-cols-2 gap-3">
                    {showBatch && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold">Lot Number</Label>
                          <Input 
                            value={movLotNumber} 
                            onChange={(e) => setMovLotNumber(e.target.value)} 
                            placeholder="LOT-123"
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold">Batch Number</Label>
                          <Input 
                            value={movBatchNumber} 
                            onChange={(e) => setMovBatchNumber(e.target.value)} 
                            placeholder="BAT-XYZ"
                            className="h-9 rounded-lg"
                          />
                        </div>
                      </>
                    )}
                    {showSerial && (
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[10px] font-bold">Serial Number</Label>
                        <Input 
                          value={movSerialNumber} 
                          onChange={(e) => setMovSerialNumber(e.target.value)} 
                          placeholder="SN-1000"
                          className="h-9 rounded-lg"
                        />
                      </div>
                    )}
                    {showExpiry && (
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[10px] font-bold">Expiration Date</Label>
                        <Input 
                          type="date"
                          value={movExpirationDate} 
                          onChange={(e) => setMovExpirationDate(e.target.value)} 
                          className="h-9 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
                const p = inventoryData.find((i: InventoryItem) => i._id === movProductId);
                if (p?.trackingMethod === 'batch' && !movLotNumber && !movBatchNumber) {
                  toast.error("Lot or Batch number is required for this product");
                  return;
                }
                if (p?.trackingMethod === 'serial' && !movSerialNumber) {
                  toast.error("Serial number is required for this product");
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
                  lotNumber: movLotNumber,
                  batchNumber: movBatchNumber,
                  serialNumber: movSerialNumber,
                  expirationDate: movExpirationDate || null,
                  locationId: movLocationId || null,
                  toLocationId: movToLocationId || null,
                } as any);
              }}
            >
              Post to ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-border/60 shadow-erp">
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
