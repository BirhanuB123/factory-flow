import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "@/lib/api";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Play, CheckCircle, Package, ArrowRight } from "lucide-react";

export default function ProductionKiosk() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [scannedToken, setScannedToken] = useState<string | null>(token || null);
  const [isScanning, setIsScanning] = useState(!token);
  
  const [wipModalOpen, setWipModalOpen] = useState(false);
  const [activeOpIndex, setActiveOpIndex] = useState<number | null>(null);
  const [wipInQty, setWipInQty] = useState<number>(0);
  const [wipOutQty, setWipOutQty] = useState<number>(0);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['kiosk-job', scannedToken],
    queryFn: () => productionApi.getByToken(scannedToken!),
    enabled: !!scannedToken,
    retry: false
  });

  useEffect(() => {
    if (error) {
      toast.error("Invalid or expired Traveler token");
      setScannedToken(null);
      setIsScanning(true);
    }
  }, [error]);

  const handleScanSuccess = (decodedText: string) => {
    try {
      // Decode if it's a full URL, e.g., http://.../kiosk/production/TOKEN-123
      const url = new URL(decodedText);
      const parts = url.pathname.split('/');
      const scanned = parts[parts.length - 1];
      if (scanned) {
        setScannedToken(scanned);
        setIsScanning(false);
        navigate(`/kiosk/production/${scanned}`, { replace: true });
      }
    } catch {
      // If it's not a URL, maybe it's just the token
      setScannedToken(decodedText);
      setIsScanning(false);
      navigate(`/kiosk/production/${decodedText}`, { replace: true });
    }
  };

  const startMutation = useMutation({
    mutationFn: (opIndex: number) => productionApi.startOperation(job._id, opIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-job', scannedToken] });
      toast.success("Operation started");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to start operation")
  });

  const completeMutation = useMutation({
    mutationFn: (opIndex: number) => productionApi.completeOperation(job._id, opIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-job', scannedToken] });
      toast.success("Operation completed");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to complete operation")
  });

  const logWipMutation = useMutation({
    mutationFn: ({ opIndex, data }: { opIndex: number, data: any }) => productionApi.logOperationWip(job._id, opIndex, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-job', scannedToken] });
      toast.success("WIP updated successfully");
      setWipModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to log WIP")
  });

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center pt-10">
        <div className="mb-8 text-center space-y-2">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Scan Job Traveler</h1>
          <p className="text-muted-foreground text-sm font-medium">Position the QR code within the frame to load operations.</p>
        </div>
        
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess} 
          onScanError={(err) => console.log(err)} 
        />
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-20 animate-pulse text-muted-foreground font-bold">Loading Job Data...</div>;
  }

  if (!job) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-[#1a2744]">
            {job.jobId}
          </h1>
          <p className="font-bold text-muted-foreground">Target Qty: {job.quantity}</p>
        </div>
        <Button variant="outline" onClick={() => { setScannedToken(null); setIsScanning(true); navigate('/kiosk/production'); }}>
          Scan Another
        </Button>
      </div>

      <div className="grid gap-4">
        {job.operations?.map((op: any, idx: number) => (
          <Card key={idx} className={`border-l-4 shadow-md ${op.status === 'done' ? 'border-l-emerald-500 bg-emerald-50/50' : op.status === 'active' ? 'border-l-primary bg-primary/5' : 'border-l-border'}`}>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={op.status === 'done' ? 'success' : op.status === 'active' ? 'default' : 'secondary'} className="uppercase font-black text-[10px]">
                    {op.status}
                  </Badge>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    WC: {op.workCenterCode}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{idx + 1}. {op.name}</h3>
                
                <div className="mt-2 flex gap-4 text-sm font-semibold text-muted-foreground">
                  <div><span className="text-xs uppercase">In:</span> {op.wipInQty || 0}</div>
                  <div><span className="text-xs uppercase">Out:</span> {op.wipOutQty || 0}</div>
                  <div><span className="text-xs uppercase">Scrap:</span> {op.scrapQty || 0}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                {op.status === 'pending' && (
                  <Button size="lg" className="w-full sm:w-auto font-black uppercase italic" onClick={() => startMutation.mutate(idx)} disabled={startMutation.isPending}>
                    <Play className="mr-2 h-4 w-4" /> Start
                  </Button>
                )}
                
                {op.status === 'active' && (
                  <>
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="flex-1 sm:flex-none font-black uppercase italic" 
                      onClick={() => {
                        setActiveOpIndex(idx);
                        setWipInQty(op.wipInQty || 0);
                        setWipOutQty(op.wipOutQty || 0);
                        setWipModalOpen(true);
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" /> Log WIP
                    </Button>
                    <Button 
                      size="lg" 
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase italic" 
                      onClick={() => completeMutation.mutate(idx)}
                      disabled={completeMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={wipModalOpen} onOpenChange={setWipModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase">Log Work in Progress</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">WIP Received (Input)</Label>
              <Input 
                type="number" 
                min={0}
                className="h-14 text-2xl font-mono font-black"
                value={wipInQty} 
                onChange={e => setWipInQty(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="flex justify-center text-muted-foreground">
              <ArrowRight className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">WIP Completed (Output)</Label>
              <Input 
                type="number" 
                min={0}
                className="h-14 text-2xl font-mono font-black"
                value={wipOutQty} 
                onChange={e => setWipOutQty(parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipModalOpen(false)} className="h-12 w-full sm:w-auto font-black uppercase italic">Cancel</Button>
            <Button 
              className="h-12 w-full sm:w-auto font-black uppercase italic shadow-lg"
              disabled={logWipMutation.isPending}
              onClick={() => {
                if (activeOpIndex !== null) {
                  logWipMutation.mutate({ opIndex: activeOpIndex, data: { wipInQty, wipOutQty } });
                }
              }}
            >
              Update Quantities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
