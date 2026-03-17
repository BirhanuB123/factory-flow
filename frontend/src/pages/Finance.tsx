import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CircleDollarSign, TrendingUp, TrendingDown, Receipt, Loader2, Sparkles, Clock, CreditCard, ArrowRightLeft } from "lucide-react";
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
};

const statusVariant: Record<FinanceStatus, "success" | "warning" | "destructive"> = {
  Paid: "success",
  Pending: "warning",
  Overdue: "destructive",
};

const API_BASE_URL = "http://localhost:5000/api/finance";

export default function Finance() {
  const { symbol } = useCurrency();
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

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`);
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
      const response = await fetch(`${API_BASE_URL}/stats`);
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
        headers: {
          "Content-Type": "application/json",
        },
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
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="relative p-8 rounded-[2rem] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-primary/5 to-purple-500/10 backdrop-blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] w-8 bg-primary" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Capital Ledger</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
              FINANCE OPS
            </h1>
            <p className="text-sm font-medium text-muted-foreground">Fiscal intelligence & liquidity monitoring</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-14 rounded-2xl px-8 font-black uppercase italic text-xs tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-3 bg-primary">
                  <Plus className="h-4 w-4" />
                  Initialize Transaction
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
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <FinanceMetrics stats={financeStats} />

      {/* Ledger Section */}
      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <TabsList className="h-12 bg-white/5 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-[0.15em] data-[state=active]:bg-primary data-[state=active]:shadow-xl shadow-primary/20">All Journals</TabsTrigger>
            <TabsTrigger value="income" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-[0.15em] data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Invoices</TabsTrigger>
            <TabsTrigger value="expense" className="rounded-xl px-6 font-black uppercase italic text-[10px] tracking-[0.15em] data-[state=active]:bg-rose-500 data-[state=active]:text-white">Direct Expenses</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="FILTER LEDGER..."
              className="h-12 pl-11 bg-white/5 border-white/10 rounded-2xl font-black uppercase italic text-[10px] tracking-widest transition-all focus:ring-primary/20 focus:border-primary/30"
            />
          </div>
        </div>

        <TabsContent value="all" className="mt-0">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/[0.03]">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="py-5 pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 w-32">Journal ID</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Type</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Category</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Description</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Value</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Timestamp</TableHead>
                    <TableHead className="py-5 pr-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 text-right">Lifecycle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">Syncing Capital Streams...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">No activity detected within partition.</span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((t) => (
                      <TableRow key={t.id} className="group/row transition-all hover:bg-white/[0.02] border-white/5">
                        <TableCell className="py-4 pl-8">
                          <span className="font-mono text-[10px] font-black uppercase tracking-tighter text-muted-foreground/80 group-hover/row:text-primary transition-colors">
                            FIN-{t.id.substring(t.id.length - 6).toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={`text-[9px] font-black uppercase italic tracking-widest px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1.5 ${t.type === 'Income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {t.type === 'Income' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {t.type}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] font-black uppercase tracking-tight italic opacity-80">{t.category}</TableCell>
                        <TableCell className="text-[11px] font-bold text-muted-foreground/60 italic max-w-xs truncate">{t.description}</TableCell>
                        <TableCell>
                          <div className={`text-base font-black italic tracking-tighter ${t.type === 'Income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === "Income" ? "+" : "-"}{symbol}{t.amount.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground/40 font-mono italic">
                          {new Date(t.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <Badge variant={statusVariant[t.status]} className="text-[9px] font-black uppercase italic tracking-widest px-2.5 py-0.5 rounded-lg border-white/5">
                            {t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        {/* Same layout for filtered contents if needed, but the technical ledger design should be unified */}
      </Tabs>
    </div>
  );
}
