import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bomApi, inventoryApi } from "@/lib/api";
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

interface Bom {
  _id: string;
  name: string;
  partNumber: string;
  revision: string;
  status: BomStatus;
  components: BomComponent[];
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

  const { data: bomsData = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: bomApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const createBomMutation = useMutation({
    mutationFn: (data: { name: string; partNumber: string; revision?: string; status?: string; notes?: string; components: { product: string; quantity: number }[] }) =>
      bomApi.create(data),
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

  const activeCount = bomsData.filter((b) => b.status === "Active").length;
  const draftCount = bomsData.filter((b) => b.status === "Draft").length;
  const totalComponents = bomsData.reduce((sum, b) => sum + b.components.length, 0);
  const avgCost = bomsData.length > 0 ? bomsData.reduce((sum, b) => sum + calcBomCost(b.components), 0) / bomsData.length : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileStack className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total BOMs</p>
              <p className="text-xl font-bold text-foreground">{bomsData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-foreground">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Hash className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Components</p>
              <p className="text-xl font-bold text-foreground">{totalComponents}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg BOM Cost</p>
              <p className="text-xl font-bold text-foreground">${avgCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Bills of Materials</CardTitle>
            <Button size="sm" className="gap-1.5 w-fit" onClick={() => { resetForm(); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> New BOM
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, part number, or ID..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              {(["All", "Active", "Draft", "Archived"] as const).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Part #</TableHead>
                <TableHead className="hidden lg:table-cell">Rev</TableHead>
                <TableHead className="text-center">Parts</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Est. Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading BOMs...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No BOMs found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((bom) => (
                  <TableRow
                    key={bom._id}
                    className="cursor-pointer"
                    onClick={() => setSelectedBom(bom)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{bom._id.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{bom.name}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {bom.partNumber}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">{bom.revision}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{bom.components.length}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right font-mono">
                      ${calcBomCost(bom.components).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[bom.status]}>{bom.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                          <TableCell className="text-right font-mono">${(c.product?.unitCost || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ${(c.quantity * (c.product?.unitCost || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={4} className="text-right font-semibold text-foreground">
                          Total Estimated Cost
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          ${calcBomCost(selectedBom.components).toFixed(2)}
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
                createBomMutation.mutate({
                  name: formName.trim(),
                  partNumber: formPartNumber.trim(),
                  revision: formRevision || "Rev A",
                  status: formStatus,
                  notes: formNotes || undefined,
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
