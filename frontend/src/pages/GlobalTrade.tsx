import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tradeApi, purchaseOrdersApi, ordersApi } from "@/lib/api";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Ship, Plane, Search, Plus, Filter, AlertCircle, FileText, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";

export default function GlobalTrade() {
  const { t } = useLocale();
  const { formatDate } = useEthiopianDateDisplay();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    tradeType: "import",
    referenceNumber: "",
    vesselOrFlight: "",
    portOfLoading: "",
    portOfDischarge: "",
    status: "pre_shipment",
    customsStatus: "pending",
    incoterm: "other",
    purchaseOrder: "",
    salesOrder: "",
  });

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["trade-shipments"],
    queryFn: tradeApi.getAll,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersApi.getAll,
    enabled: createOpen && formData.tradeType === "import",
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
    enabled: createOpen && formData.tradeType === "export",
  });

  const createMut = useMutation({
    mutationFn: () => tradeApi.create(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-shipments"] });
      toast.success("Trade shipment created");
      setCreateOpen(false);
      setFormData({
        tradeType: "import",
        referenceNumber: "",
        vesselOrFlight: "",
        portOfLoading: "",
        portOfDischarge: "",
        status: "pre_shipment",
        customsStatus: "pending",
        incoterm: "other",
        purchaseOrder: "",
        salesOrder: "",
      });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const filteredShipments = shipments.filter((s: any) => {
    if (s.tradeType !== activeTab) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        s.referenceNumber.toLowerCase().includes(q) ||
        s.vesselOrFlight.toLowerCase().includes(q) ||
        s.portOfLoading.toLowerCase().includes(q) ||
        s.portOfDischarge.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeImportsCount = shipments.filter((s: any) => s.tradeType === "import" && s.status !== "completed").length;
  const activeExportsCount = shipments.filter((s: any) => s.tradeType === "export" && s.status !== "completed").length;
  const customsPendingCount = shipments.filter((s: any) => ["pending", "submitted"].includes(s.customsStatus)).length;

  return (
    <ModuleDashboardLayout
      title="Global Trade"
      description="Manage imports, exports, vessels, and customs clearance."
      icon={Globe}
      actions={
        <Button onClick={() => setCreateOpen(true)} className="rounded-full font-bold gap-2">
          <Plus className="h-4 w-4" /> New Shipment
        </Button>
      }
      healthStats={[
        { label: "Active Imports", value: String(activeImportsCount) },
        { label: "Active Exports", value: String(activeExportsCount) },
        { label: "Customs Pending", value: String(customsPendingCount) },
      ]}
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Dynamic Tab Switcher */}
        <div className="flex gap-2 p-1.5 bg-background/60 backdrop-blur-md border border-border/50 rounded-full w-fit shadow-sm">
          <Button
            variant="ghost"
            className={`rounded-full px-8 py-2 font-semibold transition-all duration-300 ${
              activeTab === "import"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:text-white"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("import")}
          >
            Imports
          </Button>
          <Button
            variant="ghost"
            className={`rounded-full px-8 py-2 font-semibold transition-all duration-300 ${
              activeTab === "export"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-teal-500/20 hover:text-white"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("export")}
          >
            Exports
          </Button>
        </div>

        <Card className="rounded-3xl shadow-lg border-border/40 bg-card overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-br from-muted/30 to-background p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <CardTitle className="text-xl font-bold flex items-center gap-3 text-foreground">
                <div className={`p-2.5 rounded-2xl text-white ${
                  activeTab === "import" ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-indigo-500/20 shadow-lg" : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-teal-500/20 shadow-lg"
                }`}>
                  <Ship className="h-5 w-5" />
                </div>
                <span className="tracking-tight">{activeTab === "import" ? "Import Operations" : "Export Operations"}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search BL, Vessel, Port..."
                    className="pl-10 h-11 rounded-full bg-background border-border/60 shadow-sm focus-visible:ring-primary/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[200px] h-11 rounded-full bg-background border-border/60 shadow-sm focus:ring-primary/20">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pre_shipment">Pre-shipment</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="customs_clearance">Customs</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-24 text-muted-foreground space-y-4">
                <div className="p-6 rounded-full bg-muted/30">
                  <Ship className="h-14 w-14 opacity-40 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tracking-tight text-foreground">No {activeTab} shipments found.</p>
                  <p className="text-sm mt-1">Create a new global trade shipment to start tracking.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-border/40">
                      <TableHead className="pl-6 py-4 font-semibold text-muted-foreground">Reference / Order</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Logistics Route</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Schedule</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Customs Clearance</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Current Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipments.map((shipment: any) => (
                      <TableRow 
                        key={shipment._id} 
                        className="hover:bg-muted/20 cursor-pointer transition-colors border-b-border/40"
                        onClick={() => navigate(`/global-trade/${shipment._id}`)}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="font-bold text-sm tracking-tight text-foreground">{shipment.referenceNumber}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 font-semibold uppercase bg-muted/50 tracking-wider text-muted-foreground">
                              {shipment.incoterm}
                            </Badge>
                            {shipment.tradeType === 'import' && shipment.purchaseOrder?.poNumber && (
                              <span className="font-medium text-primary/80">PO: {shipment.purchaseOrder.poNumber}</span>
                            )}
                            {shipment.tradeType === 'export' && shipment.salesOrder?.orderNumber && (
                              <span className="font-medium text-primary/80">SO: {shipment.salesOrder.orderNumber}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-sm flex items-center gap-2 text-foreground">
                            {shipment.vesselOrFlight ? <Ship className="h-4 w-4 text-sky-500" /> : <Plane className="h-4 w-4 text-muted-foreground" />}
                            {shipment.vesselOrFlight || "TBD"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 font-medium">
                            <span className="max-w-[100px] truncate" title={shipment.portOfLoading}>{shipment.portOfLoading || "?"}</span>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="max-w-[100px] truncate" title={shipment.portOfDischarge}>{shipment.portOfDischarge || "?"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-xs flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 font-medium w-8">ETD:</span> 
                              <span className="font-medium text-foreground">{shipment.etd ? formatDate(shipment.etd) : 'TBD'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 font-medium w-8">ETA:</span> 
                              <span className="font-medium text-foreground">{shipment.eta ? formatDate(shipment.eta) : 'TBD'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant="secondary" 
                            className={`uppercase text-[10px] tracking-wider font-bold px-2 py-0.5 border ${
                              shipment.customsStatus === 'cleared' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              shipment.customsStatus === 'held' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}
                          >
                            {shipment.customsStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold px-2 py-0.5 shadow-sm">
                            {shipment.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Trade Shipment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Trade Type</Label>
              <Select 
                value={formData.tradeType} 
                onValueChange={(v) => setFormData(p => ({ ...p, tradeType: v, purchaseOrder: "", salesOrder: "" }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.tradeType === "import" ? (
              <div className="space-y-2">
                <Label>Purchase Order (Optional)</Label>
                <Select value={formData.purchaseOrder} onValueChange={(v) => setFormData(p => ({ ...p, purchaseOrder: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select PO..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(purchaseOrders as any[]).map(po => (
                      <SelectItem key={po._id} value={po._id}>{po.poNumber} - {po.supplierName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Sales Order (Optional)</Label>
                <Select value={formData.salesOrder} onValueChange={(v) => setFormData(p => ({ ...p, salesOrder: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select SO..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(salesOrders as any[]).map(so => (
                      <SelectItem key={so._id} value={so._id}>{so._id.slice(-6)} - {so.client?.name || 'Client'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 col-span-2">
              <Label>Reference (B/L or AWB) *</Label>
              <Input 
                className="rounded-xl" 
                value={formData.referenceNumber} 
                onChange={(e) => setFormData(p => ({ ...p, referenceNumber: e.target.value }))} 
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Vessel / Flight Name</Label>
              <Input 
                className="rounded-xl" 
                value={formData.vesselOrFlight} 
                onChange={(e) => setFormData(p => ({ ...p, vesselOrFlight: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Port of Loading</Label>
              <Input 
                className="rounded-xl" 
                value={formData.portOfLoading} 
                onChange={(e) => setFormData(p => ({ ...p, portOfLoading: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Port of Discharge</Label>
              <Input 
                className="rounded-xl" 
                value={formData.portOfDischarge} 
                onChange={(e) => setFormData(p => ({ ...p, portOfDischarge: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Incoterm</Label>
              <Select value={formData.incoterm} onValueChange={(v) => setFormData(p => ({ ...p, incoterm: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXW">EXW (Ex Works)</SelectItem>
                  <SelectItem value="FOB">FOB (Free on Board)</SelectItem>
                  <SelectItem value="CIF">CIF (Cost, Insurance, Freight)</SelectItem>
                  <SelectItem value="CFR">CFR (Cost and Freight)</SelectItem>
                  <SelectItem value="DDP">DDP (Delivered Duty Paid)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_shipment">Pre-shipment</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button 
              className="rounded-full" 
              onClick={() => createMut.mutate()} 
              disabled={!formData.referenceNumber || createMut.isPending}
            >
              Create Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleDashboardLayout>
  );
}
