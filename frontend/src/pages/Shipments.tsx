import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shipmentsApi, ordersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  ModuleDashboardLayout,
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Truck, Plus, PackageCheck, Search, Loader2, FileText } from "lucide-react";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";
import { toast } from "sonner";

export default function Shipments() {
  const { user } = useAuth();
  const { formatDate } = useEthiopianDateDisplay();
  const qc = useQueryClient();
  const canShip = user?.role === "Admin" || user?.role === "warehouse_head";

  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [lineIdx, setLineIdx] = useState("0");
  const [lineQty, setLineQty] = useState("1");
  const [shipOpen, setShipOpen] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [q, setQ] = useState("");

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
    (o) => o._id === orderId
  );

  const createMut = useMutation({
    mutationFn: () =>
      shipmentsApi.create({
        orderId,
        lines: [{ lineIndex: parseInt(lineIdx, 10) || 0, quantity: parseFloat(lineQty) || 1 }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Shipment draft created");
      setCreateOpen(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      shipmentsApi.updateStatus(id, status),
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

  const filtered = shipments.filter((s) => {
    const num = s.shipmentNumber?.toLowerCase() ?? "";
    const tr = (s.trackingNumber ?? "").toLowerCase();
    const oid = typeof s.order === "object" ? s.order._id : s.order;
    return (
      !q.trim() ||
      num.includes(q.toLowerCase()) ||
      tr.includes(q.toLowerCase()) ||
      String(oid).toLowerCase().includes(q.toLowerCase())
    );
  });

  const statusColor: Record<string, "secondary" | "default" | "success"> = {
    draft: "secondary",
    picked: "default",
    packed: "default",
    shipped: "success",
  };

  return (
    <ModuleDashboardLayout
      title="Shipments"
      description="Pick, pack, ship — partial shipments and tracking. Finance invoices per shipment when applicable."
      icon={Truck}
      healthStats={[
        { label: "Open drafts", value: shipments.filter((s) => s.status !== "shipped").length },
        { label: "Shipped", value: shipments.filter((s) => s.status === "shipped").length },
      ]}
      actions={
        canShip ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-xl font-black uppercase text-xs gap-2">
                <Plus className="h-4 w-4" />
                New shipment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create shipment</DialogTitle>
                <DialogDescription>Approved orders only. Quantities cannot exceed remaining per line.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Order</Label>
                  <Select value={orderId} onValueChange={setOrderId}>
                    <SelectTrigger>
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
                    <Input value={lineIdx} onChange={(e) => setLineIdx(e.target.value)} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!orderId || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  Create draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <Tabs defaultValue="list" className="space-y-6">
        <StickyModuleTabs>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList className={moduleTabsListClassName()}>
              <TabsTrigger value="list" className={moduleTabsTriggerClassName()}>
                <PackageCheck className="h-4 w-4 shrink-0" />
                All shipments
              </TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 h-10 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20"
                placeholder="Search #, tracking, order…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </StickyModuleTabs>

        <TabsContent value="list" className="mt-0">
          <div className="rounded-2xl border border-border/70 bg-background/70 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="pl-6 h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Shipment</TableHead>
                    <TableHead className="h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Order</TableHead>
                    <TableHead className="h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Status</TableHead>
                    <TableHead className="h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Lines</TableHead>
                    <TableHead className="h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Carrier / Tracking</TableHead>
                    <TableHead className="h-12 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Shipped</TableHead>
                    <TableHead className="w-[52px] h-12 text-center text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Note</TableHead>
                    {canShip && <TableHead className="pr-6 h-12 text-right text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canShip ? 8 : 7} className="text-center py-16 text-muted-foreground">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">No shipments match your search.</p>
                          <p className="text-xs">Create a draft shipment from an active order to begin pick-pack-ship flow.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => {
                      const oid = typeof s.order === "object" ? s.order._id : s.order;
                      return (
                        <TableRow key={s._id} className="border-border/50 hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-6 font-mono text-xs font-bold">{s.shipmentNumber}</TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground">
                            …{String(oid).slice(-8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColor[s.status] ?? "secondary"} className="text-[10px] uppercase">
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.lines?.map((l) => `L${l.lineIndex}×${l.quantity}`).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {s.carrier || "—"} {s.trackingNumber ? `· ${s.trackingNumber}` : ""}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {s.shippedAt ? formatDate(s.shippedAt, { withTime: true }) : "—"}
                          </TableCell>
                          <TableCell className="text-center p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
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
                            <TableCell className="pr-6 text-right space-x-1">
                              {s.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px]"
                                  onClick={() => statusMut.mutate({ id: s._id, status: "picked" })}
                                >
                                  Picked
                                </Button>
                              )}
                              {s.status === "picked" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[10px]"
                                  onClick={() => statusMut.mutate({ id: s._id, status: "packed" })}
                                >
                                  Packed
                                </Button>
                              )}
                              {s.status !== "shipped" && (
                                <Button
                                  size="sm"
                                  className="h-8 text-[10px]"
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
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!shipOpen} onOpenChange={(o) => !o && setShipOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm ship</DialogTitle>
            <DialogDescription>Updates order shipped quantities and order status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Carrier</Label>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="UPS, FedEx…" />
            </div>
            <div>
              <Label>Tracking #</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOpen(null)}>
              Cancel
            </Button>
            <Button disabled={shipMut.isPending} onClick={() => shipOpen && shipMut.mutate(shipOpen)}>
              Mark shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleDashboardLayout>
  );
}
