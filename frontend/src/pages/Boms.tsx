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
  Search, Plus, FileStack, Eye, Copy, Layers, DollarSign, Hash, Trash2,
} from "lucide-react";

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

export default function Boms() {
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total BOMs", value: bomsData.length, icon: FileStack, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: activeCount, icon: Layers, color: "text-success", bg: "bg-success/10" },
          { label: "Total Components", value: totalComponents, icon: Hash, color: "text-warning", bg: "bg-warning/10" },
          { label: "Avg BOM Cost", value: `${symbol}${avgCost.toFixed(2)}`, icon: DollarSign, color: "text-info", bg: "bg-info/10" }
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
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase">
                  Product Manifest (BOM)
                </h1>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Technical specifications and bill of materials ledger</p>
            </div>
            <Button 
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl px-6 h-11 transition-all hover:-translate-y-0.5" 
              onClick={() => { resetForm(); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4" /> 
              <span className="font-bold">Engineer New BOM</span>
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 pt-6">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search specs, part numbers, or system IDs..."
                className="pl-10 bg-background/50 border-border/50 focus-visible:ring-primary/20 h-11 rounded-xl transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center p-1 bg-secondary/50 border border-border/50 rounded-xl gap-1">
              {(["All", "Active", "Draft", "Archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 text-xs font-black uppercase tracking-tight rounded-lg transition-all ${
                    statusFilter === s 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground pl-6 h-12">System ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12">Product Name</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden sm:table-cell">Output SKU</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden md:table-cell">Engineering Part #</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden lg:table-cell text-center">Version</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 text-center">Components</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12 hidden lg:table-cell text-right">Est. Cost</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground h-12">Lifecycle</TableHead>
                  <TableHead className="w-[80px] pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-medium italic">
                      Synchronizing with engineering database...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-medium">
                      No matching specifications found in repository.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bom) => (
                    <TableRow
                      key={bom._id}
                      className="cursor-pointer transition-colors hover:bg-white/5 border-white/5 group/row"
                      onClick={() => setSelectedBom(bom)}
                    >
                      <TableCell className="pl-6 font-mono text-[10px] font-bold text-muted-foreground opacity-50 group-hover/row:opacity-100 transition-opacity">
                        {bom._id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-[13px] tracking-tight text-foreground">{bom.name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-[10px] text-muted-foreground">
                        {typeof bom.outputProduct === "object" && bom.outputProduct?.sku
                          ? bom.outputProduct.sku
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-[11px] font-bold text-primary italic">
                        {bom.partNumber}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        <Badge variant="outline" className="text-[10px] font-black uppercase rounded-md border-primary/30 px-2">
                          {bom.revision}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-[13px] font-black">{bom.components.length}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-mono text-[13px] font-black text-info">
                        {symbol}{calcBomCost(bom.components).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[bom.status]} className="text-[10px] font-black uppercase tracking-tight py-0 px-2 rounded-md">
                          {bom.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg opacity-0 group-hover/row:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground"
                          onClick={(e) => { e.stopPropagation(); setSelectedBom(bom); }}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5 text-primary" />
              {selectedBom?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedBom?.partNumber} · {selectedBom?.revision} · {selectedBom?._id}
            </DialogDescription>
          </DialogHeader>
          {selectedBom && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusVariant[selectedBom.status]}>{selectedBom.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium text-foreground">{new Date(selectedBom.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="font-medium text-foreground">{new Date(selectedBom.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Components Table */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Components</h4>
                <div className="border rounded-lg overflow-hidden">
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
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="text-sm text-foreground">{selectedBom.notes}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Finished good & effectivity</h4>
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
                      <SelectTrigger><SelectValue placeholder="Select finished good" /></SelectTrigger>
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
                        value={editEffectiveFrom}
                        onChange={(e) => setEditEffectiveFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Effective to</Label>
                      <Input
                        type="date"
                        value={editEffectiveTo}
                        onChange={(e) => setEditEffectiveTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
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

              <div className="border-t pt-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Routing (shop floor / MRP lead)</h4>
                <p className="text-xs text-muted-foreground">
                  Operations appear on job traveler; leadTimeDays rolls into MRP explosion critical path.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto text-[10px]">
                  {editRouting.map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-1 items-center border rounded-md p-2 bg-muted/20">
                      <span className="text-muted-foreground w-4">{i + 1}</span>
                      <Input
                        className="h-8 w-14"
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
                        className="h-8 w-16 font-mono"
                        placeholder="code"
                        value={row.code}
                        onChange={(e) =>
                          setEditRouting((p) => p.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))
                        }
                      />
                      <Input
                        className="h-8 flex-1 min-w-[100px]"
                        placeholder="Operation name"
                        value={row.name}
                        onChange={(e) =>
                          setEditRouting((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                      <Input
                        className="h-8 w-20 font-mono"
                        placeholder="WC"
                        value={row.workCenterCode}
                        onChange={(e) =>
                          setEditRouting((p) =>
                            p.map((r, j) => (j === i ? { ...r, workCenterCode: e.target.value } : r))
                          )
                        }
                      />
                      <Input
                        className="h-8 w-14"
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
                        className="h-8 w-14"
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
                        className="h-8 w-14"
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
                        className="h-8 w-8 p-0 text-destructive"
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
          <DialogFooter>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => selectedBom && openForDuplicate(selectedBom)}>
              <Copy className="h-3.5 w-3.5" /> Duplicate BOM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / Duplicate BOM Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{duplicateSource ? "Duplicate BOM" : "New BOM"}</DialogTitle>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
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
