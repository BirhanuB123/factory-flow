import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Check, Banknote, AlertCircle, RefreshCw } from "lucide-react";
import { LoadingLogo } from "../ui/LoadingLogo";
import { hrPayrollApi, type HrPayrollRow, type PayrollMonthStatus } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function FinancePayrollTab() {
  const { formatAmount } = useCurrency();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [status, setStatus] = useState<PayrollMonthStatus | null>(null);
  const [payroll, setPayroll] = useState<HrPayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        hrPayrollApi.monthStatus(month),
        hrPayrollApi.list(month),
      ]);
      setStatus(s);
      
      // Filter payroll to only show records for the selected month accurately
      // and ensure we are seeing the real data returned by the API
      const filteredPayroll = p.filter(item => item.month === month);
      setPayroll(filteredPayroll);
      
      if (s.posted && filteredPayroll.length === 0) {
        setError("Monthly status is 'Posted', but no payroll records were found for this month.");
      }
    } catch (e: any) {
      console.error("Payroll fetch error:", e);
      setError(e.message || "Failed to fetch payroll data. Please ensure you have sufficient permissions.");
      toast({ title: "Fetch failed", description: "Could not retrieve payroll records.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  const handleMarkPaid = async (id: string) => {
    setActionLoading(id);
    try {
      await hrPayrollApi.updateRecord(id, {
        paymentStatus: "Paid",
        paymentDate: new Date().toISOString(),
      });
      toast({ title: "Success", description: "Salary marked as disbursed." });
      fetchData();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message || "Could not update payment status.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const totals = useMemo(() => {
    return payroll.reduce((acc, p) => ({
      net: acc.net + (p.netSalary || 0),
      tax: acc.tax + (p.incomeTax || 0),
      pension: acc.pension + (p.pensionEmployee || 0),
      count: acc.count + 1,
      paid: acc.paid + (p.paymentStatus === "Paid" ? 1 : 0)
    }), { net: 0, tax: 0, pension: 0, count: 0, paid: 0 });
  }, [payroll]);

  const isPosted = !!status?.posted;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-erp bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Payroll Disbursement
              </CardTitle>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                Process and monitor salary payouts for {month}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/5 border-white/10 text-xs font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 font-bold text-[10px] uppercase tracking-widest bg-background/50"
                onClick={fetchData} 
                disabled={loading}
              >
                {loading ? <LoadingLogo size={12} className="mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold uppercase tracking-wide text-xs">Data Sync Error</AlertTitle>
              <AlertDescription className="text-xs italic">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {!isPosted ? (
            <div className="py-16 text-center space-y-4">
              <div className="h-16 w-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <DollarSign className="h-8 w-8 text-amber-500" />
              </div>
              <div className="max-w-sm mx-auto">
                <h3 className="text-base font-black uppercase tracking-tight">Awaiting HR Posting</h3>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  HR must complete the payroll run and use the "Post to Finance" action before disbursement data appears here.
                </p>
                <div className="mt-6 p-3 rounded-lg bg-muted/30 border border-border/50 text-[10px] font-mono text-left">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="opacity-50 uppercase">Month Status:</span>
                    <span className="font-bold text-amber-600 uppercase">{status?.payrollRecordCount ? "Run Complete" : "Not Started"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="opacity-50 uppercase">Posting Status:</span>
                    <span className="font-bold text-destructive uppercase">NOT POSTED</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20 shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Total Net Payable</p>
                    <div className="mt-2 text-xl font-black tracking-tighter text-primary">
                      {formatAmount(totals.net)}
                    </div>
                    <p className="text-[9px] opacity-60 mt-1 font-bold uppercase italic">Actual cash outflow</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20 shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest">Pending Disbursement</p>
                    <div className="mt-2 text-xl font-black tracking-tighter text-amber-600">
                      {totals.count - totals.paid} <span className="text-xs opacity-60 font-medium">/ {totals.count}</span>
                    </div>
                    <p className="text-[9px] opacity-60 mt-1 font-bold uppercase italic">Employees to pay</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <p className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest">Disbursed Total</p>
                    <div className="mt-2 text-xl font-black tracking-tighter text-emerald-600">
                      {totals.paid} <span className="text-xs opacity-60 font-medium">Records</span>
                    </div>
                    <div className="w-full bg-emerald-500/10 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-1000" 
                        style={{ width: `${(totals.paid / (totals.count || 1)) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/5 border-border shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Withholdings</p>
                    <div className="space-y-1 mt-2">
                       <div className="flex justify-between items-center text-[11px]">
                          <span className="opacity-70 font-medium">Income Tax:</span>
                          <span className="font-bold">{formatAmount(totals.tax)}</span>
                       </div>
                       <div className="flex justify-between items-center text-[11px]">
                          <span className="opacity-70 font-medium">Pension (7%):</span>
                          <span className="font-bold">{formatAmount(totals.pension)}</span>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border border-border/40 overflow-hidden bg-background/30 backdrop-blur-md shadow-inner">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6">Employee Records</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6">Department</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6 text-right">Net Salary</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                           <div className="flex flex-col items-center justify-center opacity-40 grayscale">
                              <AlertCircle className="h-8 w-8 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest">No matching records</p>
                              <p className="text-[10px] mt-1 italic">Verify month and HR posting status</p>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      payroll.map((p) => (
                        <TableRow key={p._id} className="border-border/40 hover:bg-muted/20 transition-colors group">
                          <TableCell className="py-4 px-6">
                            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{p.employee?.name}</div>
                            <div className="text-[10px] font-mono font-black text-muted-foreground mt-0.5 opacity-70 tracking-tighter">
                               EMP: {p.employee?.employeeId}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-xs font-bold text-muted-foreground uppercase tracking-tight">
                            {p.employee?.department || "General"}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right font-mono font-black text-emerald-600 tabular-nums">
                            {formatAmount(p.netSalary || 0)}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            {p.paymentStatus === "Paid" ? (
                              <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/20 text-[9px] font-black uppercase px-2 shadow-none">
                                <Check className="h-2.5 w-2.5 mr-1" strokeWidth={3} />
                                Disbursed
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[9px] font-black uppercase bg-primary/5 border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                                onClick={() => handleMarkPaid(p._id)}
                                disabled={!!actionLoading}
                              >
                                {actionLoading === p._id ? (
                                  <LoadingLogo size={12} className="mr-1" />
                                ) : (
                                  <DollarSign className="h-3 w-3 mr-1" strokeWidth={3} />
                                )}
                                Pay Now
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
