import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi, clientsApi, inventoryApi } from "@/lib/api";
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
import { Search, Plus, ShoppingCart, Eye, Trash2, DollarSign, Layers, Hash } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const statusVariant: Record<OrderStatus, "secondary" | "default" | "success" | "destructive"> = {
  pending: "secondary",
  processing: "default",
  shipped: "default",
  delivered: "success",
  cancelled: "destructive",
};

interface OrderItemRow {
  productId: string;
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  client: { _id: string; name: string };
  items: { product: { _id: string; name: string }; quantity: number; price: number }[];
  totalAmount: number;
  status: OrderStatus;
  orderDate: string;
}

export default function Orders() {
  const queryClient = useQueryClient();
  const { symbol } = useCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [formClient, setFormClient] = useState("");
  const [formItems, setFormItems] = useState<OrderItemRow[]>([{ productId: "", quantity: 1, price: 0 }]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: clientsApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order created");
      setFormOpen(false);
      setFormClient("");
      setFormItems([{ productId: "", quantity: 1, price: 0 }]);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create order");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => ordersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
      setSelectedOrder(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update order");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ordersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order deleted");
      setDeleteTarget(null);
      setSelectedOrder(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to delete order");
    },
  });

  const filtered = (orders as Order[]).filter((o) => {
    const matchSearch =
      (o.client?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      o._id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = formItems.reduce((sum, row) => sum + row.quantity * row.price, 0);

  const activeOrders = orders.filter((o: Order) => o.status !== "delivered" && o.status !== "cancelled").length;
  const totalRev = orders.reduce((sum: number, o: Order) => sum + (o.totalAmount || 0), 0);
  const shippedToday = orders.filter((o: Order) => o.status === "shipped").length; // Simplified for demo

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-1 px-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase">Order Pipeline</h1>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Logistics, fulfillment status, and lifecycle monitoring</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pipeline Depth", value: orders.length, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active Revenue", value: `${symbol}${totalRev.toLocaleString()}`, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
          { label: "Orders in Transit", value: shippedToday, icon: Layers, color: "text-info", bg: "bg-info/10" },
          { label: "Unfulfilled", value: activeOrders, icon: Hash, color: "text-warning", bg: "bg-warning/10" }
        ].map((stat, idx) => (
          <Card key={idx} className="border-none shadow-md bg-card/60 backdrop-blur-md overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full blur-3xl opacity-10 ${stat.bg}`} />
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-black tracking-tighter">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Container */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-6 border-b border-white/5 bg-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-primary rounded-full" />
                <CardTitle className="text-xl font-black tracking-tighter uppercase italic">Sales Log</CardTitle>
              </div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide">Customer orders, fulfillment status, and logistics</p>
            </div>
            <Button 
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl px-6 h-11 transition-all hover:-translate-y-0.5" 
              onClick={() => { setFormClient(""); setFormItems([{ productId: "", quantity: 1, price: 0 }]); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4" /> 
              <span className="font-bold">Register New Order</span>
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-6">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search by client or system identifier..."
                className="pl-10 bg-background/50 border-border/50 focus-visible:ring-primary/20 h-11 rounded-xl transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px] bg-background/50 border-border/50 h-11 rounded-xl">
                <SelectValue placeholder="Lifecycle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Global Pipeline</SelectItem>
                {(["pending", "processing", "shipped", "delivered", "cancelled"] as const).map((s) => (
                  <SelectItem key={s} value={s} className="uppercase font-bold text-[10px] tracking-widest">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground pl-6 h-12">System ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12">Customer Account</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 text-right">Total Value</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12">Fulfillment</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden md:table-cell">Dispatch Date</TableHead>
                  <TableHead className="w-[80px] pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium italic">
                      Polling sales network...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">
                      No matching transactions in central log.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order) => (
                    <TableRow 
                      key={order._id} 
                      className="cursor-pointer transition-colors hover:bg-white/5 border-white/5 group/row" 
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell className="pl-6 font-mono text-[10px] font-bold text-muted-foreground opacity-50 group-hover/row:opacity-100 transition-opacity">
                        {order._id.slice(-6)}
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-[13px] tracking-tight text-foreground">{order.client?.name ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-black text-success">
                        {symbol}{order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status]} className="text-[10px] font-black uppercase tracking-tight py-0 px-2 rounded-md">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-bold text-[11px] italic">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg opacity-0 group-hover/row:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground" 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order {selectedOrder?._id.slice(-6)}
            </DialogTitle>
            <DialogDescription>{selectedOrder?.client?.name} · {symbol}{selectedOrder?.totalAmount.toLocaleString()}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Label>Status</Label>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => updateMutation.mutate({ id: selectedOrder._id, data: { status: value } })}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pending", "processing", "shipped", "delivered", "cancelled"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.product?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{symbol}{item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{symbol}{(item.quantity * item.price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">Order date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => selectedOrder && setDeleteTarget(selectedOrder)}>Delete Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
            <DialogDescription>Create a sales order for a client.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {(clients as { _id: string; name: string }[]).map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Line items</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {formItems.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 p-2">
                    <Select
                      value={row.productId}
                      onValueChange={(v) => {
                        const prod = (products as { _id: string; name: string; price: number }[]).find((p) => p._id === v);
                        setFormItems((p) => p.map((r, j) => (j === i ? { ...r, productId: v, price: prod?.price ?? 0 } : r)));
                      }}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {(products as { _id: string; name: string; price: number }[]).map((prod) => (
                          <SelectItem key={prod._id} value={prod._id}>{prod.name} ({symbol}{prod.price})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={row.quantity}
                      onChange={(e) => setFormItems((p) => p.map((r, j) => (j === i ? { ...r, quantity: parseInt(e.target.value, 10) || 1 } : r)))}
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-24"
                      value={row.price}
                      onChange={(e) => setFormItems((p) => p.map((r, j) => (j === i ? { ...r, price: parseFloat(e.target.value) || 0 } : r)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setFormItems((p) => p.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="p-2">
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setFormItems((p) => [...p, { productId: "", quantity: 1, price: 0 }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-sm font-medium">Total: {symbol}{totalAmount.toFixed(2)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formClient) { toast.error("Select a client"); return; }
                const items = formItems.filter((r) => r.productId && r.quantity > 0).map((r) => ({ product: r.productId, quantity: r.quantity, price: r.price }));
                if (items.length === 0) { toast.error("Add at least one line item"); return; }
                const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
                createMutation.mutate({ client: formClient, items, totalAmount: total });
              }}
              disabled={createMutation.isPending}
            >
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this order. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
