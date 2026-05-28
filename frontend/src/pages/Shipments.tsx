import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shipmentsApi, ordersApi, inventoryApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Plus,
  PackageCheck,
  Search,
  Loader2,
  FileText,
  Layers,
  CheckCircle2,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";

const STATUS_FILTERS = ["all", "draft", "picked", "packed", "shipped"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  draft: "Draft",
  picked: "Picked",
  packed: "Packed",
  shipped: "Shipped",
};

export default function Shipments() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { formatDate } = useEthiopianDateDisplay();
  const qc = useQueryClient();
  const canShip = user?.role === "Admin" || user?.role === "warehouse_head";

  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [lineIdx, setLineIdx] = useState("0");
  const [lineQty, setLineQty] = useState("1");
  const [lineLot, setLineLot] = useState("");
  const [lineSerial, setLineSerial] = useState("");
  const [shipOpen, setShipOpen] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments"],
    queryFn: shipmentsApi.list,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
    enabled: createOpen,
  });

  const selectedOrder = (orders as { _id: string; items: { quantity: number; shippedQty?: number }[] }[]).find(
    (o) => o._id === orderId,
  );

  const { data: products = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
    enabled: !!orderId,
  });

  const selectedLineProduct = (() => {
    if (!selectedOrder) return null;
    const item = selectedOrder.items[parseInt(lineIdx, 10)] as any;
    if (!item) return null;
    return products.find((p: any) => p._id === (item.product?._id || item.product));
  })();

  const createMut = useMutation({
    mutationFn: () =>
      shipmentsApi.create({
        orderId,
        lines: [
          {
            lineIndex: parseInt(lineIdx, 10) || 0,
            quantity: parseFloat(lineQty) || 1,
            lotNumber: lineLot || undefined,
            serialNumber: lineSerial || undefined,
          },
        ],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Shipment draft created");
      setCreateOpen(false);
      setLineLot("");
      setLineSerial("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => shipmentsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Status updated");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const shipMut = useMutation({
    mutationFn: (id: string) => shipmentsApi.ship(id, { carrier, trackingNumber: tracking }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Shipped");
      setShipOpen(null);
      setCarrier("");
      setTracking("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const openCount = shipments.filter((s) => s.status !== "shipped").length;
  const shippedCount = shipments.filter((s) => s.status === "shipped").length;
  const draftCount = shipments.filter((s) => s.status === "draft").length;

  const statusCount = (st: StatusFilter) => {
    if (st === "all") return shipments.length;
    return shipments.filter((s) => s.status === st).length;
  };

  const filtered = shipments.filter((s) => {
    const num = s.shipmentNumber?.toLowerCase() ?? "";
    const tr = (s.trackingNumber ?? "").toLowerCase();
    const oid = typeof s.order === "object" ? s.order._id : s.order;
    const searchOk =
      !q.trim() ||
      num.includes(q.toLowerCase()) ||
      tr.includes(q.toLowerCase()) ||
      String(oid).toLowerCase().includes(q.toLowerCase());
    const statusOk = statusFilter === "all" || s.status === statusFilter;
    return searchOk && statusOk;
  });

  const statusColor: Record<string, "secondary" | "default" | "success"> = {
    draft: "secondary",
    picked: "default",
    packed: "default",
    shipped: "success",
  };

  const newShipmentControl = canShip ? (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 gap-2 rounded-[12px] bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[18px] border border-border/60 shadow-erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1a2744]">Create shipment</DialogTitle>
          <DialogDescription>Approved orders only. Quantities cannot exceed remaining per line.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Order</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger className="h-10 rounded-[12px] border-border/60">
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {(orders as { _id: string; client?: { name: string }; status: string }[])
                  .filter((o) => o.status !== "cancelled")
                  .map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.client?.name ?? "—"} · …{o._id.slice(-6)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {selectedOrder && (
            <p className="text-[10px] text-muted-foreground">
              Lines:{" "}
              {selectedOrder.items.map((it, i) => (
                <span key={i} className="mr-2">
                  #{i}: qty {it.quantity}, shipped {it.shippedQty ?? 0}
                </span>
              ))}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Line index</Label>
              <Input
                className="h-10 rounded-[12px] border-border/60"
                value={lineIdx}
                onChange={(e) => setLineIdx(e.target.value)}
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                className="h-10 rounded-[12px] border-border/60"
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
              />
            </div>
          </div>
          {selectedLineProduct && (selectedLineProduct.trackingMethod === 'batch' || selectedLineProduct.trackingMethod === 'serial') && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 animate-in fade-in slide-in-from-top-1">
              {selectedLineProduct.trackingMethod === 'batch' && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Lot Number</Label>
                  <Input
                    className="h-9 rounded-lg border-border/60 font-mono text-xs uppercase"
                    placeholder="BATCH-ID"
                    value={lineLot}
                    onChange={(e) => setLineLot(e.target.value)}
                  />
                </div>
              )}
              {selectedLineProduct.trackingMethod === 'serial' && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Serial Number</Label>
                  <Input
                    className="h-9 rounded-lg border-border/60 font-mono text-xs uppercase"
                    placeholder="SERIAL-ID"
                    value={lineSerial}
                    onChange={(e) => setLineSerial(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            className="rounded-[12px]"
            disabled={!orderId || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  const filtersCard = (
    <Card className="overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-sm">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Shipment controls
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">Search & filters</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Shipment #, tracking, order id, and lifecycle status
            </p>
          </div>
          {newShipmentControl}
        </div>

        <div className="group relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            className="h-10 rounded-[12px] border-border/60 bg-muted/35 pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
            placeholder="Search #, tracking, order…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-[16px] border border-border/60 bg-muted/35 p-1.5">
          {STATUS_FILTERS.map((key) => {
            const label = key === "all" ? "All" : STATUS_LABELS[key];
            const count = statusCount(key);
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center gap-1 rounded-[12px] px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {label}
                <span
                  className={`rounded-[9px] px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-primary-foreground/20" : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const actionCol = canShip ? 1 : 0;
  const colCount = 7 + actionCol;

  const registerCard = (
    <Card className="overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-sm">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Delivery execution
        </p>
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-black tracking-tight text-foreground">Shipment register</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Pick → pack → ship; delivery note and finance invoicing per shipment when applicable
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/25">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="h-12 pl-6 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Shipment</TableHead>
                  <TableHead className="h-12 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Order</TableHead>
                  <TableHead className="h-12 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
                  <TableHead className="h-12 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Lines</TableHead>
                  <TableHead className="h-12 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Carrier / tracking</TableHead>
                  <TableHead className="h-12 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Shipped</TableHead>
                  <TableHead className="h-12 w-[52px] text-center text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Note</TableHead>
                  {canShip && (
                    <TableHead className="h-12 pr-6 text-right text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="py-16 text-center text-muted-foreground">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">No shipments match your filters.</p>
                        <p className="text-xs">Create a draft from an active order to start pick-pack-ship.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const oid = typeof s.order === "object" ? s.order._id : s.order;
                    return (
                      <TableRow key={s._id} className="border-border/40 transition-colors hover:bg-muted/35">
                        <TableCell className="pl-6 font-mono text-xs font-semibold">{s.shipmentNumber}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">…{String(oid).slice(-8)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={statusColor[s.status] ?? "secondary"}
                            className="rounded-[10px] text-[10px] font-black uppercase"
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {s.lines?.map((l: any, li: number) => (
                            <div key={li} className="flex flex-col gap-0.5">
                              <span>L{l.lineIndex}×{l.quantity}</span>
                              {(l.lotNumber || l.serialNumber) && (
                                <div className="flex gap-1">
                                  {l.lotNumber && <Badge variant="outline" className="h-3 rounded-[6px] px-1 text-[8px]">lot:{l.lotNumber}</Badge>}
                                  {l.serialNumber && <Badge variant="secondary" className="h-3 rounded-[6px] px-1 text-[8px]">sn:{l.serialNumber}</Badge>}
                                </div>
                              )}
                            </div>
                          )) || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {s.carrier || "—"} {s.trackingNumber ? `· ${s.trackingNumber}` : ""}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                          {s.shippedAt ? formatDate(s.shippedAt, { withTime: true }) : "—"}
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[10px] hover:bg-primary/10 hover:text-primary"
                            title="Delivery note (EN + አማርኛ)"
                            onClick={async () => {
                              try {
                                await shipmentsApi.openDeliveryNoteHtml(s._id);
                              } catch {
                                toast.error("Could not open delivery note");
                              }
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        {canShip && (
                          <TableCell className="space-x-1 pr-6 text-right">
                            {s.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-[10px] px-3 text-[10px] font-semibold"
                                onClick={() => statusMut.mutate({ id: s._id, status: "picked" })}
                              >
                                Picked
                              </Button>
                            )}
                            {s.status === "picked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-[10px] px-3 text-[10px] font-semibold"
                                onClick={() => statusMut.mutate({ id: s._id, status: "packed" })}
                              >
                                Packed
                              </Button>
                            )}
                            {s.status !== "shipped" && (
                              <Button
                                size="sm"
                                className="h-8 rounded-[10px] px-3 text-[10px] font-semibold"
                                onClick={() => setShipOpen(s._id)}
                              >
                                Ship
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-8 pb-8 animate-in fade-in duration-500">
        <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(180_65%_28%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="flex flex-col gap-5 border-b border-white/10 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.55)]" />
                <h1 className="text-3xl font-black uppercase italic leading-none tracking-tight text-white sm:text-4xl">
                  {t("pages.shipments.title")}
                </h1>
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/12 text-white ring-1 ring-white/15">
                  <Truck className="h-5 w-5 stroke-[2.5]" aria-hidden />
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/70 sm:ml-5">
                {t("pages.shipments.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-[18px] border border-white/15 bg-white/10 shadow-2xl shadow-black/10 backdrop-blur sm:min-w-[360px]">
              {[
                { label: "Total", value: String(shipments.length) },
                { label: "Open", value: String(openCount) },
                { label: "Shipped", value: String(shippedCount) },
              ].map((stat, index) => (
                <div key={stat.label} className={`px-4 py-3 text-center ${index > 0 ? "border-l border-white/10" : ""}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{stat.label}</p>
                  <p className="mt-1 font-mono text-lg font-black tracking-tight text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                <Sparkles className="h-3.5 w-3.5" />
                Shipment command center
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Pick, pack, and ship from one clean register</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                Monitor shipment drafts, move orders through warehouse stages, and open delivery notes without leaving fulfillment.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Drafts", value: String(draftCount), icon: ClipboardList },
                  { label: "Open pipeline", value: String(openCount), icon: Layers },
                  { label: "Completed", value: String(shippedCount), icon: CheckCircle2 },
                ].map((item) => (
                  <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/[0.09] p-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{item.label}</p>
                        <p className="mt-1 text-xl font-black tracking-tight text-white">{item.value}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/12">
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] border border-white/15 bg-white/[0.09] p-5 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Fulfillment progress</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-white">{shipments.length ? Math.round((shippedCount / shipments.length) * 100) : 0}%</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-white/68">Share of shipments already marked shipped.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/68">
                    <span>Shipped</span>
                    <span>{shippedCount}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${shipments.length ? Math.max(8, (shippedCount / shipments.length) * 100) : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/68">
                    <span>Open pipeline</span>
                    <span>{openCount}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${shipments.length ? Math.max(8, (openCount / shipments.length) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "All shipments",
              value: String(shipments.length),
              icon: Truck,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "Open pipeline",
              value: String(openCount),
              icon: Layers,
              color: "text-warning",
              bg: "bg-warning/10",
            },
            {
              label: "Drafts",
              value: String(draftCount),
              icon: ClipboardList,
              color: "text-muted-foreground",
              bg: "bg-muted/40",
            },
            {
              label: "Shipped",
              value: String(shippedCount),
              icon: CheckCircle2,
              color: "text-success",
              bg: "bg-success/10",
            },
          ].map((stat, idx) => (
            <Card
              key={idx}
              className="group relative overflow-hidden rounded-[16px] border border-border/60 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${stat.bg} ring-1 ring-border/10 transition-transform duration-300 group-hover:scale-105`}
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

        {filtersCard}
        {registerCard}
      </div>

      <Dialog open={!!shipOpen} onOpenChange={(o) => !o && setShipOpen(null)}>
        <DialogContent className="rounded-[18px] border border-border/60 shadow-erp sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">Confirm ship</DialogTitle>
            <DialogDescription>Updates order shipped quantities and order status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Carrier</Label>
              <Input
                className="h-10 rounded-[12px] border-border/60"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="UPS, FedEx…"
              />
            </div>
            <div>
              <Label>Tracking #</Label>
              <Input
                className="h-10 rounded-[12px] border-border/60"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-[12px]" onClick={() => setShipOpen(null)}>
              Cancel
            </Button>
            <Button className="rounded-[12px]" disabled={shipMut.isPending} onClick={() => shipOpen && shipMut.mutate(shipOpen)}>
              Mark shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
