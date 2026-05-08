import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Clock,
  FileInput,
  Download,
  Building2,
  FileText,
  BookMarked,
  Banknote,
  Activity,
  AlertCircle,
  CheckCircle2,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { LoadingLogo } from "@/components/ui/LoadingLogo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { financeExtendedApi, ordersApi } from "@/lib/api";
import { toast as sonnerToast } from "sonner";
import {
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
import { FinancePayrollTab } from "@/components/finance/FinancePayrollTab";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { downloadReportCsv, ethiopiaTaxApi, shipmentsApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
type FinanceStatus = "Paid" | "Pending" | "Overdue" | "Posted";
type TransactionType = "Income" | "Expense" | "Journal";

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
  Posted: "success",
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
    <div className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/25">
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="w-32 py-4 pl-6 text-xs font-bold text-foreground">Journal ID</TableHead>
              <TableHead className="py-4 text-xs font-bold text-foreground">Type</TableHead>
              <TableHead className="py-4 text-xs font-bold text-foreground">Category</TableHead>
              <TableHead className="py-4 text-xs font-bold text-foreground">Description</TableHead>
              <TableHead className="py-4 text-xs font-bold text-foreground">Value</TableHead>
              <TableHead className="py-4 text-xs font-bold text-foreground">Date</TableHead>
              <TableHead className="py-4 pr-6 text-right text-xs font-bold text-foreground">Status</TableHead>
              {onOpenTaxInvoice && (
                <TableHead className="w-[52px] py-4 pr-6 text-center text-xs font-bold text-foreground">Tax</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={onOpenTaxInvoice ? 8 : 7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <LoadingLogo size={32} className="text-primary opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Syncing ledger…
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onOpenTaxInvoice ? 8 : 7} className="h-52 text-center align-middle">
                  <div className="max-w-lg mx-auto space-y-3 text-muted-foreground px-4">
                    <p className="text-sm font-medium">No ledger rows in this tab yet.</p>
                    <p className="text-xs">
                      Invoices often start from sales: ship an order (if your role allows), then use{" "}
                      <strong>Invoice from order</strong> above. Expenses and manual entries use{" "}
                      <strong>New entry</strong>.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button asChild variant="outline" size="sm" className="h-8">
                        <Link to="/orders">Orders</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8">
                        <Link to="/shipments">Shipments</Link>
                      </Button>
                      <Button asChild variant="secondary" size="sm" className="h-8">
                        <Link to="/sme-bundle">SME workflow</Link>
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow
                  key={t.id + t.date + t.type}
                  className="group/row border-border/40 transition-colors hover:bg-muted/35"
                >
                  <TableCell className="py-3 pl-6">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground group-hover/row:text-primary transition-colors">
                      FIN-{t.id.substring(Math.max(0, t.id.length - 6)).toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${t.type === "Income"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : t.type === "Journal"
                            ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}
                    >
                      {t.type === "Income" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : t.type === "Journal" ? (
                        <BookMarked className="h-3 w-3" />
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
                      className={`text-sm font-black ${t.type === "Income"
                          ? "text-emerald-500"
                          : t.type === "Journal"
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-rose-500"
                        }`}
                      title={
                        t.type === "Income" && t.grossBeforeWht != null
                          ? `Net receivable. Gross before WHT: ${symbol}${formatAmount(t.grossBeforeWht)}`
                          : t.type === "Journal"
                            ? "Payroll accrual (total debit)"
                            : undefined
                      }
                    >
                      {t.type === "Income" ? (
                        <>
                          +{symbol}
                          {formatAmount(t.amount)}
                        </>
                      ) : t.type === "Journal" ? (
                        <>
                          {symbol}
                          {formatAmount(t.amount)}
                          <span className="text-[10px] font-mono font-bold opacity-50 ml-1">dr</span>
                        </>
                      ) : (
                        <>
                          -{symbol}
                          {formatAmount(t.amount)}
                        </>
                      )}
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
                          className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
  const { t } = useLocale();
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
  const [invTaxCategory, setInvTaxCategory] = useState("");
  const [invForceVatRate, setInvForceVatRate] = useState("");
  const [invForceWhtRate, setInvForceWhtRate] = useState("");
  const [invVatExempt, setInvVatExempt] = useState(false);
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
        taxOptions: {
          taxCategory: invTaxCategory.trim() || undefined,
          forceVatRate:
            invForceVatRate.trim() === "" ? undefined : Math.max(0, parseFloat(invForceVatRate) || 0),
          forceWhtRate:
            invForceWhtRate.trim() === "" ? undefined : Math.max(0, parseFloat(invForceWhtRate) || 0),
          isVatExempt: invVatExempt,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ar-aging"] });
      sonnerToast.success("Invoice created from order");
      setInvFromOrderOpen(false);
      setInvTaxCategory("");
      setInvForceVatRate("");
      setInvForceWhtRate("");
      setInvVatExempt(false);
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

  const dashboardSummary = useMemo(() => {
    const incomeCount = transactions.filter((t) => t.type === "Income").length;
    const expenseCount = transactions.filter((t) => t.type === "Expense").length;
    const overdueCount = transactions.filter((t) => t.status === "Overdue").length;
    const settledCount = transactions.filter((t) => t.status === "Paid" || t.status === "Posted").length;
    const totalCount = transactions.length || 1;
    const collectionRate = Math.round((settledCount / totalCount) * 100);
    const expenseRatio =
      (financeStats.revenue ?? 0) > 0 ? Math.round(((financeStats.expenses ?? 0) / financeStats.revenue) * 100) : 0;
    const openAr = arPayload?.totals?.openAR ?? financeStats.pending ?? 0;

    return {
      incomeCount,
      expenseCount,
      overdueCount,
      settledCount,
      collectionRate,
      expenseRatio,
      openAr,
    };
  }, [arPayload?.totals?.openAR, financeStats.expenses, financeStats.pending, financeStats.revenue, transactions]);

  return (
    <div>
      <div className="space-y-8 pb-8 animate-in fade-in duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-erp">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)/0.55))]" />
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent" />
          <div className="relative flex flex-col justify-between gap-6 p-6 lg:flex-row lg:items-end lg:p-7">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                <WalletCards className="h-3.5 w-3.5" />
                Finance command center
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("pages.finance.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">{t("pages.finance.subtitle")}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {[
                  { label: "Collection", value: `${dashboardSummary.collectionRate}%`, icon: CheckCircle2, tone: "text-emerald-600" },
                  { label: "Open AR", value: format(dashboardSummary.openAr), icon: ReceiptText, tone: "text-primary" },
                  { label: "Expense ratio", value: `${dashboardSummary.expenseRatio}%`, icon: Activity, tone: "text-amber-600" },
                  { label: "Overdue", value: String(dashboardSummary.overdueCount), icon: AlertCircle, tone: "text-rose-600" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-4 w-4 ${item.tone}`} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                    </div>
                    <p className="mt-1 text-lg font-black tracking-tight">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 gap-2 rounded-full border-primary/20 font-semibold shadow-erp-sm">
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
                  <div className="h-px bg-muted my-1" />
                  <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    Integrations
                  </div>
                  <DropdownMenuItem
                    className="text-xs font-bold text-blue-600"
                    onClick={() => downloadReportCsv("/finance/integrations/xero/invoices", `xero-sales-${Date.now()}.csv`)}
                  >
                    Xero Sales Invoices
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs font-bold text-blue-600"
                    onClick={() => downloadReportCsv("/finance/integrations/xero/bills", `xero-bills-${Date.now()}.csv`)}
                  >
                    Xero Purchase Bills
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs font-bold text-emerald-600"
                    onClick={() => downloadReportCsv("/finance/integrations/quickbooks/bills", `qb-bills-${Date.now()}.csv`)}
                  >
                    QuickBooks Bills
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs font-bold text-emerald-600"
                    onClick={() => downloadReportCsv("/finance/integrations/quickbooks/expenses", `qb-expenses-${Date.now()}.csv`)}
                  >
                    QuickBooks Expenses
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canFinance && (
                <>
                  <Button
                    variant="outline"
                    className="h-10 gap-2 rounded-full border-amber-500/40 font-semibold text-amber-700 shadow-erp-sm dark:text-amber-400"
                    onClick={() => setEthCsvOpen(true)}
                  >
                    <FileText className="h-4 w-4" />
                    Ethiopia tax CSV
                  </Button>
                  <Dialog open={ethCsvOpen} onOpenChange={setEthCsvOpen}>
                    <DialogContent className="rounded-2xl border border-border/60 shadow-erp sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-[#1a2744]">Statutory CSV exports</DialogTitle>
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
                    <Button variant="outline" className="h-10 gap-2 rounded-full border-border/60 font-semibold shadow-erp-sm">
                      <FileInput className="h-4 w-4" />
                      Invoice from order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl border border-border/60 shadow-erp sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-[#1a2744]">Invoice from sales order</DialogTitle>
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
                      <div className="rounded-lg border p-3 space-y-3">
                        <Label className="text-[10px] uppercase">Tax override (optional)</Label>
                        <div className="space-y-2">
                          <Label>Tax category key</Label>
                          <Input
                            value={invTaxCategory}
                            onChange={(e) => setInvTaxCategory(e.target.value)}
                            placeholder="e.g. service, export"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Force VAT %</Label>
                            <Input
                              type="number"
                              value={invForceVatRate}
                              onChange={(e) => setInvForceVatRate(e.target.value)}
                              placeholder="leave empty"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Force WHT %</Label>
                            <Input
                              type="number"
                              value={invForceWhtRate}
                              onChange={(e) => setInvForceWhtRate(e.target.value)}
                              placeholder="leave empty"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="inv-vat-exempt"
                            type="checkbox"
                            checked={invVatExempt}
                            onChange={(e) => setInvVatExempt(e.target.checked)}
                          />
                          <Label htmlFor="inv-vat-exempt" className="font-normal">
                            VAT exempt / zero-rated
                          </Label>
                        </div>
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
                    <Button className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                      <Plus className="h-4 w-4" />
                      New entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-erp sm:max-w-xl">
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
          </div>
        </div>

        <FinanceMetrics stats={financeStats} />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-erp-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cashflow health</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-foreground">Revenue, cost, and collection signal</h2>
              </div>
              <Badge variant={(financeStats.profit ?? 0) >= 0 ? "success" : "destructive"} className="w-fit text-[10px] font-black uppercase tracking-widest">
                {(financeStats.profit ?? 0) >= 0 ? "Profitable" : "Margin risk"}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Invoices", value: dashboardSummary.incomeCount, color: "bg-emerald-500" },
                { label: "Expenses", value: dashboardSummary.expenseCount, color: "bg-rose-500" },
                { label: "Settled", value: dashboardSummary.settledCount, color: "bg-blue-500" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border/50 bg-secondary/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  </div>
                  <p className="mt-3 text-3xl font-black tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-erp-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next focus</p>
                <h2 className="text-lg font-black tracking-tight">Review open balances</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-secondary/35 px-4 py-3">
                <span className="text-sm font-semibold text-muted-foreground">Pending value</span>
                <span className="font-black">{format(financeStats.pending ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary/35 px-4 py-3">
                <span className="text-sm font-semibold text-muted-foreground">Overdue entries</span>
                <span className="font-black text-rose-600">{dashboardSummary.overdueCount}</span>
              </div>
            </div>
          </div>
        </div>

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
                  <TabsTrigger value="payroll" className={moduleTabsTriggerClassName()}>
                    <Banknote className="h-4 w-4 shrink-0" />
                    Payroll
                  </TabsTrigger>
                </TabsList>
                <div className="relative w-full sm:max-w-xs group shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search ledger…"
                    className="h-10 rounded-full border-0 bg-[#EEF2F7] pl-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
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
                      <div key={b.k} className="rounded-2xl border-0 bg-card p-4 shadow-erp-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{b.label}</p>
                        <p className="text-xl font-bold tracking-tight">{format(b.t)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-[#1a2744]">
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
                    <div key={bucket} className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-erp">
                      <p className="border-b border-border/50 bg-muted/20 px-4 py-2 text-xs font-bold uppercase text-[#1a2744]">
                        {title}
                      </p>
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
            <TabsContent value="payroll" className="mt-0 focus-visible:outline-none">
              <FinancePayrollTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      );
}
