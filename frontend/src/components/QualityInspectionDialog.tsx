import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualityApi } from "@/lib/api";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ClipboardCheck,
  User,
  Package,
  Calendar,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QualityInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionJobId: string;
  operationIndex?: number;
  inspectionType: 'incoming' | 'in_process' | 'final';
  jobId: string; // The display ID like JOB-123
  productName: string;
}

export default function QualityInspectionDialog({
  open,
  onOpenChange,
  productionJobId,
  operationIndex,
  inspectionType,
  jobId,
  productName
}: QualityInspectionDialogProps) {
  const queryClient = useQueryClient();
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [quantityInspected, setQuantityInspected] = useState<number>(1);
  const [inspector, setInspector] = useState("");

  const { data: checklists, isLoading: loadingChecklists } = useQuery({
    queryKey: ["quality-checklists-search", inspectionType],
    queryFn: () => qualityApi.searchChecklists(inspectionType),
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: qualityApi.submitInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-job", productionJobId] });
      queryClient.invalidateQueries({ queryKey: ["production-jobs"] });
      onOpenChange(false);
      toast.success("Inspection submitted successfully");
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to submit inspection");
    }
  });

  const resetForm = () => {
    setSelectedChecklist(null);
    setResults([]);
    setNotes("");
    setQuantityInspected(1);
  };

  useEffect(() => {
    if (checklists?.length === 1 && !selectedChecklist) {
      handleSelectChecklist(checklists[0]);
    }
  }, [checklists]);

  const handleSelectChecklist = (cl: any) => {
    setSelectedChecklist(cl);
    setResults(cl.items.map((it: any) => ({
      prompt: it.prompt,
      value: it.responseType === 'boolean' ? true : "",
      status: it.responseType === 'boolean' ? 'pass' : 'na',
      required: it.required,
      responseType: it.responseType,
      minValue: it.minValue,
      maxValue: it.maxValue
    })));
  };

  const updateResult = (index: number, field: string, value: any) => {
    const newResults = [...results];
    const res = { ...newResults[index], [field]: value };
    
    // Auto-update status for numeric
    if (res.responseType === 'numeric' && field === 'value' && value !== "") {
      const val = Number(value);
      let status: 'pass' | 'fail' = 'pass';
      if (res.minValue != null && val < res.minValue) status = 'fail';
      if (res.maxValue != null && val > res.maxValue) status = 'fail';
      res.status = status;
    } else if (res.responseType === 'boolean' && field === 'value') {
      res.status = value ? 'pass' : 'fail';
    }

    newResults[index] = res;
    setResults(newResults);
  };

  const handleSubmit = () => {
    if (!selectedChecklist) return toast.error("Please select a checklist");
    
    const missingRequired = results.some((r, i) => {
      const it = selectedChecklist.items[i];
      return it.required && (r.value === "" || r.value === null || r.value === undefined);
    });

    if (missingRequired) return toast.error("Please complete all required fields");

    submitMutation.mutate({
      productionJob: productionJobId,
      operationIndex,
      inspectionType,
      checklist: selectedChecklist._id,
      checklistResults: results,
      notes,
      quantityInspected,
      inspector
    });
  };

  const overallPass = results.length > 0 && results.every(r => r.status !== 'fail');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Quality Inspection Form</DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-widest font-bold text-muted-foreground/60">
                  {inspectionType.replace('_', ' ')} Inspection
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Target Job / Product</p>
                <p className="font-bold text-sm">{jobId} — {productName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Inspector Identity</p>
                <Input 
                  value={inspector} 
                  onChange={e => setInspector(e.target.value)} 
                  placeholder="Enter your name" 
                  className="h-8 rounded-lg bg-background border-none shadow-none text-sm font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Template Selection</Label>
            <Select 
              value={selectedChecklist?._id || ""} 
              onValueChange={(id) => handleSelectChecklist(checklists?.find((c: any) => c._id === id))}
            >
              <SelectTrigger className="h-12 rounded-2xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold text-sm px-5">
                <SelectValue placeholder="Choose a checklist template..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {checklists?.map((cl: any) => (
                  <SelectItem key={cl._id} value={cl._id}>{cl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedChecklist && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black uppercase tracking-tighter italic text-foreground/80">Inspection Points</h3>
                <div className="flex items-center gap-2">
                   <Label className="text-xs">Inspected Qty</Label>
                   <Input 
                    type="number" 
                    value={quantityInspected} 
                    onChange={e => setQuantityInspected(Number(e.target.value))} 
                    className="w-20 h-8 rounded-lg text-xs font-bold"
                   />
                </div>
              </div>

              <div className="grid gap-3">
                {results.map((res, i) => (
                  <div 
                    key={i} 
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl border transition-all duration-300 ${
                      res.status === 'pass' ? 'bg-emerald-50/50 border-emerald-500/20' : 
                      res.status === 'fail' ? 'bg-red-50/50 border-red-500/20' : 
                      'bg-card border-border/50'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-sm">{res.prompt}</span>
                         {res.required && <Badge variant="secondary" className="text-[9px] px-1.5 h-4">Req</Badge>}
                      </div>
                      {res.responseType === 'numeric' && (res.minValue != null || res.maxValue != null) && (
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">
                          Limit: {res.minValue ?? '-∞'} to {res.maxValue ?? '+∞'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {res.responseType === 'boolean' ? (
                        <div className="flex bg-muted/40 p-1 rounded-2xl border border-border/50">
                           <Button 
                            variant={res.value === true ? "default" : "ghost"} 
                            size="sm"
                            className={`rounded-xl h-10 px-4 transition-all ${res.value === true ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20' : ''}`}
                            onClick={() => updateResult(i, 'value', true)}
                           >
                             <CheckCircle2 className={`h-4 w-4 ${res.value === true ? 'mr-2' : ''}`} />
                             {res.value === true && "Pass"}
                           </Button>
                           <Button 
                            variant={res.value === false ? "destructive" : "ghost"} 
                            size="sm"
                            className={`rounded-xl h-10 px-4 transition-all ${res.value === false ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : ''}`}
                            onClick={() => updateResult(i, 'value', false)}
                           >
                             <XCircle className={`h-4 w-4 ${res.value === false ? 'mr-2' : ''}`} />
                             {res.value === false && "Fail"}
                           </Button>
                        </div>
                      ) : res.responseType === 'numeric' ? (
                        <div className="flex items-center gap-2">
                           <Input 
                            type="number" 
                            value={res.value} 
                            onChange={e => updateResult(i, 'value', e.target.value)} 
                            className={`w-32 h-10 rounded-xl text-center font-bold ${res.status === 'fail' ? 'border-red-500 bg-red-50' : ''}`}
                            placeholder="Value"
                           />
                           {res.status === 'fail' && <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />}
                           {res.status === 'pass' && res.value !== "" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                        </div>
                      ) : (
                        <Input 
                          value={res.value} 
                          onChange={e => updateResult(i, 'value', e.target.value)} 
                          className="w-48 h-10 rounded-xl text-sm"
                          placeholder="Observation..."
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Additional Observations</Label>
                <Textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Enter any non-conformances or special remarks..." 
                  className="rounded-2xl bg-muted/20 border-none min-h-[100px]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/10">
          <div className="flex items-center justify-between mb-4 px-2">
             <div className="flex items-center gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overall Compliance</p>
                {results.length > 0 && (
                  <Badge className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase italic shadow-lg ${overallPass ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                    {overallPass ? "Ready for Release" : "Revision Required"}
                  </Badge>
                )}
             </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl px-6" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              className={`rounded-xl px-10 h-12 font-black uppercase tracking-widest shadow-xl transition-all ${overallPass ? 'bg-primary shadow-primary/20' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              onClick={handleSubmit}
              disabled={submitMutation.isPending || results.length === 0}
            >
              {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ClipboardCheck className="h-5 w-5 mr-2" />}
              Submit Inspection
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
