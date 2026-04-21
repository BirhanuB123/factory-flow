import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Check, Banknote } from "lucide-react";
import { hrPayrollApi, type HrPayrollRow, type PayrollMonthStatus } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        hrPayrollApi.monthStatus(month),
        hrPayrollApi.list(month),
      ]);
      setStatus(s);
      setPayroll(p);
    } catch (e) {
      toast({ title: "Fetch failed", variant: "destructive" });
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
      toast({ title: "Marked as paid" });
      fetchData();
    } catch (e) {
      toast({ title: "Payment failed", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = payroll.filter(p => p.paymentStatus !== "Paid").length;
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
                Disburse salaries for {month}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/5 border-white/10 text-xs font-bold"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 font-bold text-[10px] uppercase tracking-widest"
                onClick={fetchData} 
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isPosted ? (
            <div className="py-12 text-center space-y-3">
              <div className="h-12 w-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <DollarSign className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Payroll not yet posted</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  HR must run payroll for this month and click "Post to Finance" before disbursement can begin.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Post Status</p>
                    <p className="text-lg font-black mt-1">POSTED</p>
                    <p className="text-[9px] opacity-50 mt-1">Handed over by HR</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest">Pending Payouts</p>
                    <p className="text-lg font-black mt-1 text-amber-600">{pendingCount} Staff</p>
                    <p className="text-[9px] opacity-50 mt-1">Awaiting disbursement</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest">Total Net Salary</p>
                    <p className="text-lg font-black mt-1 text-emerald-600">
                      {formatAmount(payroll.reduce((acc, p) => acc + (p.netSalary || 0), 0))}
                    </p>
                    <p className="text-[9px] opacity-50 mt-1">Full month obligation</p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border/40">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Employee</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Department</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 text-right">Net Salary</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">
                          No payroll records found for this month.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payroll.map((p) => (
                        <TableRow key={p._id} className="border-border/40 hover:bg-muted/30 transition-colors">
                          <TableCell className="py-3">
                            <div className="font-bold text-sm">{p.employee?.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{p.employee?.employeeId}</div>
                          </TableCell>
                          <TableCell className="py-3 text-xs opacity-80">{p.employee?.department || "—"}</TableCell>
                          <TableCell className="py-3 text-right">
                            <span className="font-mono text-sm font-black text-emerald-600">
                              {formatAmount(p.netSalary || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            {p.paymentStatus === "Paid" ? (
                              <Badge variant="success" className="text-[9px] font-black uppercase italic bg-emerald-500/15 text-emerald-600 border-0">
                                <Check className="h-2.5 w-2.5 mr-1" />
                                Disbursed
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[9px] font-black uppercase border-primary/30 hover:bg-primary/10"
                                onClick={() => handleMarkPaid(p._id)}
                                disabled={!!actionLoading}
                              >
                                {actionLoading === p._id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <DollarSign className="h-3 w-3 mr-1" />
                                )}
                                Mark Paid
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
