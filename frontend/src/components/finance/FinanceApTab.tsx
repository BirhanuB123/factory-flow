import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apApi, purchaseOrdersApi, type APAgingPayload } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Building2, FileText, Clock, CreditCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

const bucketKeys = [
  ["days90plus", "90+ days past due"],
  ["days61_90", "61–90 days"],
  ["days31_60", "31–60 days"],
  ["days1_30", "1–30 days"],
  ["notDue", "Not yet due"],
] as const;

export function FinanceApTab({
  symbol,
  canWrite,
}: {
  symbol: string;
  canWrite: boolean;
}) {
  const { format, formatAmount } = useCurrency();
  const qc = useQueryClient();
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vCode, setVCode] = useState("");
  const [vName, setVName] = useState("");
  const [vTin, setVTin] = useState("");
  const [vVatReg, setVVatReg] = useState(true);
  const [billOpen, setBillOpen] = useState(false);
  const [billVendor, setBillVendor] = useState("");
  const [billDesc, setBillDesc] = useState("");
  const [billAmt, setBillAmt] = useState("");
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [poForBill, setPoForBill] = useState("");

  const { data: apAging, isLoading: apLoading } = useQuery({
    queryKey: ["ap-aging"],
    queryFn: apApi.getAPAging,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["ap-vendors"],
    queryFn: apApi.listVendorsAll,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["vendor-bills"],
    queryFn: apApi.listBills,
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersApi.getAll,
    enabled: canWrite,
  });

  const createVendorMut = useMutation({
    mutationFn: () =>
      apApi.createVendor({
        code: vCode.trim().toUpperCase(),
        name: vName.trim(),
        tin: vTin.trim() || undefined,
        vatRegistered: vVatReg,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ap-vendors"] });
      toast.success("Vendor created");
      setVendorOpen(false);
      setVCode("");
      setVName("");
      setVTin("");
      setVVatReg(true);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const createBillMut = useMutation({
    mutationFn: () =>
      apApi.createBill({
        vendor: billVendor,
        lines: [{ description: billDesc || "Line", quantity: 1, amount: parseFloat(billAmt) || 0 }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bills"] });
      qc.invalidateQueries({ queryKey: ["ap-aging"] });
      toast.success("Bill created");
      setBillOpen(false);
      setBillDesc("");
      setBillAmt("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const fromPoMut = useMutation({
    mutationFn: () => apApi.billFromPo(poForBill),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bills"] });
      qc.invalidateQueries({ queryKey: ["ap-aging"] });
      toast.success("Bill created from PO");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const payMut = useMutation({
    mutationFn: () =>
      apApi.recordPayment(payBillId!, { amount: parseFloat(payAmt), method: "ach" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bills"] });
      qc.invalidateQueries({ queryKey: ["ap-aging"] });
      toast.success("Payment recorded");
      setPayBillId(null);
      setPayAmt("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Failed"),
  });

  const payload = apAging as APAgingPayload | undefined;

  return (
    <Tabs defaultValue="bills" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="rounded-xl bg-secondary/50 p-1">
          <TabsTrigger value="bills" className="rounded-lg gap-2 text-xs font-black uppercase">
            <FileText className="h-3.5 w-3.5" />
            Bills
          </TabsTrigger>
          <TabsTrigger value="aging" className="rounded-lg gap-2 text-xs font-black uppercase">
            <Clock className="h-3.5 w-3.5" />
            AP aging
          </TabsTrigger>
          <TabsTrigger value="vendors" className="rounded-lg gap-2 text-xs font-black uppercase">
            <Building2 className="h-3.5 w-3.5" />
            Vendors
          </TabsTrigger>
        </TabsList>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Vendor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New vendor</DialogTitle>
                  <DialogDescription>Vendor master for AP and PO linking.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Code</Label>
                    <Input value={vCode} onChange={(e) => setVCode(e.target.value)} placeholder="VEND-001" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={vName} onChange={(e) => setVName(e.target.value)} />
                  </div>
                  <div>
                    <Label>TIN</Label>
                    <Input
                      value={vTin}
                      onChange={(e) => setVTin(e.target.value)}
                      placeholder="Vendor tax ID"
                      className="font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="vvat" checked={vVatReg} onCheckedChange={(c) => setVVatReg(c === true)} />
                    <Label htmlFor="vvat" className="text-sm font-normal cursor-pointer">
                      VAT-registered supplier
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVendorOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!vCode || !vName || createVendorMut.isPending}
                    onClick={() => createVendorMut.mutate()}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={billOpen} onOpenChange={setBillOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="font-black uppercase text-[10px] gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Manual bill
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vendor bill</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Vendor</Label>
                    <Select value={billVendor} onValueChange={setBillVendor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {(vendors as { _id: string; name: string; code: string }[]).map((v) => (
                          <SelectItem key={v._id} value={v._id}>
                            {v.code} — {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={billDesc} onChange={(e) => setBillDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={billAmt}
                      onChange={(e) => setBillAmt(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!billVendor || !billAmt || createBillMut.isPending}
                    onClick={() => createBillMut.mutate()}
                  >
                    Create bill
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Bill from PO</Label>
                <Select value={poForBill} onValueChange={setPoForBill}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="PO" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pos as { _id: string; poNumber: string }[]).map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.poNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!poForBill || fromPoMut.isPending}
                onClick={() => fromPoMut.mutate()}
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </div>

      <TabsContent value="bills" className="mt-0">
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 7 : 6} className="text-center text-muted-foreground py-8">
                    No vendor bills
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                    <TableCell>{b.vendor?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-bold">
                      {format(b.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {symbol}
                      {formatAmount(b.amountPaid ?? 0)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(b.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {b.status}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        {b.status !== "Paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px]"
                            onClick={() => {
                              setPayBillId(b._id);
                              setPayAmt(String(Math.max(0, b.amount - (b.amountPaid ?? 0))));
                            }}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="aging" className="mt-0 space-y-4">
        {apLoading || !payload ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Not due", t: payload.totals.notDue },
                { label: "1–30 d", t: payload.totals.days1_30 },
                { label: "31–60 d", t: payload.totals.days31_60 },
                { label: "61–90 d", t: payload.totals.days61_90 },
                { label: "90+ d", t: payload.totals.days90plus },
              ].map((b) => (
                <div key={b.label} className="rounded-xl border bg-card/60 p-4">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">{b.label}</p>
                  <p className="text-xl font-black">
                    {format(b.t)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm font-bold">
              Open AP:               {format(payload.totals.openAP)}
            </p>
            {bucketKeys.map(([bucket, title]) => (
              <div key={bucket} className="rounded-xl border overflow-hidden">
                <p className="text-xs font-black uppercase px-4 py-2 bg-muted/50">{title}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Days late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payload.buckets[bucket].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          —
                        </TableCell>
                      </TableRow>
                    ) : (
                      payload.buckets[bucket].map((row, i) => (
                        <TableRow key={`${row.billNumber}-${i}`}>
                          <TableCell className="font-mono text-xs">{row.billNumber}</TableCell>
                          <TableCell>{row.vendorName}</TableCell>
                          <TableCell className="text-right font-bold">
                            {format(row.balance)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(row.dueDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">{row.daysPastDue}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ))}
          </>
        )}
      </TabsContent>

      <TabsContent value="vendors" className="mt-0">
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Terms (days)</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendors as { _id: string; code: string; name: string; email?: string; paymentTermsDays?: number; active?: boolean }[]).map(
                (v) => (
                  <TableRow key={v._id}>
                    <TableCell className="font-mono text-xs">{v.code}</TableCell>
                    <TableCell className="font-bold">{v.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.email || "—"}</TableCell>
                    <TableCell>{v.paymentTermsDays ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.active === false ? "destructive" : "success"} className="text-[10px]">
                        {v.active === false ? "No" : "Yes"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <Dialog open={!!payBillId} onOpenChange={(o) => !o && setPayBillId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label>Amount</Label>
            <Input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayBillId(null)}>
              Cancel
            </Button>
            <Button disabled={!payAmt || payMut.isPending} onClick={() => payMut.mutate()}>
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
