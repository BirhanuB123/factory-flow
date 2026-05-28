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
import { Ship, Plane, Search, Plus, Filter, AlertCircle, FileText, Globe, Anchor, MapPin, Route } from "lucide-react";
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
  const inTransitCount = shipments.filter((s: any) => s.status === "in_transit").length;
  const arrivedCount = shipments.filter((s: any) => s.status === "arrived").length;
  const clearedCount = shipments.filter((s: any) => s.customsStatus === "cleared").length;

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
      showHeader={false}
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
              <Globe className="h-4 w-4" />
              Global trade control center
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Global Trade</h1>
                <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
                  Manage imports, exports, vessels, ports, and customs clearance from one operational register.
                </p>
              </div>
              <div className="grid min-w-full grid-cols-3 overflow-hidden rounded-[16px] border border-white/15 bg-white/10 text-center shadow-2xl shadow-black/10 backdrop-blur lg:min-w-[430px]">
                {[
                  { label: "Imports", value: activeImportsCount, tone: "text-sky-200" },
                  { label: "Exports", value: activeExportsCount, tone: "text-emerald-300" },
                  { label: "Customs", value: customsPendingCount, tone: "text-amber-300" },
                ].map((item) => (
                  <div key={item.label} className="border-r border-white/10 p-4 last:border-r-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                    <p className={`mt-2 text-2xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Button onClick={() => setCreateOpen(true)} className="h-10 gap-2 rounded-[12px] bg-white px-5 font-black text-primary hover:bg-white/90">
                <Plus className="h-4 w-4" /> New Shipment
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "In transit", value: inTransitCount, sub: "Ocean and air moves", icon: Route, tone: "text-primary", accent: "from-primary to-cyan-400" },
            { label: "Arrived", value: arrivedCount, sub: "At destination", icon: MapPin, tone: "text-emerald-600", accent: "from-emerald-500 to-teal-400" },
            { label: "Customs pending", value: customsPendingCount, sub: "Needs clearance", icon: FileText, tone: "text-amber-600", accent: "from-amber-400 to-rose-500" },
            { label: "Cleared", value: clearedCount, sub: "Ready for receipt", icon: Anchor, tone: "text-violet-600", accent: "from-violet-500 to-blue-500" },
          ].map((stat) => (
            <Card key={stat.label} className="overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className={`h-1 bg-gradient-to-r ${stat.accent}`} />
              <CardContent className="p-6">
                <div className="mb-3 flex items-center gap-2">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</h3>
                </div>
                <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex w-fit gap-2 rounded-[14px] border border-border/60 bg-card/90 p-1.5 shadow-sm backdrop-blur-md">
          <Button
            variant="ghost"
            className={`rounded-[12px] px-8 py-2 font-black transition-all duration-300 ${
              activeTab === "import"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("import")}
          >
            Imports
          </Button>
          <Button
            variant="ghost"
            className={`rounded-[12px] px-8 py-2 font-black transition-all duration-300 ${
              activeTab === "export"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-600 hover:text-white"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("export")}
          >
            Exports
          </Button>
        </div>

        <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
          <div className={`h-1 bg-gradient-to-r ${activeTab === "import" ? "from-primary via-cyan-400 to-sky-400" : "from-emerald-500 via-teal-400 to-cyan-400"}`} />
          <CardHeader className="border-b border-border/50 bg-muted/20 p-5">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight text-foreground">
                <div className={`rounded-[12px] p-2.5 text-white ${
                  activeTab === "import" ? "bg-primary" : "bg-emerald-600"
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
                    className="h-11 rounded-[12px] border-border/60 bg-background pl-10 shadow-sm focus-visible:ring-primary/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 w-full rounded-[12px] border-border/60 bg-background shadow-sm focus:ring-primary/20 md:w-[200px]">
                    <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
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
                      <TableRow className="border-b-border/40 bg-muted/10 hover:bg-muted/10">
                        <TableHead className="py-4 pl-6 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Reference / Order</TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Logistics Route</TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Schedule</TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Customs Clearance</TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Current Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipments.map((shipment: any) => (
                      <TableRow 
                        key={shipment._id} 
                        className="cursor-pointer border-b-border/40 transition-colors hover:bg-primary/[0.03]"
                        onClick={() => navigate(`/global-trade/${shipment._id}`)}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="font-bold text-sm tracking-tight text-foreground">{shipment.referenceNumber}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="rounded-[8px] bg-muted/50 px-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
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
                            <span className="text-muted-foreground/40">/</span>
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
                             className={`rounded-[8px] border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              shipment.customsStatus === 'cleared' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              shipment.customsStatus === 'held' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}
                          >
                            {shipment.customsStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                           <Badge variant="outline" className="rounded-[8px] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm">
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
        <DialogContent className="rounded-[22px] border border-border/60 p-0 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.75)] sm:max-w-xl">
          <div className="mx-5 mt-5 rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] p-5 text-white">
          <DialogHeader>
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              <Globe className="h-3.5 w-3.5" />
              Trade shipment
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-white">New Trade Shipment</DialogTitle>
          </DialogHeader>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">
            <div className="space-y-2">
              <Label>Trade Type</Label>
              <Select 
                value={formData.tradeType} 
                onValueChange={(v) => setFormData(p => ({ ...p, tradeType: v, purchaseOrder: "", salesOrder: "" }))}
              >
                <SelectTrigger className="rounded-[12px] border-border/60 bg-muted/30"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="rounded-[12px] border-border/60 bg-muted/30"><SelectValue placeholder="Select PO..." /></SelectTrigger>
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
                  <SelectTrigger className="rounded-[12px] border-border/60 bg-muted/30"><SelectValue placeholder="Select SO..." /></SelectTrigger>
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
                className="rounded-[12px] border-border/60 bg-muted/30" 
                value={formData.referenceNumber} 
                onChange={(e) => setFormData(p => ({ ...p, referenceNumber: e.target.value }))} 
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Vessel / Flight Name</Label>
              <Input 
                className="rounded-[12px] border-border/60 bg-muted/30" 
                value={formData.vesselOrFlight} 
                onChange={(e) => setFormData(p => ({ ...p, vesselOrFlight: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Port of Loading</Label>
              <Input 
                className="rounded-[12px] border-border/60 bg-muted/30" 
                value={formData.portOfLoading} 
                onChange={(e) => setFormData(p => ({ ...p, portOfLoading: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Port of Discharge</Label>
              <Input 
                className="rounded-[12px] border-border/60 bg-muted/30" 
                value={formData.portOfDischarge} 
                onChange={(e) => setFormData(p => ({ ...p, portOfDischarge: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Incoterm</Label>
              <Select value={formData.incoterm} onValueChange={(v) => setFormData(p => ({ ...p, incoterm: v }))}>
                <SelectTrigger className="rounded-[12px] border-border/60 bg-muted/30"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="rounded-[12px] border-border/60 bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_shipment">Pre-shipment</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 bg-muted/10 p-5">
            <Button variant="outline" className="rounded-[12px]" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button 
              className="rounded-[12px] font-black" 
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
