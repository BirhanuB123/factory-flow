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
import { Search, Plus, ShoppingCart, Eye, Trash2 } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Sales orders and fulfillment</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => { setFormClient(""); setFormItems([{ productId: "", quantity: 1, price: 0 }]); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Order
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by client or ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(["pending", "processing", "shipped", "delivered", "cancelled"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((order) => (
                  <TableRow key={order._id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-medium">{order.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{symbol}{order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusVariant[order.status]}>{order.status}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
