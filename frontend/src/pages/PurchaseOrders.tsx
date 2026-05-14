import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, inventoryApi, apApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
import { toast } from "sonner";
import {
  Plus,
  Truck,
  CheckCircle,
  Package,
  Ban,
  FileText,
  Search,
  Clock,
  AlertCircle,
  Receipt,
  ShipWheel,
} from "lucide-react";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { useCurrency } from "@/hooks/use-currency";
import { submitPoReceiveWhenOnline } from "@/lib/offlineCriticalActions";

const PERM = {
  create: "po:create",
  approve: "po:approve",
  receive: "po:receive",
  cancel: "po:cancel",
};

const SHOW_LEGACY_PURCHASE_ORDER_TABLE = false;

type POStatus = "draft" | "approved" | "partial_received" | "received" | "cancelled";
type POStatusFilter = "all" | POStatus;

interface POLine {
  _id?: string;
  product: { _id: string; name: string; sku: string };
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  trackingMethod?: "batch" | "serial" | string;
  hasExpiry?: boolean;
}

interface LineInvCost {
  lineIndex: number;
  baseFunctional: number;
  landedPerUnit: number;
  inventoryUnitCost: number;
}

interface PO {
  _id: string;
  poNumber: string;
  supplierName: string;
  status: POStatus;
  lines: POLine[];
  notes?: string;
  supplyType?: "local" | "import";
  importFreight?: number;
  importDuty?: number;
  importClearing?: number;
  landedCostAllocation?: "none" | "by_value" | "by_quantity";
  invoiceCurrency?: string;
  fxRateToFunctional?: number;
  lcReference?: string;
  lcBank?: string;
  lcAmount?: number | null;
  lcCurrency?: string;
  lcExpiry?: string | null;
  landedCostPoolTotal?: number;
  lineInventoryCosts?: LineInvCost[];
}

function poLineTotal(po: PO) {
  return (po.lines || []).reduce((s, l) => s + l.quantityOrdered * (l.unitCost || 0), 0);
}

/** Extended value in functional (ETB) for display */
function poLineTotalFunctional(po: PO) {
  const fx = po.fxRateToFunctional && po.fxRateToFunctional > 0 ? po.fxRateToFunctional : 1;
  return (po.lines || []).reduce((s, l) => s + l.quantityOrdered * (l.unitCost || 0) * fx, 0);
}

function receivedProgress(po: PO) {
  const ordered = (po.lines || []).reduce((s, l) => s + (Number(l.quantityOrdered) || 0), 0);
  const received = (po.lines || []).reduce((s, l) => s + (Number(l.quantityReceived) || 0), 0);
  if (!ordered) return 0;
  return Math.min(100, Math.round((received / ordered) * 100));
}

function statusLabel(status: POStatus) {
  return status.replace("_", " ");
}

function statusBadgeClass(status: POStatus) {
  switch (status) {
    case "draft":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "approved":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "partial_received":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "received":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export default function PurchaseOrders() {
  const { t } = useLocale();
  const { format } = useCurrency();
  const { can, user } = useAuth();
  const canPickVendor =
    user?.role === "Admin" || user?.role === "finance_head" || user?.role === "finance_viewer";
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<PO | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [vendorId, setVendorId] = useState<string>("");
  const [lineRows, setLineRows] = useState<{ productId: string; qty: number; unitCost: number }[]>([
    { productId: "", qty: 1, unitCost: 0 },
  ]);
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});
  const [receiveLot, setReceiveLot] = useState<Record<number, string>>({});
  const [receiveBatch, setReceiveBatch] = useState<Record<number, string>>({});
  const [receiveSerial, setReceiveSerial] = useState<Record<number, string>>({});
  const [receiveExpiry, setReceiveExpiry] = useState<Record<number, string>>({});
  const [sourcingOpen, setSourcingOpen] = useState(false);
  const [supplyType, setSupplyType] = useState<"local" | "import">("local");
  const [importFreight, setImportFreight] = useState(0);
  const [importDuty, setImportDuty] = useState(0);
  const [importClearing, setImportClearing] = useState(0);
  const [landedAlloc, setLandedAlloc] = useState<"none" | "by_value" | "by_quantity">("none");
  const [invoiceCurrency, setInvoiceCurrency] = useState("ETB");
  const [fxRate, setFxRate] = useState(1);
  const [lcRef, setLcRef] = useState("");
  const [lcBank, setLcBank] = useState("");
  const [lcAmt, setLcAmt] = useState<string>("");
  const [lcCurr, setLcCurr] = useState("");
  const [lcExp, setLcExp] = useState("");
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["ap-vendors-po"],
    queryFn: apApi.listVendorsAll,
    enabled: formOpen && canPickVendor,
  });

  useEffect(() => {
    if (selected && ["approved", "partial_received"].includes(selected.status)) {
      const m: Record<number, number> = {};
      selected.lines.forEach((l, i) => {
        m[i] = Math.max(0, l.quantityOrdered - l.quantityReceived);
      });
      setReceiveQty(m);
      setReceiveLot({});
      setReceiveBatch({});
      setReceiveSerial({});
      setReceiveExpiry({});
    }
  }, [selected]);

  const createMut = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.create({
        supplierName,
        vendor: vendorId || undefined,
        supplyType,
        lines: lineRows
          .filter((r) => r.productId)
          .map((r) => ({
            product: r.productId,
            quantityOrdered: r.qty,
            unitCost: r.unitCost,
          })),
        importFreight,
        importDuty,
        importClearing,
        landedCostAllocation: landedAlloc,
        invoiceCurrency: invoiceCurrency.trim() || "ETB",
        fxRateToFunctional: fxRate > 0 ? fxRate : 1,
        lcReference: lcRef.trim() || undefined,
        lcBank: lcBank.trim() || undefined,
        lcAmount: lcAmt.trim() === "" ? null : Number(lcAmt),
        lcCurrency: lcCurr.trim() || undefined,
        lcExpiry: lcExp.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      toast.success("PO created (draft)");
      setFormOpen(false);
      resetForm();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message || "Create failed");
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("PO approved — ready to receive");
      setSelected(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message || "Approve failed");
    },
  });

  const receiveMut = useMutation({
    mutationFn: ({
      id,
      receipts,
    }: {
      id: string;
      receipts: { lineIndex: number; quantity: number; lotNumber?: string; batchNumber?: string }[];
    }) => submitPoReceiveWhenOnline(id, receipts),
    onSuccess: (result) => {
      if (result.queued) {
        toast.success("Receipt queued — will post when you’re back online. Tap Sync in the top bar.");
        setSelected(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      toast.success("Receipt posted to stock ledger");
      setSelected(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message || "Receive failed");
    },
  });

  const patchSourcingMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, string | number | null | undefined>;
    }) => purchaseOrdersApi.patchSourcing(id, body),
    onSuccess: (data: PO) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Sourcing / landed cost updated");
      setSourcingOpen(false);
      setSelected(data);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message || "Update failed");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("PO cancelled");
      setSelected(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message || "Cancel failed");
    },
  });

  function resetForm() {
    setSupplierName("");
    setVendorId("");
    setLineRows([{ productId: "", qty: 1, unitCost: 0 }]);
    setSupplyType("local");
    setImportFreight(0);
    setImportDuty(0);
    setImportClearing(0);
    setLandedAlloc("none");
    setInvoiceCurrency("ETB");
    setFxRate(1);
    setLcRef("");
    setLcBank("");
    setLcAmt("");
    setLcCurr("");
    setLcExp("");
  }

  function openSourcingEditor(po: PO) {
    setSupplyType(po.supplyType === "import" ? "import" : "local");
    setImportFreight(po.importFreight ?? 0);
    setImportDuty(po.importDuty ?? 0);
    setImportClearing(po.importClearing ?? 0);
    setLandedAlloc(po.landedCostAllocation ?? (po.supplyType === "import" ? "by_value" : "none"));
    setInvoiceCurrency(po.invoiceCurrency || "ETB");
    setFxRate(po.fxRateToFunctional && po.fxRateToFunctional > 0 ? po.fxRateToFunctional : 1);
    setLcRef(po.lcReference || "");
    setLcBank(po.lcBank || "");
    setLcAmt(po.lcAmount != null ? String(po.lcAmount) : "");
    setLcCurr(po.lcCurrency || "");
    setLcExp(po.lcExpiry ? String(po.lcExpiry).slice(0, 10) : "");
    setSourcingOpen(true);
  }

  function buildSourcingPayload() {
    return {
      supplyType,
      importFreight,
      importDuty,
      importClearing,
      landedCostAllocation: landedAlloc,
      invoiceCurrency: invoiceCurrency.trim() || "ETB",
      fxRateToFunctional: fxRate > 0 ? fxRate : 1,
      lcReference: lcRef.trim(),
      lcBank: lcBank.trim(),
      lcAmount: lcAmt.trim() === "" ? null : Number(lcAmt),
      lcCurrency: lcCurr.trim(),
      lcExpiry: lcExp.trim() || null,
    };
  }

  function openReceive(po: PO) {
    const m: Record<number, number> = {};
    po.lines.forEach((l, i) => {
      const rem = l.quantityOrdered - l.quantityReceived;
      m[i] = rem > 0 ? rem : 0;
    });
    setReceiveQty(m);
    setReceiveLot({});
    setReceiveBatch({});
    setReceiveSerial({});
    setReceiveExpiry({});
    setSelected(po);
  }

  const purchaseOrders = useMemo(() => (pos as PO[]) || [], [pos]);
  const procurementStats = useMemo(() => {
    const totalFunctional = purchaseOrders.reduce((sum, po) => sum + poLineTotalFunctional(po), 0);
    const open = purchaseOrders.filter((p) => p.status !== "received" && p.status !== "cancelled");
    const toReceive = purchaseOrders.filter((p) => ["approved", "partial_received"].includes(p.status));
    const imports = purchaseOrders.filter((p) => p.supplyType === "import" && p.status !== "received" && p.status !== "cancelled");

    return {
      totalFunctional,
      openCount: open.length,
      draftCount: purchaseOrders.filter((p) => p.status === "draft").length,
      toReceiveCount: toReceive.length,
      importCount: imports.length,
      receivedCount: purchaseOrders.filter((p) => p.status === "received").length,
    };
  }, [purchaseOrders]);

  const filteredPurchaseOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      const matchesSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        (po.invoiceCurrency || "").toLowerCase().includes(q) ||
        (po.lines || []).some((l) =>
          `${l.product?.sku || ""} ${l.product?.name || ""}`.toLowerCase().includes(q)
        );
      return matchesStatus && matchesSearch;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  return (
    <ModuleDashboardLayout
      title={t("pages.purchasing.title")}
      description={t("pages.purchasing.subtitle")}
      icon={Truck}
      actions={
        can(PERM.create) ? (
          <Button
            className="h-11 rounded-xl font-black uppercase text-xs gap-2"
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("pages.purchasing.newPo")}
          </Button>
        ) : null
      }
      healthStats={[
        {
          label: t("pages.purchasing.openPos"),
          value: String(procurementStats.openCount),
        },
        {
          label: t("pages.purchasing.draftPos"),
          value: String(procurementStats.draftCount),
        },
        {
          label: t("pages.purchasing.toReceive"),
          value: String(procurementStats.toReceiveCount),
        },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Commitment
                  </p>
                  <p className="mt-2 truncate text-2xl font-black tracking-tight">
                    {format(procurementStats.totalFunctional)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Functional value across all POs</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Awaiting Receipt
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">{procurementStats.toReceiveCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Approved or partially received</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Drafts
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">{procurementStats.draftCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Need review and approval</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Active Imports
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">{procurementStats.importCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Import POs still open</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                  <ShipWheel className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                  <FileText className="h-5 w-5 text-primary" /> Purchase orders
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review, approve, and receive supplier orders into stock.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search PO, supplier, SKU"
                    className="h-10 pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as POStatusFilter)}>
                  <SelectTrigger className="h-10 sm:w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="partial_received">Partial received</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead className="min-w-[210px] pl-5">Purchase order</TableHead>
                    <TableHead className="min-w-[180px]">Supplier</TableHead>
                    <TableHead className="min-w-[190px]">Progress</TableHead>
                    <TableHead className="min-w-[150px] text-right">Value</TableHead>
                    <TableHead className="min-w-[210px]">Status</TableHead>
                    <TableHead className="min-w-[150px] pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <p className="text-sm font-medium">Loading purchase orders...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : purchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="mx-auto max-w-md space-y-4 text-muted-foreground">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">No purchase orders yet</p>
                            <p className="text-sm">
                              {can(PERM.create)
                                ? "Create a draft, approve it, then receive materials into inventory."
                                : "Purchase orders will appear here once your team creates them."}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <Button asChild variant="outline" size="sm" className="h-9">
                              <Link to="/inventory">Inventory / SKUs</Link>
                            </Button>
                            {canPickVendor && (
                              <Button asChild variant="outline" size="sm" className="h-9">
                                <Link to="/finance">Finance & vendors</Link>
                              </Button>
                            )}
                            <Button asChild variant="secondary" size="sm" className="h-9">
                              <Link to="/sme-bundle">SME workflow</Link>
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredPurchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center">
                        <div className="mx-auto max-w-sm space-y-3 text-muted-foreground">
                          <AlertCircle className="mx-auto h-8 w-8" />
                          <p className="text-sm font-medium">No purchase orders match the current filters.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("all");
                            }}
                          >
                            Clear filters
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchaseOrders.map((po) => {
                      const progress = receivedProgress(po);
                      return (
                        <TableRow
                          key={po._id}
                          className="cursor-pointer align-top hover:bg-muted/30"
                          onClick={() => setSelected(po)}
                        >
                          <TableCell className="pl-5">
                            <div className="space-y-1">
                              <div className="font-mono text-sm font-black text-foreground">{po.poNumber}</div>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="rounded-md text-[10px] font-black uppercase">
                                  {po.lines?.length ?? 0} lines
                                </Badge>
                                {po.supplyType === "import" && (
                                  <Badge className="rounded-md bg-sky-600 text-[10px] font-black uppercase">
                                    Import
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[260px] truncate text-sm font-semibold">{po.supplierName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {(po.invoiceCurrency || "ETB").toUpperCase()} invoice
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-semibold text-muted-foreground">Received</span>
                                <span className="font-mono font-black">{progress}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-mono text-sm font-black">{format(poLineTotal(po))}</div>
                            {(po.invoiceCurrency && po.invoiceCurrency !== "ETB") ||
                            (po.fxRateToFunctional && po.fxRateToFunctional !== 1) ? (
                              <div className="text-[10px] text-muted-foreground">
                                ETB {format(poLineTotalFunctional(po))}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant="outline"
                                className={`rounded-md text-[10px] font-black uppercase ${statusBadgeClass(po.status)}`}
                              >
                                {statusLabel(po.status)}
                              </Badge>
                              {(po.landedCostPoolTotal ?? 0) > 0 && (
                                <Badge variant="secondary" className="rounded-md text-[10px] font-mono">
                                  Landed {format(po.landedCostPoolTotal ?? 0)}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {po.status === "draft" && can(PERM.approve) && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 gap-1.5"
                                  onClick={() => approveMut.mutate(po._id)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Approve
                                </Button>
                              )}
                              {["approved", "partial_received"].includes(po.status) && can(PERM.receive) && (
                                <Button size="sm" className="h-8 gap-1.5" onClick={() => openReceive(po)}>
                                  <Package className="h-3.5 w-3.5" /> Receive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {SHOW_LEGACY_PURCHASE_ORDER_TABLE && (
      <Card className="border-none shadow-xl bg-card/60 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
            <FileText className="h-5 w-5" /> Purchase orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Value (inv.)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (pos as PO[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14">
                    <div className="max-w-md mx-auto space-y-3 text-muted-foreground">
                      <p className="text-sm font-medium">
                        No purchase orders yet.
                        {can(PERM.create) ? " Create a draft, approve it, then receive into stock." : ""}
                      </p>
                      <p className="text-xs">
                        PO lines need SKUs from inventory. Optional: maintain vendor master in Finance for
                        bill-from-PO.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <Button asChild variant="outline" size="sm" className="h-8">
                          <Link to="/inventory">Inventory / SKUs</Link>
                        </Button>
                        {canPickVendor && (
                          <Button asChild variant="outline" size="sm" className="h-8">
                            <Link to="/finance">Finance & vendors</Link>
                          </Button>
                        )}
                        <Button asChild variant="secondary" size="sm" className="h-8">
                          <Link to="/sme-bundle">SME workflow</Link>
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (pos as PO[]).map((po) => (
                  <TableRow key={po._id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(po)}>
                    <TableCell className="pl-6 font-mono font-bold">{po.poNumber}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>{po.lines?.length ?? 0}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      <div>{format(poLineTotal(po))}</div>
                      {(po.invoiceCurrency && po.invoiceCurrency !== "ETB") || (po.fxRateToFunctional && po.fxRateToFunctional !== 1) ? (
                        <div className="text-[10px] text-muted-foreground font-normal">
                          ≈ {format(poLineTotalFunctional(po))} ETB
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] uppercase font-black">
                          {po.status.replace("_", " ")}
                        </Badge>
                        {po.supplyType === "import" && (
                          <Badge className="text-[10px] uppercase font-black bg-amber-600">Import</Badge>
                        )}
                        {(po.landedCostPoolTotal ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            Landed {format(po.landedCostPoolTotal ?? 0)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      {po.status === "draft" && can(PERM.approve) && (
                        <Button size="sm" variant="secondary" className="h-8" onClick={() => approveMut.mutate(po._id)}>
                          Approve
                        </Button>
                      )}
                      {["approved", "partial_received"].includes(po.status) && can(PERM.receive) && (
                        <Button size="sm" className="h-8" onClick={() => openReceive(po)}>
                          <Package className="h-3.5 w-3.5 mr-1" /> Receive
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>Draft — approve before receiving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Vendor name" />
            </div>
            {canPickVendor && (
              <div className="space-y-2">
                <Label>Vendor master (AP)</Label>
                <Select value={vendorId || "__none__"} onValueChange={(v) => setVendorId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional — for bill-from-PO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(vendors as { _id: string; code: string; name: string }[]).map((v) => (
                      <SelectItem key={v._id} value={v._id}>
                        {v.code} — {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Lines</Label>
              {lineRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <Select
                    value={row.productId || "__"}
                    onValueChange={(v) =>
                      setLineRows((p) => p.map((r, j) => (j === i ? { ...r, productId: v === "__" ? "" : v } : r)))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__">Select…</SelectItem>
                      {(products as ProductOption[]).map((pr) => (
                        <SelectItem key={pr._id} value={pr._id}>
                          {pr.sku} — {pr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={row.qty}
                    onChange={(e) =>
                      setLineRows((p) => p.map((r, j) => (j === i ? { ...r, qty: parseInt(e.target.value, 10) || 1 } : r)))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-24"
                    placeholder="Cost"
                    value={row.unitCost}
                    onChange={(e) =>
                      setLineRows((p) =>
                        p.map((r, j) => (j === i ? { ...r, unitCost: parseFloat(e.target.value) || 0 } : r))
                      )
                    }
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setLineRows((p) => [...p, { productId: "", qty: 1, unitCost: 0 }])}>
                + Line
              </Button>
            </div>
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <p className="text-xs font-black uppercase text-muted-foreground">Sourcing & import (Ethiopia)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Supply</Label>
                  <Select
                    value={supplyType}
                    onValueChange={(v) => {
                      const t = v as "local" | "import";
                      setSupplyType(t);
                      if (t === "import") setLandedAlloc((a) => (a === "none" ? "by_value" : a));
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Landed allocation</Label>
                  <Select value={landedAlloc} onValueChange={(v) => setLandedAlloc(v as typeof landedAlloc)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="by_value">By line value</SelectItem>
                      <SelectItem value="by_quantity">By qty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice currency</Label>
                  <Input className="h-9 font-mono" value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value.toUpperCase())} placeholder="ETB" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FX → ETB</Label>
                  <Input type="number" min={0} step={0.0001} className="h-9" value={fxRate} onChange={(e) => setFxRate(parseFloat(e.target.value) || 1)} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Line unit costs are in invoice currency. Stock cost = unit × FX + allocated landed (ETB).</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Freight (ETB)</Label>
                  <Input type="number" min={0} step={0.01} className="h-9" value={importFreight} onChange={(e) => setImportFreight(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duty (ETB)</Label>
                  <Input type="number" min={0} step={0.01} className="h-9" value={importDuty} onChange={(e) => setImportDuty(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Clearing (ETB)</Label>
                  <Input type="number" min={0} step={0.01} className="h-9" value={importClearing} onChange={(e) => setImportClearing(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder="LC reference" value={lcRef} onChange={(e) => setLcRef(e.target.value)} className="h-8" />
                <Input placeholder="LC bank" value={lcBank} onChange={(e) => setLcBank(e.target.value)} className="h-8" />
                <Input placeholder="LC amount" type="number" value={lcAmt} onChange={(e) => setLcAmt(e.target.value)} className="h-8" />
                <Input placeholder="LC ccy" value={lcCurr} onChange={(e) => setLcCurr(e.target.value.toUpperCase())} className="h-8" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!supplierName.trim() || createMut.isPending}
              onClick={() => {
                if (!lineRows.some((r) => r.productId)) {
                  toast.error("Add at least one line");
                  return;
                }
                createMut.mutate();
              }}
            >
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{selected.poNumber}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-2 items-center">
                  {selected.supplierName}
                  {selected.supplyType === "import" && (
                    <Badge className="bg-amber-600 text-[10px]">Import</Badge>
                  )}
                </DialogDescription>
              </DialogHeader>
              {(selected.lcReference || selected.lcBank) && (
                <div className="text-xs rounded-lg border bg-muted/40 p-2 space-y-0.5">
                  <p className="font-bold uppercase text-muted-foreground">LC</p>
                  {selected.lcReference && <p className="font-mono">Ref: {selected.lcReference}</p>}
                  {selected.lcBank && <p>{selected.lcBank}</p>}
                  {(selected.lcAmount != null || selected.lcCurrency) && (
                    <p className="font-mono">
                      {selected.lcAmount != null ? selected.lcAmount : "—"} {selected.lcCurrency || ""}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2 max-h-40 overflow-y-auto text-sm">
                {selected.lines.map((l, i) => {
                  const inv = selected.lineInventoryCosts?.[i];
                  return (
                    <div key={i} className="flex flex-col border-b py-1 gap-0.5">
                      <div className="flex justify-between">
                        <span>{l.product?.sku}</span>
                        <span>
                          {l.quantityReceived}/{l.quantityOrdered} · {format(l.quantityOrdered * (l.unitCost || 0))}{" "}
                          {selected.invoiceCurrency || "ETB"}
                        </span>
                      </div>
                      {inv && (inv.inventoryUnitCost > 0 || (selected.landedCostPoolTotal ?? 0) > 0) && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Inv. cost/unit (ETB): {format(inv.inventoryUnitCost)}
                          {inv.landedPerUnit > 0 && ` (+landed ${format(inv.landedPerUnit)})`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm font-black pt-2">
                PO value (invoice): {format(poLineTotal(selected))} {selected.invoiceCurrency || "ETB"}
                {(selected.fxRateToFunctional ?? 1) !== 1 && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    ≈ {format(poLineTotalFunctional(selected))} ETB functional
                  </span>
                )}
              </p>
              {(selected.landedCostPoolTotal ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Landed pool (ETB): {format(selected.landedCostPoolTotal ?? 0)} ·{" "}
                  {selected.landedCostAllocation?.replace("_", " ")}
                </p>
              )}
              {can(PERM.create) && ["draft", "approved", "partial_received"].includes(selected.status) && (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openSourcingEditor(selected)}>
                  Edit landed cost, FX & LC
                </Button>
              )}

              {["approved", "partial_received"].includes(selected.status) && can(PERM.receive) && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Receive quantities</p>
                  <p className="text-[10px] text-muted-foreground">
                    Stock will post at blended ETB cost (FX + allocated freight/duty/clearing).
                  </p>
                  {selected.lines.map((l, i) => {
                    const rem = l.quantityOrdered - l.quantityReceived;
                    if (rem <= 0) return null;
                    const inv = selected.lineInventoryCosts?.[i];
                    // Find full product details for tracking method
                    const pFull = (products as ProductOption[]).find((p) => p._id === l.product?._id);
                    const showBatch = pFull?.trackingMethod === 'batch';
                    const showSerial = pFull?.trackingMethod === 'serial';
                    const showExpiry = pFull?.hasExpiry;

                    return (
                      <div key={i} className="flex flex-col gap-3 border-b pb-4 mb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono font-bold block truncate">{l.product?.sku}</span>
                            <span className="text-[10px] text-muted-foreground">{l.product?.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold">Remaining: {rem}</span>
                            {inv && inv.inventoryUnitCost > 0 && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                                {format(inv.inventoryUnitCost)}/u ETB
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Receive Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              max={rem}
                              className="h-9"
                              value={receiveQty[i] ?? 0}
                              onChange={(e) =>
                                setReceiveQty((p) => ({ ...p, [i]: Math.min(rem, Math.max(0, parseInt(e.target.value, 10) || 0)) }))
                              }
                            />
                          </div>

                          {showBatch && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold">Lot #</Label>
                                <Input
                                  className="h-9 text-xs font-mono"
                                  placeholder="LOT-123"
                                  value={receiveLot[i] ?? ""}
                                  onChange={(e) => setReceiveLot((p) => ({ ...p, [i]: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold">Batch</Label>
                                <Input
                                  className="h-9 text-xs font-mono"
                                  placeholder="BAT-XYZ"
                                  value={receiveBatch[i] ?? ""}
                                  onChange={(e) => setReceiveBatch((p) => ({ ...p, [i]: e.target.value }))}
                                />
                              </div>
                            </>
                          )}

                          {showSerial && (
                            <div className="space-y-1 col-span-2">
                              <Label className="text-[10px] font-bold">Serial Number</Label>
                              <Input
                                className="h-9 text-xs font-mono"
                                placeholder="SN-1000"
                                value={receiveSerial[i] ?? ""}
                                onChange={(e) => setReceiveSerial((p) => ({ ...p, [i]: e.target.value }))}
                              />
                            </div>
                          )}

                          {showExpiry && (
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold">Expires</Label>
                              <Input
                                type="date"
                                className="h-9 text-xs"
                                value={receiveExpiry[i] ?? ""}
                                onChange={(e) => setReceiveExpiry((p) => ({ ...p, [i]: e.target.value }))}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    className="w-full"
                    disabled={receiveMut.isPending}
                    onClick={() => {
                      const receipts = selected.lines
                        .map((l, i) => {
                          const pFull = (products as ProductOption[]).find((p) => p._id === l.product?._id);
                          const qty = receiveQty[i] || 0;
                          
                          if (qty > 0) {
                            if (pFull?.trackingMethod === 'batch' && !receiveLot[i] && !receiveBatch[i]) {
                              throw new Error(`Lot/Batch required for ${l.product.sku}`);
                            }
                            if (pFull?.trackingMethod === 'serial' && !receiveSerial[i]) {
                              throw new Error(`Serial Number required for ${l.product.sku}`);
                            }
                          }

                          return {
                            lineIndex: i,
                            quantity: qty,
                            lotNumber: receiveLot[i]?.trim() || undefined,
                            batchNumber: receiveBatch[i]?.trim() || undefined,
                            serialNumber: receiveSerial[i]?.trim() || undefined,
                            expirationDate: receiveExpiry[i]?.trim() || null,
                          };
                        })
                        .filter((r) => r.quantity > 0);

                      if (receipts.length === 0) {
                        toast.error("Enter at least one quantity");
                        return;
                      }
                      try {
                        receiveMut.mutate({ id: selected._id, receipts });
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Receive failed");
                      }
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Post receipt
                  </Button>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selected.status === "draft" && can(PERM.approve) && (
                  <Button variant="secondary" onClick={() => approveMut.mutate(selected._id)}>
                    Approve PO
                  </Button>
                )}
                {selected.status === "draft" && can(PERM.cancel) && (
                  <Button variant="destructive" onClick={() => cancelMut.mutate(selected._id)}>
                    <Ban className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sourcingOpen} onOpenChange={setSourcingOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Landed cost, FX & LC</DialogTitle>
            <DialogDescription>Functional currency for inventory is ETB. Landed charges are in ETB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Supply</Label>
                <Select
                  value={supplyType}
                  onValueChange={(v) => {
                    const t = v as "local" | "import";
                    setSupplyType(t);
                    if (t === "import") setLandedAlloc((a) => (a === "none" ? "by_value" : a));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Allocation</Label>
                <Select value={landedAlloc} onValueChange={(v) => setLandedAlloc(v as typeof landedAlloc)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="by_value">By line value</SelectItem>
                    <SelectItem value="by_quantity">By quantity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Invoice CCY</Label>
                <Input value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">FX → ETB</Label>
                <Input type="number" min={0} step={0.0001} value={fxRate} onChange={(e) => setFxRate(parseFloat(e.target.value) || 1)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Freight ETB</Label>
                <Input type="number" min={0} value={importFreight} onChange={(e) => setImportFreight(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duty ETB</Label>
                <Input type="number" min={0} value={importDuty} onChange={(e) => setImportDuty(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Clearing ETB</Label>
                <Input type="number" min={0} value={importClearing} onChange={(e) => setImportClearing(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Input placeholder="LC reference" value={lcRef} onChange={(e) => setLcRef(e.target.value)} />
              <Input placeholder="LC bank" value={lcBank} onChange={(e) => setLcBank(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="LC amount" type="number" value={lcAmt} onChange={(e) => setLcAmt(e.target.value)} />
                <Input placeholder="CCY" value={lcCurr} onChange={(e) => setLcCurr(e.target.value.toUpperCase())} className="w-20" />
              </div>
              <Input type="date" value={lcExp} onChange={(e) => setLcExp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourcingOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || patchSourcingMut.isPending}
              onClick={() => selected && patchSourcingMut.mutate({ id: selected._id, body: buildSourcingPayload() })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleDashboardLayout>
  );
}
