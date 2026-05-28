import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bomApi, inventoryApi } from "@/lib/api";
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
import { toast } from "sonner";
import {
  Search, Plus, FileStack, Eye, Copy, Layers, DollarSign, Hash, Trash2, GitBranch,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type BomStatus = "Active" | "Draft" | "Archived";

const statusVariant: Record<BomStatus, "success" | "warning" | "secondary"> = {
  Active: "success",
  Draft: "warning",
  Archived: "secondary",
};

interface BomComponent {
  product: {
    name: string;
    sku: string;
    unitCost: number;
    unit: string;
  };
  quantity: number;
}

interface BomRoutingRow {
  sequence: number;
  code: string;
  name: string;
  workCenterCode: string;
  setupMinutes: number;
  runMinutesPerUnit: number;
  leadTimeDays: number;
}

interface Bom {
  _id: string;
  name: string;
  partNumber: string;
  revision: string;
  status: BomStatus;
  outputProduct?: string | { _id: string; name: string; sku: string };
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  components: BomComponent[];
  routing?: BomRoutingRow[];
  createdAt: string;
  updatedAt: string;
  notes: string;
}

interface BomComponentRow {
  productId: string;
  quantity: number;
}

function calcBomCost(components: BomComponent[]) {
  return components.reduce((sum, c) => sum + c.quantity * (c.product?.unitCost || 0), 0);
}

export default function Boms({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { symbol } = useCurrency();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | BomStatus>("All");
  const [selectedBom, setSelectedBom] = useState<Bom | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Bom | null>(null);
  const [formName, setFormName] = useState("");
  const [formPartNumber, setFormPartNumber] = useState("");
  const [formRevision, setFormRevision] = useState("Rev A");
  const [formStatus, setFormStatus] = useState<BomStatus>("Draft");
  const [formNotes, setFormNotes] = useState("");
  const [formComponents, setFormComponents] = useState<BomComponentRow[]>([{ productId: "", quantity: 1 }]);
  const [formOutputProductId, setFormOutputProductId] = useState("");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState("");
  const [formEffectiveTo, setFormEffectiveTo] = useState("");
  const [editOutputProductId, setEditOutputProductId] = useState("");
  const [editEffectiveFrom, setEditEffectiveFrom] = useState("");
  const [editEffectiveTo, setEditEffectiveTo] = useState("");
  const [editRouting, setEditRouting] = useState<BomRoutingRow[]>([
    { sequence: 10, code: "ASSY", name: "Assembly", workCenterCode: "MAIN", setupMinutes: 0, runMinutesPerUnit: 0, leadTimeDays: 0 },
  ]);

  const { data: bomsData = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: bomApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const updateBomMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => bomApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      toast.success("BOM updated");
      if (data && typeof data === "object" && "_id" in data) {
        setSelectedBom(data as Bom);
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update BOM");
    },
  });

  const createBomMutation = useMutation({
    mutationFn: (data: {
      name: string;
      partNumber: string;
      revision?: string;
      status?: string;
      notes?: string;
      outputProduct: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      components: { product: string; quantity: number }[];
    }) => bomApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success("BOM created");
      setFormOpen(false);
      setDuplicateSource(null);
      resetForm();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create BOM");
    },
  });

  function resetForm() {
    setFormName("");
    setFormPartNumber("");
    setFormRevision("Rev A");
    setFormStatus("Draft");
    setFormNotes("");
    setFormComponents([{ productId: "", quantity: 1 }]);
    setFormOutputProductId("");
    setFormEffectiveFrom("");
    setFormEffectiveTo("");
  }

  function bomOutputId(b: Bom | null): string {
    if (!b?.outputProduct) return "";
    if (typeof b.outputProduct === "string") return b.outputProduct;
    return b.outputProduct._id;
  }

  function openForDuplicate(bom: Bom) {
    setDuplicateSource(bom);
    setFormName(`Copy of ${bom.name}`);
    setFormPartNumber(`${bom.partNumber}-COPY`);
    setFormRevision(bom.revision);
    setFormStatus("Draft");
    setFormNotes(bom.notes ?? "");
    setFormComponents(
      bom.components.length
        ? bom.components.map((c) => ({
            productId: typeof c.product === "object" && c.product && "_id" in c.product ? (c.product as { _id: string })._id : String(c.product),
            quantity: c.quantity,
          }))
        : [{ productId: "", quantity: 1 }]
    );
    setFormOutputProductId(bomOutputId(bom) || "");
    setFormEffectiveFrom(
      bom.effectiveFrom ? new Date(bom.effectiveFrom).toISOString().slice(0, 10) : ""
    );
    setFormEffectiveTo(
      bom.effectiveTo ? new Date(bom.effectiveTo).toISOString().slice(0, 10) : ""
    );
    setFormOpen(true);
  }

  const filtered = bomsData.filter((bom) => {
    const matchesSearch =
      bom.name.toLowerCase().includes(search.toLowerCase()) ||
      bom.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      bom._id.toLowerCase().includes(search.toLowerCase()); // Changed bom.id to bom._id
    const matchesStatus = statusFilter === "All" || bom.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (selectedBom) {
      setEditOutputProductId(bomOutputId(selectedBom));
      setEditEffectiveFrom(
        selectedBom.effectiveFrom
          ? new Date(selectedBom.effectiveFrom).toISOString().slice(0, 10)
          : ""
      );
      setEditEffectiveTo(
        selectedBom.effectiveTo
          ? new Date(selectedBom.effectiveTo).toISOString().slice(0, 10)
          : ""
      );
      const r = selectedBom.routing;
      setEditRouting(
        r?.length
          ? r.map((x) => ({
              sequence: x.sequence ?? 10,
              code: x.code || "OP",
              name: x.name || "Operation",
              workCenterCode: x.workCenterCode || "",
              setupMinutes: Number(x.setupMinutes) || 0,
              runMinutesPerUnit: Number(x.runMinutesPerUnit) || 0,
              leadTimeDays: Number(x.leadTimeDays) || 0,
            }))
          : [
              {
                sequence: 10,
                code: "ASSY",
                name: "Assembly",
                workCenterCode: "MAIN",
                setupMinutes: 0,
                runMinutesPerUnit: 0,
                leadTimeDays: 0,
              },
            ]
      );
    }
  }, [selectedBom?._id]);

  const activeCount = bomsData.filter((b) => b.status === "Active").length;
  const draftCount = bomsData.filter((b) => b.status === "Draft").length;
  const totalComponents = bomsData.reduce((sum, b) => sum + b.components.length, 0);
  const avgCost = bomsData.length > 0 ? bomsData.reduce((sum, b) => sum + calcBomCost(b.components), 0) / bomsData.length : 0;
  const archivedCount = bomsData.filter((b) => b.status === "Archived").length;

  return (
    <div className={`${embedded ? "space-y-6" : "space-y-8"} pb-8 animate-in fade-in duration-500`}>
      {!embedded && (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="w-full overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
              <div className="p-5 sm:p-7">
                <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
                  <FileStack className="h-4 w-4" />
                  Engineering control center
                </div>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("pages.boms.title")}</h1>
                    <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
                      {t("pages.boms.subtitle")}
                    </p>
                  </div>
                  <div className="grid min-w-full grid-cols-3 overflow-hidden rounded-[16px] border border-white/15 bg-white/10 text-center shadow-2xl shadow-black/10 backdrop-blur lg:min-w-[430px]">
                    {[
                      { label: "Active", value: activeCount, tone: "text-emerald-300" },
                      { label: "Draft", value: draftCount, tone: "text-amber-300" },
                      { label: "Archived", value: archivedCount, tone: "text-sky-200" },
                    ].map((item) => (
                      <div key={item.label} className="border-r border-white/10 p-4 last:border-r-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                        <p className={`mt-2 text-2xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total BOMs", value: bomsData.length, sub: "Engineering records", icon: FileStack, color: "text-primary", bg: "bg-primary/10", accent: "from-primary to-cyan-400" },
              { label: "Active", value: activeCount, sub: "Released to production", icon: Layers, color: "text-emerald-600", bg: "bg-emerald-500/10", accent: "from-emerald-500 to-teal-400" },
              { label: "Components", value: totalComponents, sub: "Across all structures", icon: Hash, color: "text-amber-600", bg: "bg-amber-500/10", accent: "from-amber-400 to-rose-500" },
              { label: "Avg BOM cost", value: `${symbol}${avgCost.toFixed(2)}`, sub: "Estimated material cost", icon: DollarSign, color: "text-violet-600", bg: "bg-violet-500/10", accent: "from-violet-500 to-blue-500" },
            ].map((stat, idx) => (
              <Card
                key={idx}
                className="group relative overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`h-1 bg-gradient-to-r ${stat.accent}`} />
                <CardContent className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                    </div>
                    <div className={`h-9 w-9 rounded-full ${stat.bg}`} />
                  </div>
                  <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Search & filters — matches jobs / production pattern */}
      <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                {embedded ? "BOM library" : "Search & filters"}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {embedded ? "Filter and open engineering records" : "Lifecycle chips and quick lookup"}
              </p>
            </div>
            <Button
              className="h-10 gap-2 rounded-[12px] bg-primary px-5 font-black text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Engineer new BOM
            </Button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="group relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search specs, part numbers, or system IDs..."
                className="h-11 rounded-[12px] border-border/60 bg-muted/30 pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-[14px] border border-border/60 bg-muted/30 p-1">
              {(["All", "Active", "Draft", "Archived"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-[11px] px-4 py-2 text-xs font-black transition-all ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOM register */}
      <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                <GitBranch className="h-5 w-5 text-primary" />
                BOM register
              </CardTitle>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Click a row for components, routing, output SKU, and effectivity
              </p>
            </div>
            <Badge variant="secondary" className="w-fit rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {filtered.length} visible
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/25">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="h-12 pl-6 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">System ID</TableHead>
                  <TableHead className="h-12 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Product name</TableHead>
                  <TableHead className="hidden h-12 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground sm:table-cell">Output SKU</TableHead>
                  <TableHead className="hidden h-12 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground md:table-cell">Part #</TableHead>
                  <TableHead className="hidden h-12 text-center text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground lg:table-cell">Version</TableHead>
                  <TableHead className="h-12 text-center text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Components</TableHead>
                  <TableHead className="hidden h-12 text-right text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground lg:table-cell">Est. cost</TableHead>
                  <TableHead className="h-12 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Lifecycle</TableHead>
                  <TableHead className="h-12 w-[80px] pr-6 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-20 text-center font-medium text-muted-foreground">
                      Loading BOMs…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-20 text-center font-medium text-muted-foreground">
                      No BOMs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bom) => (
                    <TableRow
                      key={bom._id}
                      className="group/row cursor-pointer border-border/40 transition-colors hover:bg-primary/[0.03]"
                      onClick={() => setSelectedBom(bom)}
                    >
                      <TableCell className="pl-6 font-mono text-[10px] font-medium text-muted-foreground opacity-60 transition-opacity group-hover/row:opacity-100">
                        {bom._id.substring(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] font-semibold tracking-tight text-foreground">{bom.name}</span>
                      </TableCell>
                      <TableCell className="hidden font-mono text-[10px] text-muted-foreground sm:table-cell">
                        {typeof bom.outputProduct === "object" && bom.outputProduct?.sku
                          ? bom.outputProduct.sku
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden font-mono text-[11px] font-semibold text-primary md:table-cell">
                        {bom.partNumber}
                      </TableCell>
                      <TableCell className="hidden text-center lg:table-cell">
                         <Badge variant="outline" className="rounded-[8px] border-primary/30 px-2 text-[10px] font-black uppercase">
                          {bom.revision}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-[13px] font-semibold">{bom.components.length}</TableCell>
                      <TableCell className="hidden text-right font-mono text-[13px] font-semibold text-info lg:table-cell">
                        {symbol}
                        {calcBomCost(bom.components).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[bom.status]} className="rounded-[8px] px-2 py-0 text-[10px] font-black uppercase tracking-tight">
                          {bom.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-[10px] border border-border/60 bg-card opacity-100 shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-hover/row:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBom(bom);
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedBom} onOpenChange={(open) => !open && setSelectedBom(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[22px] border border-border/60 p-0 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.75)] sm:max-w-4xl">
          <div className="mx-5 mt-5 rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] p-5 text-white shadow-[0_20px_54px_-34px_rgba(15,23,42,0.75)]">
          <DialogHeader>
            <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              <FileStack className="h-3.5 w-3.5" />
              BOM engineering record
            </div>
            <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-white">
              {selectedBom?.name}
              {selectedBom && (
                <Badge variant={statusVariant[selectedBom.status]} className="rounded-[10px] text-[10px] font-black uppercase">
                  {selectedBom.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {selectedBom?.partNumber} · {selectedBom?.revision} · {selectedBom?._id}
            </DialogDescription>
          </DialogHeader>
          {selectedBom && (
            <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/15 bg-white/10 text-center shadow-2xl shadow-black/10 backdrop-blur">
              {[
                { label: "Components", value: selectedBom.components.length },
                { label: "Routing", value: selectedBom.routing?.length || 0 },
                { label: "Cost", value: `${symbol}${calcBomCost(selectedBom.components).toFixed(2)}` },
              ].map((item, index) => (
                <div key={item.label} className={`px-3 py-3 ${index > 0 ? "border-l border-white/10" : ""}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                  <p className="mt-1 truncate font-mono text-sm font-black text-white">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          </div>
          {selectedBom && (
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-[14px] border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusVariant[selectedBom.status]} className="rounded-[8px] text-[10px] font-black uppercase">{selectedBom.status}</Badge>
                </div>
                <div className="rounded-[14px] border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium text-foreground">{new Date(selectedBom.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-[14px] border border-border/60 bg-card p-4 shadow-sm">
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="font-medium text-foreground">{new Date(selectedBom.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Components Table */}
              <div className="rounded-[16px] border border-border/60 bg-card p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-foreground">Components</h4>
                <div className="overflow-hidden rounded-[14px] border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBom.components.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-foreground">{c.product?.name}</TableCell>
                          <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">{c.product?.sku}</TableCell>
                          <TableCell className="text-right font-mono">{c.quantity} {c.product?.unit}</TableCell>
                          <TableCell className="text-right font-mono">{symbol}{(c.product?.unitCost || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {symbol}{(c.quantity * (c.product?.unitCost || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="text-right font-semibold text-foreground">
                          Total Estimated Cost
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {symbol}{calcBomCost(selectedBom.components).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedBom.notes && (
                <div className="rounded-[14px] border border-border/60 bg-muted/20 p-4">
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="text-sm text-foreground">{selectedBom.notes}</p>
                </div>
              )}

              <div className="space-y-3 rounded-[16px] border border-border/60 bg-card p-4 shadow-sm">
                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">Finished good & effectivity</h4>
                <p className="text-xs text-muted-foreground">
                  Required for production completion: stock is consumed from components and added to the output SKU.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Output product (FG)</Label>
                    <Select
                      value={editOutputProductId || "__none__"}
                      onValueChange={(v) => setEditOutputProductId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="h-10 rounded-[12px] border-border/60 bg-muted/30"><SelectValue placeholder="Select finished good" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not set —</SelectItem>
                        {(products as { _id: string; name: string; sku: string }[]).map((prod) => (
                          <SelectItem key={prod._id} value={prod._id}>
                            {prod.name} ({prod.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Effective from</Label>
                      <Input
                        type="date"
                        className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                        value={editEffectiveFrom}
                        onChange={(e) => setEditEffectiveFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Effective to</Label>
                      <Input
                        type="date"
                        className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                        value={editEffectiveTo}
                        onChange={(e) => setEditEffectiveTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="rounded-[12px] font-black"
                  disabled={!editOutputProductId || updateBomMutation.isPending}
                  onClick={() =>
                    selectedBom &&
                    updateBomMutation.mutate({
                      id: selectedBom._id,
                      data: {
                        outputProduct: editOutputProductId,
                        effectiveFrom: editEffectiveFrom
                          ? new Date(editEffectiveFrom).toISOString()
                          : null,
                        effectiveTo: editEffectiveTo
                          ? new Date(editEffectiveTo).toISOString()
                          : null,
                      },
                    })
                  }
                >
                  Save output & dates
                </Button>
              </div>

              <div className="space-y-2 rounded-[16px] border border-border/60 bg-card p-4 shadow-sm">
                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">Routing (shop floor / MRP lead)</h4>
                <p className="text-xs text-muted-foreground">
                  Operations appear on job traveler; leadTimeDays rolls into MRP explosion critical path.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto text-[10px]">
                  {editRouting.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1 rounded-[12px] border border-border/60 bg-muted/20 p-2">
                      <span className="text-muted-foreground w-4">{i + 1}</span>
                      <Input
                        className="h-8 w-14 rounded-[9px] border-border/60 bg-card"
                        type="number"
                        title="Seq"
                        value={row.sequence}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) => (j === i ? { ...r, sequence: parseInt(e.target.value, 10) || 0 } : r))
                          )
                        }
                      />
                      <Input
                        className="h-8 w-16 rounded-[9px] border-border/60 bg-card font-mono"
                        placeholder="code"
                        value={row.code}
                        onChange={(e) =>
                          setEditRouting((p) => p.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))
                        }
                      />
                      <Input
                        className="h-8 min-w-[100px] flex-1 rounded-[9px] border-border/60 bg-card"
                        placeholder="Operation name"
                        value={row.name}
                        onChange={(e) =>
                          setEditRouting((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                      <Input
                        className="h-8 w-20 rounded-[9px] border-border/60 bg-card font-mono"
                        placeholder="WC"
                        value={row.workCenterCode}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) => (j === i ? { ...r, workCenterCode: e.target.value } : r))
                          )
                        }
                      />
                      <Input
                        className="h-8 w-14 rounded-[9px] border-border/60 bg-card"
                        type="number"
                        title="Setup min"
                        value={row.setupMinutes}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) =>
                              j === i ? { ...r, setupMinutes: parseFloat(e.target.value) || 0 } : r
                            )
                          )
                        }
                      />
                      <Input
                        className="h-8 w-14 rounded-[9px] border-border/60 bg-card"
                        type="number"
                        title="Run min/u"
                        value={row.runMinutesPerUnit}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) =>
                              j === i ? { ...r, runMinutesPerUnit: parseFloat(e.target.value) || 0 } : r
                            )
                          )
                        }
                      />
                      <Input
                        className="h-8 w-14 rounded-[9px] border-border/60 bg-card"
                        type="number"
                        title="Lead days"
                        value={row.leadTimeDays}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) =>
                              j === i ? { ...r, leadTimeDays: parseFloat(e.target.value) || 0 } : r
                            )
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-[9px] p-0 text-destructive"
                        onClick={() => setEditRouting((p) => p.filter((_, j) => j !== i))}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-[12px]"
                    onClick={() =>
                      setEditRouting((p) => [
                        ...p,
                        {
                          sequence: (p[p.length - 1]?.sequence || 0) + 10,
                          code: "OP",
                          name: "Operation",
                          workCenterCode: "",
                          setupMinutes: 0,
                          runMinutesPerUnit: 0,
                          leadTimeDays: 0,
                        },
                      ])
                    }
                  >
                    + Step
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-[12px] font-black"
                    disabled={updateBomMutation.isPending || !selectedBom}
                    onClick={() =>
                      selectedBom &&
                      updateBomMutation.mutate({
                        id: selectedBom._id,
                        data: { routing: editRouting.filter((r) => r.name.trim()) },
                      })
                    }
                  >
                    Save routing
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="border-t border-border/60 bg-muted/10 p-5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-[12px] font-black"
              onClick={() => selectedBom && openForDuplicate(selectedBom)}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate BOM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / Duplicate BOM Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 shadow-erp sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1a2744]">
              {duplicateSource ? "Duplicate BOM" : "New BOM"}
            </DialogTitle>
            <DialogDescription>
              {duplicateSource ? "Create a copy with a new name and part number." : "Add a new bill of materials."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="BOM name" />
              </div>
              <div className="space-y-2">
                <Label>Part Number</Label>
                <Input value={formPartNumber} onChange={(e) => setFormPartNumber(e.target.value)} placeholder="Part #" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revision</Label>
                <Input value={formRevision} onChange={(e) => setFormRevision(e.target.value)} placeholder="Rev A" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as BomStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Draft", "Active", "Archived"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <div className="space-y-2">
              <Label>Output product (finished good) *</Label>
              <Select
                value={formOutputProductId || "__pick__"}
                onValueChange={(v) => setFormOutputProductId(v === "__pick__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="SKU produced when job completes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__pick__">Select product…</SelectItem>
                  {(products as { _id: string; name: string; sku: string }[]).map((prod) => (
                    <SelectItem key={prod._id} value={prod._id}>{prod.name} ({prod.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input type="date" value={formEffectiveFrom} onChange={(e) => setFormEffectiveFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Effective to (optional)</Label>
                <Input type="date" value={formEffectiveTo} onChange={(e) => setFormEffectiveTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Components</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormComponents((p) => [...p, { productId: "", quantity: 1 }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                </Button>
              </div>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {formComponents.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 p-2">
                    <Select
                      value={row.productId}
                      onValueChange={(v) =>
                        setFormComponents((p) => p.map((r, j) => (j === i ? { ...r, productId: v } : r)))
                      }
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {(products as { _id: string; name: string; sku: string }[]).map((prod) => (
                          <SelectItem key={prod._id} value={prod._id}>{prod.name} ({prod.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={row.quantity}
                      onChange={(e) =>
                        setFormComponents((p) => p.map((r, j) => (j === i ? { ...r, quantity: parseInt(e.target.value, 10) || 0 } : r)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setFormComponents((p) => p.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (!formName.trim() || !formPartNumber.trim()) {
                  toast.error("Name and Part Number are required");
                  return;
                }
                const components = formComponents
                  .filter((r) => r.productId)
                  .map((r) => ({ product: r.productId, quantity: r.quantity }));
                if (components.length === 0) {
                  toast.error("Add at least one component");
                  return;
                }
                if (!formOutputProductId) {
                  toast.error("Select the output product (finished good SKU)");
                  return;
                }
                createBomMutation.mutate({
                  name: formName.trim(),
                  partNumber: formPartNumber.trim(),
                  revision: formRevision || "Rev A",
                  status: formStatus,
                  notes: formNotes || undefined,
                  outputProduct: formOutputProductId,
                  effectiveFrom: formEffectiveFrom
                    ? new Date(formEffectiveFrom).toISOString()
                    : null,
                  effectiveTo: formEffectiveTo
                    ? new Date(formEffectiveTo).toISOString()
                    : null,
                  components,
                });
              }}
              disabled={createBomMutation.isPending}
            >
              {duplicateSource ? "Create Copy" : "Create BOM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
