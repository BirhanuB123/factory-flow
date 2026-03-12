import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
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
  Search, Plus, Package, AlertTriangle, TrendingDown, Eye, Edit, Trash2,
} from "lucide-react";

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

const categories = ["All", "Raw Metal", "Tooling", "Hardware", "Consumables"];

const ITEMS_PER_PAGE = 8;

export default function Inventory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({ ...defaultForm });
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const { data: inventoryData = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inventoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success("Item added successfully");
      setFormOpen(false);
      setFormValues({ ...defaultForm });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to add item");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inventoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success("Item updated successfully");
      setFormOpen(false);
      setEditingItem(null);
      setSelectedItem(null);
      setFormValues({ ...defaultForm });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update item");
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

  const inStockCount = inventoryData.filter((i: InventoryItem) => getStockLevel(i) === "In Stock").length;
  const lowStockCount = inventoryData.filter((i: InventoryItem) => getStockLevel(i) === "Low Stock").length;
  const outOfStockCount = inventoryData.filter((i: InventoryItem) => getStockLevel(i) === "Out of Stock").length;
  const totalValue = inventoryData.reduce((sum: number, i: InventoryItem) => sum + i.stock * i.unitCost, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-xl font-bold text-foreground">{inventoryData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low Stock</p>
              <p className="text-xl font-bold text-foreground">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
              <p className="text-xl font-bold text-foreground">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-xl font-bold text-foreground">${totalValue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Inventory Items</CardTitle>
            <Button size="sm" className="gap-1.5 w-fit" onClick={() => { setEditingItem(null); setFormValues({ ...defaultForm }); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or ID..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Stock Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Levels</SelectItem>
                <SelectItem value="In Stock">In Stock</SelectItem>
                <SelectItem value="Low Stock">Low Stock</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Unit Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading inventory...
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => {
                  const status = getStockLevel(item);
                  return (
                    <TableRow
                      key={item._id}
                      className="cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{item._id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-foreground">{item.name}</span>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.stock} {item.unit}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-mono">
                        ${item.unitCost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockBadgeVariant[status]}>{status}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {item.location}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedItem?.name}
            </DialogTitle>
            <DialogDescription>{selectedItem?.sku} · {selectedItem?._id}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm py-2">
              <div>
                <p className="text-muted-foreground text-xs">Category</p>
                <p className="font-medium text-foreground">{selectedItem.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge variant={stockBadgeVariant[getStockLevel(selectedItem)]}>{getStockLevel(selectedItem)}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Quantity</p>
                <p className="font-medium text-foreground">{selectedItem.stock} {selectedItem.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Reorder Point</p>
                <p className="font-medium text-foreground">{selectedItem.reorderPoint} {selectedItem.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Unit Cost</p>
                <p className="font-medium text-foreground">${selectedItem.unitCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Value</p>
                <p className="font-medium text-foreground">${(selectedItem.stock * selectedItem.unitCost).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Supplier</p>
                <p className="font-medium text-foreground">{selectedItem.supplier}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Location</p>
                <p className="font-medium text-foreground">{selectedItem.location}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Last Received</p>
                <p className="font-medium text-foreground">{selectedItem.lastReceived ? new Date(selectedItem.lastReceived).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditingItem(selectedItem); setFormOpen(true); }}>
              <Edit className="h-3.5 w-3.5" /> Edit Item
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteTarget(selectedItem)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update inventory item details." : "Add a new product to inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={(formValues.name as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Product name"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={(formValues.sku as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, sku: e.target.value }))}
                  placeholder="SKU"
                  disabled={!!editingItem}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={(formValues.description as string) ?? ""}
                onChange={(e) => setFormValues((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={(formValues.category as string) ?? "Raw Metal"}
                  onValueChange={(v) => setFormValues((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((c) => c !== "All").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={(formValues.unit as string) ?? "pcs"}
                  onValueChange={(v) => setFormValues((p) => ({ ...p, unit: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(formValues.price as number) ?? 0}
                  onChange={(e) => setFormValues((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(formValues.unitCost as number) ?? 0}
                  onChange={(e) => setFormValues((p) => ({ ...p, unitCost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={(formValues.stock as number) ?? 0}
                  onChange={(e) => setFormValues((p) => ({ ...p, stock: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Point</Label>
                <Input
                  type="number"
                  min={0}
                  value={(formValues.reorderPoint as number) ?? 0}
                  onChange={(e) => setFormValues((p) => ({ ...p, reorderPoint: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input
                  value={(formValues.supplier as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, supplier: e.target.value }))}
                  placeholder="Supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={(formValues.location as string) ?? ""}
                  onChange={(e) => setFormValues((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Storage location"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
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
                    toast.error("Name and SKU are required");
                    return;
                  }
                  createMutation.mutate(payload);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.name} ({deleteTarget?.sku}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
