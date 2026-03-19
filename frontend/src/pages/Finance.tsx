import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowRightLeft,
  Clock,
  FileInput,
  Download,
  Building2,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financeExtendedApi, ordersApi } from "@/lib/api";
import { toast as sonnerToast } from "sonner";
import {
  ModuleDashboardLayout,
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import { useMemo, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceMetrics } from "@/components/FinanceMetrics";
import { FinanceApTab } from "@/components/finance/FinanceApTab";
import { useAuth } from "@/contexts/AuthContext";
import { downloadReportCsv, ethiopiaTaxApi, shipmentsApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
type FinanceStatus = "Paid" | "Pending" | "Overdue";
type TransactionType = "Income" | "Expense";

type Transaction = {
  id: string;
  category: string;
  amount: number;
  date: string;
  status: FinanceStatus;
  type: TransactionType;
  description: string;
  sourceId?: string;
  grossBeforeWht?: number;
  vatAmount?: number;
  salesWhtAmount?: number;
};

const statusVariant: Record<FinanceStatus, "success" | "warning" | "destructive"> = {
  Paid: "success",
  Pending: "warning",
  Overdue: "destructive",
};

const API_BASE_URL = "http://localhost:5000/api/finance";

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("erp_token") || ""}`,
  };
}

function FinanceLedgerTable({
  rows,
  loading,
  onOpenTaxInvoice,
}: {
  rows: Transaction[];
  loading: boolean;
  onOpenTaxInvoice?: (invoiceMongoId: string) => void;
}) {
  const { formatAmount, symbol } = useCurrency();
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 w-32">
                Journal ID
              </TableHead>
              <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Type
              </TableHead>
              <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Category
              </TableHead>
              <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Description
              </TableHead>
              <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Value
              </TableHead>
              <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Date
              </TableHead>
              <TableHead className="py-4 pr-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 text-right">
                Status
              </TableHead>
              {onOpenTaxInvoice && (
                <TableHead className="py-4 pr-6 w-[52px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 text-center">
                  Tax
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={onOpenTaxInvoice ? 8 : 7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Syncing ledger…
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onOpenTaxInvoice ? 8 : 7} className="h-48 text-center text-sm text-muted-foreground">
                  No entries in this view.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow
                  key={t.id + t.date + t.type}
                  className="group/row border-border/30 hover:bg-secondary/20 transition-colors"
                >
                  <TableCell className="py-3 pl-6">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground group-hover/row:text-primary transition-colors">
                      FIN-{t.id.substring(Math.max(0, t.id.length - 6)).toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                        t.type === "Income"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {t.type === "Income" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {t.type}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase tracking-tight">{t.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{t.description}</TableCell>
                  <TableCell>
                    <span
                      className={`text-sm font-black ${
                        t.type === "Income" ? "text-emerald-500" : "text-rose-500"
                      }`}
                      title={
                        t.type === "Income" && t.grossBeforeWht != null
                          ? `Net receivable. Gross before WHT: ${symbol}${formatAmount(t.grossBeforeWht)}`
                          : undefined
                      }
                    >
                      {t.type === "Income" ? "+" : "-"}
                      {symbol}
                      {formatAmount(t.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">
                    {new Date(t.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Badge
                      variant={statusVariant[t.status]}
                      className="text-[9px] font-black uppercase tracking-wide"
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                  {onOpenTaxInvoice && (
                    <TableCell className="pr-6 text-center">
                      {t.type === "Income" && t.sourceId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"
                          title="Printable tax invoice"
                          onClick={() => onOpenTaxInvoice(t.sourceId!)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Finance() {
  const { user } = useAuth();
  const canWriteFinance = user?.role === "Admin" || user?.role === "finance_head";
  const canFinance = ["Admin", "finance_head", "finance_viewer"].includes(user?.role ?? "");
  const { format, formatAmount, symbol } = useCurrency();
  const [q, setQ] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    category: "",
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: "Pending" as FinanceStatus,
    type: "Income" as TransactionType,
    description: "",
  });
  
  const [financeStats, setFinanceStats] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    pending: 0
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invFromOrderOpen, setInvFromOrderOpen] = useState(false);
  const [invOrderId, setInvOrderId] = useState("");
  const [invShipmentId, setInvShipmentId] = useState("");
  const [invDue, setInvDue] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [ethCsvOpen, setEthCsvOpen] = useState(false);
  const [ethFrom, setEthFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [ethTo, setEthTo] = useState(() => new Date().toISOString().slice(0, 10));

  const openTaxInvoice = async (invoiceMongoId: string) => {
    try {
      await ethiopiaTaxApi.openTaxInvoiceHtml(invoiceMongoId);
    } catch {
      sonnerToast.error("Could not open tax invoice (popup blocked or network error)");
    }
  };

  const { data: arPayload } = useQuery({
    queryKey: ["ar-aging"],
    queryFn: financeExtendedApi.getARAging,
  });

  const { data: ordersForInv = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
    enabled: invFromOrderOpen,
  });

  const { data: shipForInv = [] } = useQuery({
    queryKey: ["shipments-order", invOrderId],
    queryFn: () => shipmentsApi.listForOrder(invOrderId),
    enabled: invFromOrderOpen && !!invOrderId,
  });

  const shippedOnOrder = (shipForInv as { _id: string; status: string; shipmentNumber: string }[]).filter(
    (s) => s.status === "shipped"
  );
  const needShipmentInvoice = shippedOnOrder.length > 0;

  const invFromOrderMut = useMutation({
    mutationFn: () =>
      financeExtendedApi.createInvoiceFromOrder({
        orderId: invOrderId,
        dueDate: new Date(invDue).toISOString(),
        ...(needShipmentInvoice && invShipmentId ? { shipmentId: invShipmentId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ar-aging"] });
      sonnerToast.success("Invoice created from order");
      setInvFromOrderOpen(false);
      fetchTransactions();
      fetchStats();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      sonnerToast.error(e?.response?.data?.message || "Failed");
    },
  });

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFinanceStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.category || newTransaction.amount <= 0 || !newTransaction.description) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const endpoint = newTransaction.type === "Income" ? "invoices" : "expenses";
      const payload = newTransaction.type === "Income" ? {
        invoiceId: `INV-${Math.floor(Math.random() * 10000)}`,
        amount: newTransaction.amount,
        status: newTransaction.status,
        dueDate: newTransaction.date,
        description: newTransaction.description,
        client: "65f1a2b3c4d5e6f7a8b9c0d1" // Placeholder client ID
      } : {
        category: newTransaction.category,
        amount: newTransaction.amount,
        description: newTransaction.description,
        date: newTransaction.date,
        status: newTransaction.status === "Paid" ? "Paid" : "Pending"
      };

      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `${newTransaction.type} added successfully.`,
        });
        setIsDialogOpen(false);
        fetchTransactions();
        fetchStats();
        setNewTransaction({
          category: "",
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          status: "Pending",
          type: "Income",
          description: "",
        });
      } else {
        throw new Error("Failed to add transaction");
      }
    } catch (error) {
       // Demo mode fallback
       setTransactions([{ ...newTransaction, id: `DEMO-${Math.floor(Math.random() * 1000)}` } as Transaction, ...transactions]);
       toast({
         title: "Demo Mode",
         description: "Item added to local state for visualization.",
       });
       setIsDialogOpen(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return transactions;
    return transactions.filter((t) => {
      return (
        t.category.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        t.status.toLowerCase().includes(query)
      );
    });
  }, [q, transactions]);

  return (
    <ModuleDashboardLayout
      title="Finance Operations"
      description="Fiscal intelligence, liquidity, and journal activity—aligned with Production command style."
      icon={CircleDollarSign}
      healthStats={[
        {
          label: "Revenue",
          value: format(financeStats.revenue ?? 0),
          accent: "text-emerald-500",
        },
        {
          label: "Net position",
          value: format(financeStats.profit ?? 0),
          accent: (financeStats.profit ?? 0) >= 0 ? "text-primary" : "text-destructive",
        },
        {
          label: "Pending",
          value: format(financeStats.pending ?? 0),
          accent: "text-amber-500",
        },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 rounded-xl font-black uppercase text-xs gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="text-xs font-bold"
                onClick={() => downloadReportCsv("/reports/export/ar", `ar-${Date.now()}.csv`)}
              >
                Open AR
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs font-bold"
                onClick={() => downloadReportCsv("/reports/export/ap", `ap-${Date.now()}.csv`)}
              >
                Open AP
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs font-bold"
                onClick={() => downloadReportCsv("/reports/export/orders", `orders-${Date.now()}.csv`)}
              >
                Orders
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs font-bold"
                onClick={() => downloadReportCsv("/reports/export/inventory", `inventory-${Date.now()}.csv`)}
              >
                Inventory
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs font-bold"
                onClick={() => downloadReportCsv("/reports/export/production", `production-${Date.now()}.csv`)}
              >
                Production
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canFinance && (
            <>
              <Button
                variant="outline"
                className="h-11 rounded-xl font-black uppercase text-xs gap-2 border-amber-500/40 text-amber-700 dark:text-amber-400"
                onClick={() => setEthCsvOpen(true)}
              >
                <FileText className="h-4 w-4" />
                Ethiopia tax CSV
              </Button>
              <Dialog open={ethCsvOpen} onOpenChange={setEthCsvOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-black uppercase">Statutory CSV exports</DialogTitle>
                    <DialogDescription className="text-xs">
                      Date range filters invoice/bill dates. See docs for accountant column mapping.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3 py-2">
                    <div>
                      <Label className="text-[10px] uppercase">From</Label>
                      <Input type="date" value={ethFrom} onChange={(e) => setEthFrom(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">To</Label>
                      <Input type="date" value={ethTo} onChange={(e) => setEthTo(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {[
                      { path: "/finance/reports/ethiopia/vat-sales.csv", file: "vat-sales" },
                      { path: "/finance/reports/ethiopia/vat-purchases.csv", file: "vat-purchases" },
                      { path: "/finance/reports/ethiopia/withholding-sales.csv", file: "wht-sales" },
                      { path: "/finance/reports/ethiopia/withholding-purchases.csv", file: "wht-purchases" },
                    ].map(({ path, file }) => (
                      <Button
                        key={path}
                        variant="secondary"
                        className="justify-start font-mono text-xs"
                        onClick={() =>
                          downloadReportCsv(path, `${file}-${ethFrom}-${ethTo}.csv`, { from: ethFrom, to: ethTo })
                        }
                      >
                        Download {file}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {canWriteFinance && (
          <Dialog open={invFromOrderOpen} onOpenChange={(o) => { setInvFromOrderOpen(o); if (!o) setInvShipmentId(""); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11 rounded-xl font-black uppercase text-xs gap-2">
                <FileInput className="h-4 w-4" />
                Invoice from order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invoice from sales order</DialogTitle>
                <DialogDescription>
                  If the order has shipped packages, pick a shipment to invoice. Otherwise one full-order invoice.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select
                    value={invOrderId}
                    onValueChange={(v) => {
                      setInvOrderId(v);
                      setInvShipmentId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {(ordersForInv as { _id: string; client?: { name: string }; totalAmount: number }[]).map((o) => (
                        <SelectItem key={o._id} value={o._id}>
                          {o.client?.name ?? "—"} · ${o.totalAmount} · …{o._id.slice(-6)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {needShipmentInvoice && (
                  <div className="space-y-2">
                    <Label>Shipment (shipped)</Label>
                    <Select value={invShipmentId} onValueChange={setInvShipmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {shippedOnOrder.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.shipmentNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInvFromOrderOpen(false)}>Cancel</Button>
                <Button
                  disabled={
                    !invOrderId ||
                    invFromOrderMut.isPending ||
                    (needShipmentInvoice && !invShipmentId)
                  }
                  onClick={() => invFromOrderMut.mutate()}
                >
                  Create invoice
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        {canWriteFinance && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-xl px-6 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2 bg-primary">
              <Plus className="h-4 w-4" />
              New entry
            </Button>
          </DialogTrigger>
              <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-3xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-purple-500" />
                <DialogHeader className="space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                    <ArrowRightLeft className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">New Ledger Entry</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Record fiscal movement authorization</DialogDescription>
                  </div>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Traffic Type</Label>
                      <Select
                        value={newTransaction.type}
                        onValueChange={(value: TransactionType) => setNewTransaction({ ...newTransaction, type: value })}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                          <SelectItem value="Income" className="text-xs font-black uppercase italic tracking-wider text-emerald-500">Income (Inflow)</SelectItem>
                          <SelectItem value="Expense" className="text-xs font-black uppercase italic tracking-wider text-rose-500">Expense (Outflow)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Status</Label>
                      <Select
                        value={newTransaction.status}
                        onValueChange={(value: FinanceStatus) => setNewTransaction({ ...newTransaction, status: value })}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                          <SelectItem value="Paid" className="text-xs font-black uppercase italic tracking-wider text-emerald-500">Paid/Settled</SelectItem>
                          <SelectItem value="Pending" className="text-xs font-black uppercase italic tracking-wider text-amber-500">Pending</SelectItem>
                          <SelectItem value="Overdue" className="text-xs font-black uppercase italic tracking-wider text-rose-500">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Classification</Label>
                      <Input
                        value={newTransaction.category}
                        onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                        placeholder="e.g. R&D, Logistics"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Fiscal Value ({symbol})</Label>
                      <Input
                        type="number"
                        value={newTransaction.amount}
                        onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-mono font-bold text-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Full Transaction Particulars</Label>
                    <Input
                      value={newTransaction.description}
                      onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic text-sm"
                      placeholder="Transaction details..."
                    />
                  </div>
                </div>
                <DialogFooter className="mt-4 gap-3">
                  <Button variant="ghost" className="h-12 rounded-xl px-8 font-black uppercase italic text-xs tracking-widest" onClick={() => setIsDialogOpen(false)}>Abort</Button>
                  <Button 
                    className="h-12 rounded-xl px-12 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 animate-pulse-slow active:scale-95 transition-all bg-primary"
                    onClick={handleAddTransaction}
                  >
                    Authorize Entry
                  </Button>
                </DialogFooter>
              </DialogContent>
        </Dialog>
        )}
        </div>
      }
    >
      <FinanceMetrics stats={financeStats} />

      <Tabs defaultValue="all" className="space-y-6">
        <StickyModuleTabs>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList className={moduleTabsListClassName()}>
              <TabsTrigger value="all" className={moduleTabsTriggerClassName()}>
                All journals
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className={`${moduleTabsTriggerClassName()} data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-emerald-500/25`}
              >
                <TrendingUp className="h-4 w-4 shrink-0" />
                Invoices
              </TabsTrigger>
              <TabsTrigger
                value="expense"
                className={`${moduleTabsTriggerClassName()} data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-rose-500/25`}
              >
                <TrendingDown className="h-4 w-4 shrink-0" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="ar-aging" className={moduleTabsTriggerClassName()}>
                <Clock className="h-4 w-4 shrink-0" />
                AR aging
              </TabsTrigger>
              <TabsTrigger value="ap" className={moduleTabsTriggerClassName()}>
                <Building2 className="h-4 w-4 shrink-0" />
                AP & vendors
              </TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:max-w-xs group shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ledger…"
                className="h-10 pl-10 bg-secondary/50 border rounded-xl text-sm"
              />
            </div>
          </div>
        </StickyModuleTabs>

        <TabsContent value="all" className="mt-0 focus-visible:outline-none">
          <FinanceLedgerTable
            rows={filteredTransactions}
            loading={loading}
            onOpenTaxInvoice={canFinance ? openTaxInvoice : undefined}
          />
        </TabsContent>
        <TabsContent value="income" className="mt-0 focus-visible:outline-none">
          <FinanceLedgerTable
            rows={filteredTransactions.filter((t) => t.type === "Income")}
            loading={loading}
            onOpenTaxInvoice={canFinance ? openTaxInvoice : undefined}
          />
        </TabsContent>
        <TabsContent value="expense" className="mt-0 focus-visible:outline-none">
          <FinanceLedgerTable
            rows={filteredTransactions.filter((t) => t.type === "Expense")}
            loading={loading}
          />
        </TabsContent>
        <TabsContent value="ar-aging" className="mt-0 space-y-6 focus-visible:outline-none">
          {arPayload && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Not due", k: "notDue" as const, t: arPayload.totals.notDue },
                  { label: "1–30 d", k: "days1_30" as const, t: arPayload.totals.days1_30 },
                  { label: "31–60 d", k: "days31_60" as const, t: arPayload.totals.days31_60 },
                  { label: "61–90 d", k: "days61_90" as const, t: arPayload.totals.days61_90 },
                  { label: "90+ d", k: "days90plus" as const, t: arPayload.totals.days90plus },
                ].map((b) => (
                  <div key={b.k} className="rounded-xl border bg-card/60 p-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{b.label}</p>
                    <p className="text-xl font-black">{format(b.t)}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold">
                Open AR: {format(arPayload.totals.openAR)}
              </p>
              {(
                [
                  ["days90plus", "90+ days past due"],
                  ["days61_90", "61–90 days past due"],
                  ["days31_60", "31–60 days past due"],
                  ["days1_30", "1–30 days past due"],
                  ["notDue", "Not yet due"],
                ] as const
              ).map(([bucket, title]) => (
                <div key={bucket} className="rounded-xl border overflow-hidden">
                  <p className="text-xs font-black uppercase px-4 py-2 bg-muted/50">{title}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Days late</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(arPayload.buckets[bucket] as { invoiceId: string; clientName: string; amount: number; dueDate: string; daysPastDue: number }[]).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">—</TableCell>
                        </TableRow>
                      ) : (
                        (arPayload.buckets[bucket] as { invoiceId: string; clientName: string; amount: number; dueDate: string; daysPastDue: number }[]).map((row) => (
                          <TableRow key={row.invoiceId + bucket}>
                            <TableCell className="font-mono text-xs">{row.invoiceId}</TableCell>
                            <TableCell>{row.clientName}</TableCell>
                            <TableCell className="text-right font-bold">{format(row.amount)}</TableCell>
                            <TableCell className="text-xs">{new Date(row.dueDate).toLocaleDateString()}</TableCell>
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
        <TabsContent value="ap" className="mt-0 focus-visible:outline-none">
          <FinanceApTab symbol={symbol} canWrite={canWriteFinance} />
        </TabsContent>
      </Tabs>
    </ModuleDashboardLayout>
  );
}
