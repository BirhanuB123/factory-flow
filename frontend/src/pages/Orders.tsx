import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi, clientsApi, inventoryApi, mrpApi, productionApi, downloadReportCsv } from "@/lib/api";
import { SavedViewsBar } from "@/components/SavedViewsBar";
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
  Search, Plus, ShoppingCart, Eye, Trash2, DollarSign, Layers, Hash, Factory, Package, Link2, Download,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";
import { useLocale } from "@/contexts/LocaleContext";

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
  items: {
    product: { _id: string; name: string; sku?: string };
    quantity: number;
    price: number;
    productionJob?: {
      jobId: string;
      status: string;
      quantity: number;
      materialsReserved?: boolean;
    } | null;
  }[];
  totalAmount: number;
  status: OrderStatus;
  orderDate: string;
}

export default function Orders({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { format, formatAmount, symbol } = useCurrency();
  const { formatDate } = useEthiopianDateDisplay();
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

  const { data: mrpRows = [] } = useQuery({
    queryKey: ["mrp"],
    queryFn: mrpApi.getSuggestions,
  });

  const [reserveQtyByLine, setReserveQtyByLine] = useState<Record<number, number>>({});

  useEffect(() => {
    if (selectedOrder) {
      const next: Record<number, number> = {};
      selectedOrder.items.forEach((_, i) => {
        next[i] = 1;
      });
      setReserveQtyByLine(next);
    }
  }, [selectedOrder?._id]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
      toast.success("Order created");
      setFormOpen(false);
      setFormClient("");
      setFormItems([{ productId: "", quantity: 1, price: 0 }]);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create order");
    },
  });

  const reserveLineMutation = useMutation({
    mutationFn: ({
      orderId,
      lineIndex,
      quantity,
    }: {
      orderId: string;
      lineIndex: number;
      quantity: number;
    }) => ordersApi.reserveLine(orderId, lineIndex, quantity),
    onSuccess: async (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      const fresh = await ordersApi.getOne(v.orderId);
      setSelectedOrder(fresh as Order);
      toast.success("Stock reserved for this line");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Reserve failed");
    },
  });

  const createJobFromOrderMutation = useMutation({
    mutationFn: (body: {
      orderId: string;
      lineIndex: number;
      quantity?: number;
    }) => productionApi.createFromOrder(body),
    onSuccess: async (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      const fresh = await ordersApi.getOne(v.orderId);
      setSelectedOrder(fresh as Order);
      toast.success("Production job linked to order line");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not create job");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => ordersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
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
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
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
  const settledOrders = orders.filter((o: Order) => o.status === "delivered").length;
  const pendingCount = orders.filter((o: Order) => o.status === "pending").length;

  const statusCounts = (orders as Order[]).reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className={`${embedded ? "space-y-6" : "space-y-8"} pb-8 animate-in fade-in duration-500`}>
      {!embedded && (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.orders.title")}</h1>
              <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">{t("pages.orders.subtitle")}</p>
            </div>

            <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Open pipeline</p>
                <p className="text-sm font-semibold text-foreground">{activeOrders}</p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending</p>
                <p className="text-sm font-semibold text-muted-foreground">{pendingCount}</p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delivered</p>
                <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">{settledOrders}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Pipeline depth", value: orders.length, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
              { label: "Active revenue", value: format(totalRev), icon: DollarSign, color: "text-success", bg: "bg-success/10" },
              { label: "In transit", value: shippedToday, icon: Layers, color: "text-info", bg: "bg-info/10" },
              { label: "Unfulfilled", value: activeOrders, icon: Hash, color: "text-warning", bg: "bg-warning/10" },
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

      {/* MRP / demand → supply */}
      <Card className="overflow-hidden rounded-2xl border-0 border-l-4 border-l-amber-500/80 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
          <div className="flex items-center gap-2">
            <Factory className="h-5 w-5 shrink-0 text-amber-500" />
            <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">MRP suggestions</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Open demand with a BOM on the line — reserve FG or create a linked production job.
          </p>
        </CardHeader>
        <CardContent className="p-0 max-h-[280px] overflow-y-auto">
          {mrpRows.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No open demand with a BOM match yet. Create SKUs with an active BOM, then add pending or
                processing orders for those finished goods.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild variant="outline" size="sm" className="h-9 rounded-full border-primary/20">
                  <Link to="/boms">BOMs</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 rounded-full border-primary/20">
                  <Link to="/inventory">Inventory</Link>
                </Button>
                <Button asChild variant="secondary" size="sm" className="h-9 rounded-full">
                  <Link to="/production-jobs">Production jobs</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/25">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="h-11 pl-4 text-xs font-bold text-foreground">Client</TableHead>
                  <TableHead className="h-11 text-xs font-bold text-foreground">SKU</TableHead>
                  <TableHead className="h-11 text-right text-xs font-bold text-foreground">Order</TableHead>
                  <TableHead className="h-11 text-right text-xs font-bold text-foreground">ATP</TableHead>
                  <TableHead className="h-11 text-right text-xs font-bold text-foreground">Suggest make</TableHead>
                  <TableHead className="h-11 pr-4 text-xs font-bold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mrpRows.slice(0, 12).map((row, idx) => (
                  <TableRow key={`${row.orderId}-${row.lineIndex}-${idx}`} className="border-border/40">
                    <TableCell className="pl-4 text-xs font-medium">{row.clientName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="text-right text-xs">{row.orderQty}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{row.availableToPromise}</TableCell>
                    <TableCell className="text-right text-xs font-semibold text-amber-600">{row.suggestedMakeQty}</TableCell>
                    <TableCell className="pr-4">
                      {row.suggestedMakeQty > 0 && !row.productionJobId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 rounded-full border-amber-500/30 text-[10px] font-semibold"
                          disabled={createJobFromOrderMutation.isPending}
                          onClick={() =>
                            createJobFromOrderMutation.mutate({
                              orderId: row.orderId,
                              lineIndex: row.lineIndex,
                              quantity: Math.min(row.suggestedMakeQty, row.orderQty),
                            })
                          }
                        >
                          <Link2 className="h-3 w-3" /> Job
                        </Button>
                      )}
                      {row.productionJobId && (
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          Linked
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Search & filters */}
      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#1a2744]">
                {embedded ? "Order library" : "Search & filters"}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {embedded ? "Filter and open sales orders" : "Lifecycle chips, saved views, and export"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-10 gap-2 rounded-full border-primary/20 shadow-erp-sm"
                onClick={() =>
                  downloadReportCsv("/reports/export/orders", `orders-${Date.now()}.csv`).catch(() =>
                    toast.error("Export failed (check permissions)")
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                onClick={() => {
                  setFormClient("");
                  setFormItems([{ productId: "", quantity: 1, price: 0 }]);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New order
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="group relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search by client or system identifier..."
                className="h-10 rounded-full border-0 bg-[#EEF2F7] pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 p-1">
              {(
                [
                  { key: "all" as const, label: "All" },
                  { key: "pending" as const, label: "Pending" },
                  { key: "processing" as const, label: "Processing" },
                  { key: "shipped" as const, label: "Shipped" },
                  { key: "delivered" as const, label: "Delivered" },
                  { key: "cancelled" as const, label: "Cancelled" },
                ] as const
              ).map(({ key, label }) => {
                const count =
                  key === "all" ? orders.length : (statusCounts[key as OrderStatus] ?? 0);
                const active = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
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
          </div>
          <SavedViewsBar
            module="orders"
            filters={{ search, statusFilter }}
            onApply={(f) => {
              if (f.search != null) setSearch(String(f.search));
              if (f.statusFilter != null) setStatusFilter(String(f.statusFilter));
            }}
          />
        </CardContent>
      </Card>

      {/* Order register */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Order register</CardTitle>
          <p className="text-sm font-medium text-muted-foreground">
            Click a row for lines, reservations, production links, and status
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/25">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="h-12 pl-6 text-xs font-bold text-foreground">System ID</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Customer</TableHead>
                  <TableHead className="h-12 text-right text-xs font-bold text-foreground">Total</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Status</TableHead>
                  <TableHead className="hidden h-12 text-xs font-bold text-foreground md:table-cell">Order date</TableHead>
                  <TableHead className="h-12 w-[80px] pr-6 text-xs font-bold text-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-20 text-center font-medium text-muted-foreground">
                      Loading orders…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <div className="mx-auto max-w-md space-y-3 text-muted-foreground">
                        <p className="text-sm font-medium">No orders match the current filters.</p>
                        <p className="text-xs">
                          Add clients and products, then create an order. Use MRP above to reserve stock or create jobs.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                            <Link to="/clients">Clients</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                            <Link to="/inventory">Products</Link>
                          </Button>
                          <Button asChild variant="secondary" size="sm" className="h-9 rounded-full">
                            <Link to="/sme-bundle">SME workflow</Link>
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order) => (
                    <TableRow
                      key={order._id}
                      className="group/row cursor-pointer border-border/40 transition-colors hover:bg-muted/35"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell className="pl-6 font-mono text-[10px] font-medium text-muted-foreground opacity-60 transition-opacity group-hover/row:opacity-100">
                        {order._id.slice(-6)}
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] font-semibold tracking-tight text-foreground">
                          {order.client?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-semibold text-[hsl(152,69%,36%)]">
                        {format(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[order.status]}
                          className="rounded-md px-2 py-0 text-[10px] font-semibold capitalize"
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-[11px] font-medium text-muted-foreground md:table-cell">
                        {formatDate(order.orderDate)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full opacity-0 transition-all group-hover/row:opacity-100 hover:bg-primary/10 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 shadow-erp sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#1a2744]">
              <ShoppingCart className="h-5 w-5 shrink-0 text-primary" />
              Order {selectedOrder?._id.slice(-6)}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.client?.name} · {selectedOrder ? format(selectedOrder.totalAmount) : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label>Status</Label>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => updateMutation.mutate({ id: selectedOrder._id, data: { status: value } })}
                >
                  <SelectTrigger className="w-[160px] rounded-full border-border/60 bg-muted/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["pending", "processing", "shipped", "delivered", "cancelled"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  Delivered/cancelled releases FG reservations.
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="min-w-[200px]">Supply</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item, i) => {
                      const canSupply =
                        selectedOrder.status === "pending" || selectedOrder.status === "processing";
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="font-medium">{item.product?.name ?? "—"}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{item.product?.sku}</div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{symbol}{formatAmount(item.price)}</TableCell>
                          <TableCell className="text-right">{symbol}{formatAmount(item.quantity * item.price)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              {item.productionJob && (
                                <Badge variant="outline" className="w-fit text-[10px] gap-1">
                                  <Factory className="h-3 w-3" />
                                  {item.productionJob.jobId} · {item.productionJob.status}
                                </Badge>
                              )}
                              {canSupply && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    className="h-8 w-14 text-xs"
                                    value={reserveQtyByLine[i] ?? 1}
                                    onChange={(e) =>
                                      setReserveQtyByLine((p) => ({
                                        ...p,
                                        [i]: parseInt(e.target.value, 10) || 1,
                                      }))
                                    }
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 text-[10px]"
                                    disabled={reserveLineMutation.isPending}
                                    onClick={() =>
                                      reserveLineMutation.mutate({
                                        orderId: selectedOrder._id,
                                        lineIndex: i,
                                        quantity: Math.min(
                                          reserveQtyByLine[i] ?? 1,
                                          item.quantity
                                        ),
                                      })
                                    }
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Reserve FG
                                  </Button>
                                  {!item.productionJob && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-[10px]"
                                      disabled={createJobFromOrderMutation.isPending}
                                      onClick={() =>
                                        createJobFromOrderMutation.mutate({
                                          orderId: selectedOrder._id,
                                          lineIndex: i,
                                          quantity: item.quantity,
                                        })
                                      }
                                    >
                                      Create job
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">Order date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full"
              onClick={() => selectedOrder && setDeleteTarget(selectedOrder)}
            >
              Delete order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 shadow-erp sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1a2744]">New order</DialogTitle>
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
                          <SelectItem key={prod._id} value={prod._id}>
                            {prod.name} ({format(prod.price)})
                          </SelectItem>
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
            <p className="text-sm font-medium">Total: {format(totalAmount)}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (!formClient) { toast.error("Select a client"); return; }
                const items = formItems.filter((r) => r.productId && r.quantity > 0).map((r) => ({ product: r.productId, quantity: r.quantity, price: r.price }));
                if (items.length === 0) { toast.error("Add at least one line item"); return; }
                const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
                createMutation.mutate({ client: formClient, items, totalAmount: total });
              }}
              disabled={createMutation.isPending}
            >
              Create order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl border border-border/60 shadow-erp">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this order. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
