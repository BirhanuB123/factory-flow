import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tradeApi } from "@/lib/api";
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
import { ArrowLeft, Save, Container, FileCheck, Anchor, Plane, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEthiopianDateDisplay } from "@/hooks/use-ethiopian-date";

export default function GlobalTradeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { formatDate } = useEthiopianDateDisplay();
  const qc = useQueryClient();

  const [formData, setFormData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["trade-shipment", id],
    queryFn: () => tradeApi.getOne(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (shipment) {
      setFormData({
        ...shipment,
        etd: shipment.etd ? shipment.etd.split('T')[0] : '',
        eta: shipment.eta ? shipment.eta.split('T')[0] : '',
      });
    }
  }, [shipment]);

  const updateMut = useMutation({
    mutationFn: (data: any) => tradeApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-shipment", id] });
      qc.invalidateQueries({ queryKey: ["trade-shipments"] });
      toast.success("Shipment updated successfully");
      setIsEditing(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  if (isLoading || !formData) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleSave = () => {
    updateMut.mutate(formData);
  };

  const handleAddContainer = () => {
    setFormData((prev: any) => ({
      ...prev,
      containerDetails: [...(prev.containerDetails || []), { containerNumber: "", sealNumber: "", type: "20ft" }],
    }));
  };

  const handleRemoveContainer = (index: number) => {
    setFormData((prev: any) => {
      const updated = [...prev.containerDetails];
      updated.splice(index, 1);
      return { ...prev, containerDetails: updated };
    });
  };

  const handleContainerChange = (index: number, field: string, value: string) => {
    setFormData((prev: any) => {
      const updated = [...prev.containerDetails];
      updated[index][field] = value;
      return { ...prev, containerDetails: updated };
    });
  };

  const handleDocumentChange = (docName: string, value: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      documents: { ...prev.documents, [docName]: value },
    }));
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
              <Button variant="outline" onClick={() => { setIsEditing(false); setFormData(shipment); }} className="rounded-full px-6">
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
                <Input className="rounded-xl" value={formData.vesselOrFlight} onChange={(e) => setFormData({...formData, vesselOrFlight: e.target.value})} />
              ) : (
                <p className="font-semibold text-foreground">{formData.vesselOrFlight || "—"}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Reference Number (B/L or AWB)</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.referenceNumber} onChange={(e) => setFormData({...formData, referenceNumber: e.target.value})} />
              ) : (
                <p className="font-semibold text-foreground">{formData.referenceNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Port of Loading</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.portOfLoading} onChange={(e) => setFormData({...formData, portOfLoading: e.target.value})} />
              ) : (
                <p className="font-medium text-foreground">{formData.portOfLoading || "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Port of Discharge</Label>
              {isEditing ? (
                <Input className="rounded-xl" value={formData.portOfDischarge} onChange={(e) => setFormData({...formData, portOfDischarge: e.target.value})} />
              ) : (
                <p className="font-medium text-foreground">{formData.portOfDischarge || "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estimated Time of Departure (ETD)</Label>
              {isEditing ? (
                <Input type="date" className="rounded-xl" value={formData.etd} onChange={(e) => setFormData({...formData, etd: e.target.value})} />
              ) : (
                <p className="font-medium text-foreground">{formData.etd ? formatDate(formData.etd) : "—"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estimated Time of Arrival (ETA)</Label>
              {isEditing ? (
                <Input type="date" className="rounded-xl" value={formData.eta} onChange={(e) => setFormData({...formData, eta: e.target.value})} />
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
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
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
                <div className="mt-1"><Badge className="uppercase tracking-wider px-3 py-1 rounded-full">{formData.status.replace('_', ' ')}</Badge></div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Customs Status</Label>
              {isEditing ? (
                <Select value={formData.customsStatus} onValueChange={(v) => setFormData({...formData, customsStatus: v})}>
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
                    className={`uppercase tracking-wider px-3 py-1 rounded-full border ${
                      formData.customsStatus === 'cleared' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
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
                <Select value={formData.incoterm} onValueChange={(v) => setFormData({...formData, incoterm: v})}>
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
                  {formData.containerDetails.map((c: any, i: number) => (
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
                            <SelectTrigger className="h-8 rounded-lg"><SelectValue/></SelectTrigger>
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

        {/* Documents */}
        <Card className="rounded-3xl shadow-sm border-border/40">
          <CardHeader className="border-b bg-muted/10 p-5">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              Required Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
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
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
      </div>
    </div>
  );
}

function ShipmentIcon({ isFlight }: { isFlight: boolean }) {
  return isFlight ? <Plane className="h-4 w-4" /> : <Anchor className="h-4 w-4" />;
}
