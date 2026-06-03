import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tradeApi, hrEmployeesApi, apApi } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  ArrowLeft, Save, Container, FileCheck, Anchor, Plane, RefreshCw, Plus, Trash2,
  Users, CreditCard, PlusCircle, Briefcase, FileText
} from "lucide-react";
import { toast } from "sonner";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";

type ContainerDetail = {
  containerNumber: string;
  sealNumber: string;
  type: "20ft" | "40ft" | "LCL";
};

type Documents = {
  commercialInvoice?: boolean;
  packingList?: boolean;
  certificateOfOrigin?: boolean;
  billOfLading?: boolean;
  exportPermit?: boolean;
  [key: string]: boolean | undefined;
};

type ExpenseBill = {
  _id: string;
  billNumber?: string;
  vendor?: { name?: string };
  status?: string;
  dueDate: string;
  amount?: number;
};

type ReceiptEntry = {
  _id: string;
  product?: { name?: string; unit?: string; sku?: string };
  delta?: number;
  createdAt: string;
  lotNumber?: string;
};

type ClearingAgentInfo = {
  _id?: string;
  name?: string;
  employeeId?: string;
};

type TradeShipmentFormData = {
  referenceNumber?: string;
  tradeType?: string;
  vesselOrFlight?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: string;
  eta?: string;
  clearingAgent?: string;
  status?: string;
  customsStatus?: string;
  incoterm?: string;
  documents?: Documents;
  notes?: string;
  containerDetails?: ContainerDetail[];
  purchaseOrder?: { importFreight?: number; importDuty?: number; importClearing?: number };
  expenses?: ExpenseBill[];
  dynamicReceipts?: ReceiptEntry[];
};

type TradeShipmentApiResponse = Omit<TradeShipmentFormData, "clearingAgent"> & {
  clearingAgent?: ClearingAgentInfo | string;
};

type ExpenseForm = {
  expenseType: "freight" | "duty" | "clearing";
  amount: number;
  vendorId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  notes: string;
};

type Employee = {
  _id: string;
  name?: string;
  id?: string;
  employeeId?: string;
};

type Vendor = {
  _id: string;
  name?: string;
  code?: string;
};

function getApiErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response: { data?: unknown } }).response?.data &&
    typeof (error as { response: { data?: { message?: unknown } } }).response?.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }

  if (error instanceof Error) return error.message;
  return undefined;
}

export default function GlobalTradeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { formatDate } = useEthiopianDateDisplay();
  const qc = useQueryClient();

  const [formData, setFormData] = useState<TradeShipmentFormData | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    expenseType: "duty",
    amount: 0,
    vendorId: "",
    billNumber: "",
    billDate: "",
    dueDate: "",
    notes: "",
  });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  const { data: shipment, isLoading } = useQuery<TradeShipmentApiResponse>({
    queryKey: ["trade-shipment", id],
    queryFn: () => tradeApi.getOne(id!),
    enabled: !!id,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["hr-employees"],
    queryFn: () => hrEmployeesApi.list(),
  });

  const { data: vendorsData } = useQuery<Vendor[]>({
    queryKey: ["ap-vendors"],
    queryFn: () => apApi.listVendors(),
  });

  useEffect(() => {
    if (shipment) {
      setFormData({
        ...shipment,
        etd: shipment.etd ? shipment.etd.split('T')[0] : '',
        eta: shipment.eta ? shipment.eta.split('T')[0] : '',
        clearingAgent:
          typeof shipment.clearingAgent === "object" && shipment.clearingAgent !== null
            ? shipment.clearingAgent._id || ''
            : typeof shipment.clearingAgent === "string"
            ? shipment.clearingAgent
            : '',
      });
    }
  }, [shipment]);

  const updateMut = useMutation({
    mutationFn: (data: Partial<TradeShipmentFormData>) => tradeApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-shipment", id] });
      qc.invalidateQueries({ queryKey: ["trade-shipments"] });
      toast.success("Shipment updated successfully");
      setIsEditing(false);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error) || "Failed to update"),
  });

  const logExpenseMut = useMutation({
    mutationFn: (data: ExpenseForm) => tradeApi.logExpense(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-shipment", id] });
      toast.success("Expense logged and Vendor Bill created successfully");
      setIsExpenseDialogOpen(false);
      setExpenseForm({
        expenseType: "duty",
        amount: 0,
        vendorId: "",
        billNumber: "",
        billDate: "",
        dueDate: "",
        notes: "",
      });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error) || "Failed to log expense"),
  });

  if (isLoading || !formData) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleSave = () => {
    const payload = {
      ...formData,
      clearingAgent: formData.clearingAgent === '' ? null : formData.clearingAgent,
    };
    updateMut.mutate(payload);
  };

  const handleAddContainer = () => {
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        containerDetails: [...(prev.containerDetails ?? []), { containerNumber: "", sealNumber: "", type: "20ft" }],
      };
    });
  };

  const handleRemoveContainer = (index: number) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const updated = [...(prev.containerDetails ?? [])];
      updated.splice(index, 1);
      return { ...prev, containerDetails: updated };
    });
  };

  const handleContainerChange = (index: number, field: keyof ContainerDetail, value: string) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const updated = [...(prev.containerDetails ?? [])];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], [field]: value } as ContainerDetail;
      return { ...prev, containerDetails: updated };
    });
  };

  const handleDocumentChange = (docName: string, value: boolean) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: { ...(prev.documents ?? {}), [docName]: value },
      };
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (!shipment) return;
    setFormData({
      ...shipment,
      etd: shipment.etd ? shipment.etd.split('T')[0] : '',
      eta: shipment.eta ? shipment.eta.split('T')[0] : '',
      clearingAgent:
        typeof shipment.clearingAgent === "object" && shipment.clearingAgent !== null
          ? shipment.clearingAgent._id || ''
          : typeof shipment.clearingAgent === "string"
          ? shipment.clearingAgent
          : '',
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/global-trade")} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{formData.referenceNumber}</h1>
              <Badge variant="outline" className="uppercase bg-muted/50 tracking-wider">
                {formData.tradeType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              {formData.vesselOrFlight ? <ShipmentIcon isFlight={!formData.vesselOrFlight.toLowerCase().includes('vessel')} /> : <Anchor className="h-4 w-4" />}
              {formData.vesselOrFlight || "Vessel/Flight Pending"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} className="rounded-full px-6">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMut.isPending} className="rounded-full px-6 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-indigo-500/20 text-white">
                {updateMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="rounded-full px-6 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-teal-500/20 text-white">
              Edit Shipment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Logistics & Schedule */}
        <Card className="md:col-span-2 rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <Anchor className="h-5 w-5 text-indigo-500" />
              Logistics Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Vessel / Flight Name</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.vesselOrFlight || ""} onChange={(e) => setFormData({ ...formData, vesselOrFlight: e.target.value })} />
              ) : (
                <p className="font-semibold text-foreground">{formData.vesselOrFlight || "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reference Number (B/L or AWB)</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.referenceNumber || ""} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} />
              ) : (
                <p className="font-semibold text-foreground">{formData.referenceNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Port of Loading</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.portOfLoading || ""} onChange={(e) => setFormData({ ...formData, portOfLoading: e.target.value })} />
              ) : (
                <p className="font-medium text-foreground">{formData.portOfLoading || "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Port of Discharge</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.portOfDischarge || ""} onChange={(e) => setFormData({ ...formData, portOfDischarge: e.target.value })} />
              ) : (
                <p className="font-medium text-foreground">{formData.portOfDischarge || "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estimated Time of Departure (ETD)</Label>
              {isEditing ? (
                <Input type="date" className="rounded-xl" value={formData.etd || ""} onChange={(e) => setFormData({ ...formData, etd: e.target.value })} />
              ) : (
                <p className="font-medium text-foreground">{formData.etd ? formatDate(formData.etd) : "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estimated Time of Arrival (ETA)</Label>
              {isEditing ? (
                <Input type="date" className="rounded-xl" value={formData.eta || ""} onChange={(e) => setFormData({ ...formData, eta: e.target.value })} />
              ) : (
                <p className="font-medium text-foreground">{formData.eta ? formatDate(formData.eta) : "—"}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statuses */}
        <Card className="rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-500" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label>Shipment Status</Label>
              {isEditing ? (
                <Select value={formData.status || ""} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_shipment">Pre-shipment</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="customs_clearance">Customs</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1"><Badge className="uppercase tracking-wider px-3 py-1 rounded-full">{formData.status?.replace('_', ' ')}</Badge></div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Customs Status</Label>
              {isEditing ? (
                <Select value={formData.customsStatus || ""} onValueChange={(v) => setFormData({ ...formData, customsStatus: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="held">Held</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1">
                  <Badge
                    variant="secondary"
                    className={`uppercase tracking-wider px-3 py-1 rounded-full border ${formData.customsStatus === 'cleared' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      formData.customsStatus === 'held' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                  >
                    {formData.customsStatus}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Incoterm</Label>
              {isEditing ? (
                <Select value={formData.incoterm || ""} onValueChange={(v) => setFormData({ ...formData, incoterm: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="FCA">FCA</SelectItem>
                    <SelectItem value="FOB">FOB</SelectItem>
                    <SelectItem value="CFR">CFR</SelectItem>
                    <SelectItem value="CIF">CIF</SelectItem>
                    <SelectItem value="DAP">DAP</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{formData.incoterm}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Containers */}
        <Card className="md:col-span-2 rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Container className="h-5 w-5 text-sky-500" />
              Container Tracking
            </CardTitle>
            {isEditing && (
              <Button size="sm" variant="outline" onClick={handleAddContainer} className="rounded-full shadow-sm text-xs h-8">
                <Plus className="h-3 w-3 mr-1" /> Add Container
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {formData.containerDetails?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/5 border-b-border/40">
                    <TableHead className="pl-6">Container Number</TableHead>
                    <TableHead>Seal Number</TableHead>
                    <TableHead>Type</TableHead>
                    {isEditing && <TableHead className="w-16"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.containerDetails?.map((c, i) => (
                    <TableRow key={i} className="border-b-border/40">
                      <TableCell className="pl-6">
                        {isEditing ? <Input className="h-8 rounded-lg" value={c.containerNumber} onChange={e => handleContainerChange(i, 'containerNumber', e.target.value)} /> : c.containerNumber}
                      </TableCell>
                      <TableCell>
                        {isEditing ? <Input className="h-8 rounded-lg" value={c.sealNumber} onChange={e => handleContainerChange(i, 'sealNumber', e.target.value)} /> : c.sealNumber || "—"}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select value={c.type} onValueChange={v => handleContainerChange(i, 'type', v)}>
                            <SelectTrigger className="h-8 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20ft">20ft</SelectItem>
                              <SelectItem value="40ft">40ft</SelectItem>
                              <SelectItem value="LCL">LCL</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="bg-muted/30">{c.type}</Badge>
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleRemoveContainer(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center p-10 text-muted-foreground">
                <Container className="h-10 w-10 mx-auto opacity-20 mb-2" />
                <p>No containers added yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HR Agent Assignment */}
        <Card className="rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-500" />
              HR Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Label className="font-semibold text-foreground">Customs Clearing Agent</Label>
              {isEditing ? (
                <Select
                  value={formData.clearingAgent || "none"}
                  onValueChange={(v) => setFormData({ ...formData, clearingAgent: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Assign Clearing Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees?.map((emp) => (
                      <SelectItem key={emp._id} value={emp._id}>{emp.name} ({emp.id || emp.employeeId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/40">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {typeof shipment?.clearingAgent === "object" && shipment?.clearingAgent !== null
                        ? shipment.clearingAgent.name
                        : "Unassigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeof shipment?.clearingAgent === "object" && shipment?.clearingAgent?.employeeId ? `ID: ${shipment.clearingAgent.employeeId}` : "No agent assigned"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="md:col-span-2 rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              Required Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'commercialInvoice', label: 'Commercial Invoice' },
                { key: 'packingList', label: 'Packing List' },
                { key: 'certificateOfOrigin', label: 'Certificate of Origin' },
                { key: 'billOfLading', label: 'Bill of Lading / AWB' },
                ...(formData.tradeType === 'export' ? [{ key: 'exportPermit', label: 'Export Permit' }] : []),
              ].map(doc => (
                <div key={doc.key} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10">
                  <Label className="font-medium cursor-pointer" htmlFor={`doc-${doc.key}`}>{doc.label}</Label>
                  <Switch
                    id={`doc-${doc.key}`}
                    disabled={!isEditing}
                    checked={formData.documents?.[doc.key] || false}
                    onCheckedChange={(v) => handleDocumentChange(doc.key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <Label>Notes / Remarks</Label>
              {isEditing ? (
                <Textarea
                  className="rounded-xl resize-none min-h-[100px]"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any customs or logistics remarks..."
                />
              ) : (
                <div className="p-4 bg-muted/20 rounded-xl min-h-[100px] border border-border/40 text-sm whitespace-pre-wrap">
                  {formData.notes || <span className="text-muted-foreground italic">No notes added.</span>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Empty placeholder or small summary to balance grid */}
        <Card className="rounded-3xl shadow-sm border-border/40 p-6 flex flex-col justify-center items-center text-center">
          <Anchor className="h-12 w-12 text-muted-foreground/30 mb-2 animate-bounce duration-[4000ms]" />
          <h3 className="font-semibold text-foreground text-sm">Logistics Overview</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Keep documentation up to date to guarantee fast customs clearance.</p>
        </Card>
      </div>

      {/* Finance & Inventory Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Landed Costs & Finance */}
        <Card className="md:col-span-2 rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sky-500" />
              Finance & Landed Costs
            </CardTitle>
            <CardDescription>Automate landed cost tracking and Vendor Bill linking.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Real-time Landed Cost Summary */}
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Real-time Landed Costs on Purchase Order</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-muted/10 border border-border/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Freight</p>
                  <p className="text-lg font-bold mt-1 text-sky-600">{formData.purchaseOrder?.importFreight?.toFixed(2) || "0.00"} ETB</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/10 border border-border/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Duty</p>
                  <p className="text-lg font-bold mt-1 text-amber-600">{formData.purchaseOrder?.importDuty?.toFixed(2) || "0.00"} ETB</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/10 border border-border/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Clearing</p>
                  <p className="text-lg font-bold mt-1 text-emerald-600">{formData.purchaseOrder?.importClearing?.toFixed(2) || "0.00"} ETB</p>
                </div>
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-primary/80 uppercase tracking-widest font-bold">Total Pool</p>
                  <p className="text-lg font-black mt-1 text-primary">
                    {((formData.purchaseOrder?.importFreight || 0) +
                      (formData.purchaseOrder?.importDuty || 0) +
                      (formData.purchaseOrder?.importClearing || 0)).toFixed(2)} ETB
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Bills associated with shipment */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Associated Vendor Bills</h3>
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/95 text-white gap-2">
                      <PlusCircle className="h-4 w-4" /> Log Customs/Freight Bill
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-2xl border-border/40 shadow-xl bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold">Log Landed Cost Bill</DialogTitle>
                      <DialogDescription>Log a freight, duty, or customs clearing agent bill to automatically create a Vendor Bill and update the Purchase Order landed costs.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Expense Type</Label>
                        <Select value={expenseForm.expenseType} onValueChange={(v) => setExpenseForm({ ...expenseForm, expenseType: v as ExpenseForm["expenseType"] })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="freight">Ocean/Air Freight</SelectItem>
                            <SelectItem value="duty">Customs Duty</SelectItem>
                            <SelectItem value="clearing">Clearing Agent Fees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Vendor (AP Link)</Label>
                        <Select value={expenseForm.vendorId} onValueChange={(v) => setExpenseForm({ ...expenseForm, vendorId: v })}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                          <SelectContent>
                            {vendorsData?.map((v) => (
                              <SelectItem key={v._id} value={v._id}>{v.name} ({v.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bill Amount (ETB)</Label>
                          <Input type="number" className="rounded-xl" value={expenseForm.amount || ""} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bill Reference Number</Label>
                          <Input className="rounded-xl" value={expenseForm.billNumber} onChange={(e) => setExpenseForm({ ...expenseForm, billNumber: e.target.value })} placeholder="e.g. INV-1002" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bill Date</Label>
                          <Input type="date" className="rounded-xl" value={expenseForm.billDate} onChange={(e) => setExpenseForm({ ...expenseForm, billDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" className="rounded-xl" value={expenseForm.dueDate} onChange={(e) => setExpenseForm({ ...expenseForm, dueDate: e.target.value })} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes / Details</Label>
                        <Textarea className="rounded-xl resize-none min-h-[80px]" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Additional expense notes..." />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)} className="rounded-xl">Cancel</Button>
                      <Button onClick={() => logExpenseMut.mutate(expenseForm)} disabled={logExpenseMut.isPending} className="rounded-xl bg-primary text-white">
                        {logExpenseMut.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />} Log Expense
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {formData.expenses?.length > 0 ? (
                <div className="rounded-2xl border border-border/40 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.expenses?.map((bill) => (
                        <TableRow key={bill._id}>
                          <TableCell className="font-semibold text-foreground">{bill.billNumber}</TableCell>
                          <TableCell>{bill.vendor?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={bill.status === 'Paid' ? 'success' : 'outline'} className="rounded-full">
                              {bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(bill.dueDate)}</TableCell>
                          <TableCell className="text-right font-bold text-foreground">{bill.amount?.toFixed(2)} ETB</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center p-8 bg-muted/5 rounded-2xl border border-dashed border-border/60 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">No expenses or vendor bills have been logged against this shipment yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock Receipts from Inventory */}
        <Card className="rounded-3xl shadow-sm border-border/40 flex flex-col">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              Stock Receipts
            </CardTitle>
            <CardDescription>Real-time stock movements logged under Purchase Order receipts.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col justify-center">
            {formData.dynamicReceipts?.length > 0 ? (
              <div className="divide-y divide-border/40 max-h-[380px] overflow-y-auto w-full">
                {formData.dynamicReceipts?.map((rcpt) => (
                  <div key={rcpt._id} className="p-4 flex flex-col gap-1 hover:bg-muted/5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm">{rcpt.product?.name || "Product"}</span>
                      <Badge variant="success" className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">
                        +{rcpt.delta} {rcpt.product?.unit || "units"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>SKU: {rcpt.product?.sku || "—"}</span>
                      <span>{formatDate(rcpt.createdAt)}</span>
                    </div>
                    {rcpt.lotNumber && (
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md font-mono self-start mt-1">Lot: {rcpt.lotNumber}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground my-auto">
                <RefreshCw className="h-8 w-8 mx-auto opacity-30 mb-2 animate-pulse" />
                <p className="text-sm">Waiting for inventory receipts...</p>
                <p className="text-xs mt-1 text-muted-foreground/80">Intake can be completed on the linked Purchase Order screen.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ShipmentIcon({ isFlight }: { isFlight: boolean }) {
  return isFlight ? <Plane className="h-4 w-4" /> : <Anchor className="h-4 w-4" />;
}
