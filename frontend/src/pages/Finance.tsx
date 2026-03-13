import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CircleDollarSign, TrendingUp, TrendingDown, Receipt, Loader2 } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Manage invoices, expenses, and track financial performance
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
              <DialogDescription>
                Record a new income or expense entry.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(value: TransactionType) => setNewTransaction({ ...newTransaction, type: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Category</Label>
                <Input
                  id="category"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Sales, Utilities"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Desc.</Label>
                <Input
                  id="description"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select
                  value={newTransaction.status}
                  onValueChange={(value: FinanceStatus) => setNewTransaction({ ...newTransaction, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddTransaction}>Save Transaction</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{symbol}{financeStats.revenue.toLocaleString()}</div>
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{symbol}{financeStats.expenses.toLocaleString()}</div>
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{symbol}{financeStats.profit.toLocaleString()}</div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CircleDollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{symbol}{financeStats.pending.toLocaleString()}</div>
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="income">Invoices (Income)</TabsTrigger>
          <TabsTrigger value="expense">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <p className="text-sm text-muted-foreground">Review all financial movements</p>
                </div>
                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search transactions…"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pl-6">ID</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Type</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Category</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Description</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="mt-2 text-sm text-muted-foreground">Loading transactions...</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="pl-6 font-mono text-xs">{t.id}</TableCell>
                          <TableCell>
                            <Badge variant={t.type === "Income" ? "success" : "secondary"}>{t.type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{t.category}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.description}</TableCell>
                          <TableCell className={`text-sm font-semibold ${t.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "Income" ? "+" : "-"}{symbol}{t.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">{t.date}</TableCell>
                          <TableCell className="pr-6">
                            <Badge variant={statusVariant[t.status]} className="text-[10px]">
                              {t.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="income">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 text-sm font-medium">Recorded Invoices</CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Invoice ID</TableHead>
                    <TableHead>Client / Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.type === "Income").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No invoices found.</TableCell>
                    </TableRow>
                  ) : (
                    transactions.filter(t => t.type === "Income").map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="text-sm">{t.description}</TableCell>
                        <TableCell className="text-sm font-semibold text-green-600">{symbol}{t.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{t.date}</TableCell>
                        <TableCell className="pr-6">
                          <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="expense">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 text-sm font-medium">Recorded Expenses</CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.type === "Expense").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No expenses found.</TableCell>
                    </TableRow>
                  ) : (
                    transactions.filter(t => t.type === "Expense").map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="text-sm font-medium">{t.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.description}</TableCell>
                        <TableCell className="text-sm font-semibold text-red-600">-{symbol}{t.amount.toLocaleString()}</TableCell>
                        <TableCell className="pr-6 text-sm">{t.date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
