import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, locationsApi, inventoryMovementsApi } from "@/lib/api";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScanBarcode, PackagePlus, ArrowRight, XCircle } from "lucide-react";

export default function ReceivingKiosk() {
  const queryClient = useQueryClient();
  const [scannedSku, setScannedSku] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  const [qty, setQty] = useState<number>(1);
  const [locationId, setLocationId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: locationsApi.getAll,
  });

  const selectedProduct = inventory.find((p: any) => p.sku === scannedSku || p._id === scannedSku);

  const receiptMutation = useMutation({
    mutationFn: (data: any) => inventoryMovementsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success("Inventory received successfully");
      handleReset();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to log receipt");
    }
  });

  const handleScanSuccess = (decodedText: string) => {
    setScannedSku(decodedText);
    setIsScanning(false);
  };

  const handleReset = () => {
    setScannedSku(null);
    setIsScanning(true);
    setQty(1);
    setLocationId("");
    setNote("");
  };

  const handleSubmit = () => {
    if (!selectedProduct) return toast.error("Product not identified");
    if (qty <= 0) return toast.error("Quantity must be positive");
    
    receiptMutation.mutate({
      productId: selectedProduct._id,
      kind: 'receipt',
      quantity: qty,
      locationId: locationId || null,
      note: note || 'Kiosk Receipt'
    });
  };

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center pt-10">
        <div className="mb-8 text-center space-y-2">
          <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ScanBarcode className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Receiving Dock</h1>
          <p className="text-muted-foreground text-sm font-medium">Scan Product SKU or Barcode to log receipt.</p>
        </div>
        
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess} 
          onScanError={(err) => console.log(err)} 
        />
        
        <div className="mt-8 text-center text-sm font-bold text-muted-foreground">
          <p>Or manually enter SKU</p>
          <form className="mt-2 flex max-w-sm mx-auto gap-2" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('sku') as HTMLInputElement).value; if(v) handleScanSuccess(v); }}>
            <Input name="sku" placeholder="Enter SKU..." className="h-12 font-mono font-bold uppercase text-center" />
            <Button type="submit" className="h-12 w-12 p-0"><ArrowRight className="h-5 w-5" /></Button>
          </form>
        </div>
      </div>
    );
  }

  if (!selectedProduct) {
    return (
      <div className="text-center py-20">
        <XCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Product Not Found</h2>
        <p className="text-muted-foreground mt-2">No product matches SKU: <span className="font-mono font-bold text-foreground">{scannedSku}</span></p>
        <Button size="lg" className="mt-8 font-black uppercase italic" onClick={handleReset}>Scan Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto pt-6">
      <Card className="border-2 border-primary shadow-xl overflow-hidden">
        <div className="bg-primary p-4 text-primary-foreground text-center">
          <PackagePlus className="h-10 w-10 mx-auto mb-2 opacity-80" />
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">{selectedProduct.name}</h2>
          <p className="font-mono text-sm opacity-90 mt-1">{selectedProduct.sku}</p>
        </div>
        <CardContent className="p-6 grid gap-6">
          <div className="space-y-3">
            <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Receipt Quantity ({selectedProduct.unit})</Label>
            <Input 
              type="number" 
              min={1}
              className="h-16 text-4xl text-center font-mono font-black"
              value={qty} 
              onChange={e => setQty(parseInt(e.target.value) || 0)} 
            />
          </div>

          <div className="space-y-3">
            <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Destination Location</Label>
            <Select value={locationId || "__none__"} onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-14 font-bold text-lg">
                <SelectValue placeholder="Select Bin/Zone..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Default (No Location)</SelectItem>
                {locations.map((loc: any) => (
                  <SelectItem key={loc._id} value={loc._id} className="font-bold">{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">PO Ref / Note</Label>
            <Input 
              className="h-12 font-medium"
              placeholder="e.g. PO-1024"
              value={note} 
              onChange={e => setNote(e.target.value)} 
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button variant="outline" className="h-14 flex-1 font-black uppercase italic" onClick={handleReset}>
              Cancel
            </Button>
            <Button 
              className="h-14 flex-1 font-black uppercase italic bg-blue-600 hover:bg-blue-700" 
              onClick={handleSubmit}
              disabled={receiptMutation.isPending}
            >
              Post Receipt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
