import React, { useState, useEffect, useRef } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { PosReceipt } from "@/components/pos/PosReceipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Store,
  Printer,
  History,
  PackageCheck,
  ReceiptText,
  ScanLine,
  Sparkles,
  BarChart2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User as UserIcon, Tag } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  unit: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Client {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

interface Session {
  _id: string;
  openingBalance: number;
  closingBalance?: number;
  note?: string;
  status: string;
  summary?: {
    totalSales?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CompletedOrder {
  _id: string;
  invoiceId?: string;
  items: Array<{ product: string; quantity: number; price: number; [key: string]: unknown }>;
  totalAmount: number;
  [key: string]: unknown;
}

interface SaleHistoryItem {
  _id: string;
  invoiceId?: string;
  paymentDetails?: {
    method?: string;
    [key: string]: unknown;
  };
  totalAmount?: number;
  discountPercent?: number;
  [key: string]: unknown;
}

export default function Pos() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("walk-in");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [actualClosingBalance, setActualClosingBalance] = useState<string>("");
  const [closeNote, setCloseNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mobile" | "chapa">("cash");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [salesHistory, setSalesHistory] = useState<SaleHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitEntries, setSplitEntries] = useState<Array<{ method: 'cash' | 'card' | 'mobile'; amount: string }>>([
    { method: 'cash', amount: '' },
    { method: 'card', amount: '' },
  ]);
  const [showReports, setShowReports] = useState(false);
  const [reportTab, setReportTab] = useState<"daily" | "session">("daily");
  const [dailyReport, setDailyReport] = useState<Record<string, unknown> | null>(null);
  const [sessionReport, setSessionReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchActiveSession();
    fetchProducts();
    fetchClients();
    checkPaymentCallback();

    // Barcode scanner listener
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // If time between keys is > 50ms, it's probably a human
      if (currentTime - lastKeyTime > 50) {
        buffer = "";
      }

      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (buffer.length > 2) {
          handleBarcode(buffer);
          buffer = "";
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleBarcode = async (code: string) => {
    try {
      const res = await api.get(`/pos/products?search=${code}`);
      if (res.data.success && res.data.data.length > 0) {
        const products = res.data.data as Product[];
        const product = products.find((p) => p.barcode === code || p.sku === code);
        if (product) {
          addToCart(product);
          toast.success(`Added ${product.name}`);
        }
      }
    } catch (error) {
      console.error("Barcode search failed", error);
    }
  };

  const checkPaymentCallback = async () => {
    const txRef = searchParams.get("tx_ref");
    const status = searchParams.get("status");

    if (txRef && status === "success") {
      setVerifyingPayment(true);
      try {
        const res = await api.get(`/payments/verify/${txRef}`);
        if (res.data.success && res.data.data.paymentStatus === "completed") {
          toast.success("Payment verified and sale completed!");
          setCart([]);
          // Clear query params
          setSearchParams({});
        } else {
          toast.info("Payment is still pending. It will be updated automatically.");
        }
      } catch (error) {
        console.error("Verification failed", error);
        toast.error("Failed to verify payment status");
      } finally {
        setVerifyingPayment(false);
      }
    }
  };

  const fetchActiveSession = async () => {
    try {
      const res = await api.get("/pos/session/active");
      if (res.data.success) {
        setSession(res.data.data);
        if (!res.data.data) {
          setShowOpenSession(true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch session", error);
    }
  };

  const fetchProducts = async (q = "") => {
    try {
      const res = await api.get(`/pos/products?search=${q}`);
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get("/clients");
      if (res.data.success) {
        setClients(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch clients", error);
    }
  };

  const handleOpenSession = async () => {
    try {
      const res = await api.post("/pos/session/open", { openingBalance });
      if (res.data.success) {
        setSession(res.data.data);
        setShowOpenSession(false);
        toast.success("POS Session opened");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: unknown } } };
      const message =
        typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Failed to open session";
      toast.error(message);
    }
  };

  const handleCloseSession = async () => {
    try {
      const res = await api.post("/pos/session/close", { 
        actualClosingBalance: Number(actualClosingBalance),
        note: closeNote
      });
      if (res.data.success) {
        setSession(null);
        setShowCloseSession(false);
        setShowOpenSession(true);
        toast.success("POS Session closed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: unknown } } };
      const message =
        typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Failed to close session";
      toast.error(message);
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchProducts(val);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        return prev.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item._id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;
  const change = Number(amountTendered) > total ? Number(amountTendered) - total : 0;

  const splitTotal = splitEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const splitRemaining = Math.max(0, total - splitTotal);
  const splitCashChange = (() => {
    const cashEntry = splitEntries.find((e) => e.method === 'cash');
    const cashAmt = Number(cashEntry?.amount) || 0;
    const nonCash = splitEntries.filter((e) => e.method !== 'cash').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return Math.max(0, cashAmt + nonCash - total);
  })();

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post("/pos/sale", {
        items: cart.map(item => ({
          product: item._id,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: total,
        clientId: selectedClient === "walk-in" ? null : selectedClient,
        discountPercent: discountPercent,
        paymentDetails: isSplitPayment
          ? { method: 'split', amountTendered: splitTotal, change: splitCashChange }
          : { method: paymentMethod, amountTendered: Number(amountTendered) || total, change },
        payments: isSplitPayment
          ? splitEntries.filter(e => Number(e.amount) > 0).map(e => ({ method: e.method, amount: Number(e.amount) }))
          : [],
      });

      if (res.data.success) {
        if (res.data.checkoutUrl) {
          // Redirect to Chapa
          window.location.href = res.data.checkoutUrl;
          return;
        }

        setCompletedOrder({
          ...res.data.data,
          invoiceId: res.data.invoice?.invoiceId,
        });
        setShowSuccessDialog(true);
        setCart([]);
        setShowCheckout(false);
        setAmountTendered("");
        setDiscountPercent(0);
        setSelectedClient("walk-in");
        setIsSplitPayment(false);
        setSplitEntries([{ method: 'cash', amount: '' }, { method: 'card', amount: '' }]);
        fetchProducts(search);
        fetchActiveSession();
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const errorMessage = axiosError?.response?.data?.message
        ?? (error instanceof Error ? error.message : 'Sale failed');
      toast.error(errorMessage || "Sale failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const [dailyRes, sessionRes] = await Promise.all([
        api.get('/pos/reports/daily'),
        session?._id ? api.get(`/pos/reports/session/${session._id}`) : Promise.resolve(null),
      ]);
      setDailyReport(dailyRes.data.data);
      if (sessionRes) setSessionReport(sessionRes.data.data);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setReportLoading(false);
    }
  };

  const fetchSalesHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/pos/sales');
      setSalesHistory(res.data.data || []);
    } catch {
      toast.error('Failed to load sales history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleVoidSale = async () => {
    if (!voidingId) return;
    try {
      await api.post(`/pos/sale/${voidingId}/void`, { reason: voidReason });
      toast.success('Sale voided successfully');
      setShowVoidConfirm(false);
      setVoidingId(null);
      setVoidReason('');
      fetchSalesHistory();
      fetchProducts(search);
      fetchActiveSession();
    } catch (error: unknown) {
      const message = error instanceof AxiosError
        ? error.response?.data?.message
        : undefined;
      toast.error(message || 'Failed to void sale');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!session && !showOpenSession) {
    return <div className="p-8 text-center">{t("common.loading")}</div>;
  }

  if (verifyingPayment) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-2xl font-bold">Verifying Payment...</h2>
          <p className="text-muted-foreground">Please wait while we confirm your transaction with Chapa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--accent)/0.45),hsl(var(--background))_26rem)] no-print md:flex-row">
      {/* Product List Section */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden border-r border-border/60 p-4">
        <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  POS control center
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Point of Sale</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/65">
                  Fast checkout, barcode search, live stock visibility, and session cash control.
                </p>
              </div>
              <div className="grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/15 bg-white/10 shadow-2xl shadow-black/10 backdrop-blur sm:min-w-[420px]">
                {[
                  { label: "Products", value: String(products.length) },
                  { label: "Cart items", value: String(cart.reduce((sum, item) => sum + item.quantity, 0)) },
                  { label: "Total", value: `ETB ${total.toLocaleString()}` },
                ].map((stat, index) => (
                  <div key={stat.label} className={`px-4 py-3 text-center ${index > 0 ? "border-l border-white/10" : ""}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                    <p className="mt-1 truncate font-mono text-base font-black tracking-tight text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-[16px] border border-border/60 bg-card p-3 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, SKU, or scan barcode..."
              className="h-12 rounded-[12px] border-border/70 bg-muted/30 pl-10 text-base shadow-sm focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-12 w-12 rounded-[12px] border-border/70 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowCloseSession(true)}
          >
            <Store className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-[12px] border-border/70 shadow-sm"
            onClick={() => { setShowHistory(true); fetchSalesHistory(); }}>
            <History className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-[12px] border-border/70 shadow-sm"
            onClick={() => { setShowReports(true); fetchReports(); }}>
            <BarChart2 className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {products.map((product) => (
              <Card
                key={product._id}
                className="group cursor-pointer overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg active:scale-[0.98]"
                onClick={() => addToCart(product)}
              >
                <div className="flex h-32 items-center justify-center bg-[linear-gradient(135deg,hsl(var(--muted)),hsl(var(--accent)/0.55))] text-muted-foreground transition-colors group-hover:bg-primary/5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-background/70 text-primary shadow-sm">
                    <PackageCheck className="h-7 w-7" />
                  </div>
                </div>
                <CardHeader className="p-3">
                  <CardTitle className="truncate text-sm font-black tracking-tight">{product.name}</CardTitle>
                  <p className="font-mono text-xs font-semibold text-muted-foreground">{product.sku}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex justify-between items-center">
                  <span className="font-mono font-black text-primary">ETB {product.price.toLocaleString()}</span>
                  <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="rounded-[10px] text-[10px] font-black">
                    {product.stock} {product.unit}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="flex w-full flex-col gap-4 bg-card/85 p-4 shadow-[inset_1px_0_0_hsl(var(--border)/0.6)] md:w-[420px]">
        <div className="overflow-hidden rounded-[18px] border border-border/60 bg-background shadow-sm">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Current sale</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight">
                <ShoppingCart className="h-5 w-5 text-primary" />
                {t("pos.cart")}
              </h2>
            </div>
            <Badge variant="outline" className="rounded-[12px] px-3 py-1 font-black">{cart.length} items</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="flex flex-col gap-3 py-2">
            {cart.map((item) => (
              <div key={item._id} className="flex gap-3 rounded-[14px] border border-border/60 bg-background p-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-black tracking-tight">{item.name}</p>
                  <p className="font-mono text-xs font-semibold text-muted-foreground">ETB {item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[10px]"
                    onClick={() => updateQuantity(item._id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[10px]"
                    onClick={() => updateQuantity(item._id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeFromCart(item._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-border/70 bg-background/70 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-muted">
                  <ScanLine className="h-6 w-6 opacity-60" />
                </div>
                <p className="text-sm font-semibold">Scan or tap products to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="space-y-4 rounded-[16px] border border-border/60 bg-background p-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <UserIcon className="h-3 w-3" /> Customer
            </label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="h-10 rounded-[12px] border-border/70 bg-muted/30">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" /> Discount (%)
            </label>
            <Input 
              type="number" 
              className="h-10 rounded-[12px] border-border/70 bg-muted/30" 
              value={discountPercent} 
              onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-[18px] border border-border/60 bg-background p-4 shadow-sm">
          {discountPercent > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>ETB {subtotal.toLocaleString()}</span>
            </div>
          )}
          {discountPercent > 0 && (
            <div className="flex justify-between text-sm text-destructive font-medium">
              <span>Discount ({discountPercent}%)</span>
              <span>-ETB {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>{t("pos.total")}</span>
            <span className="font-mono text-2xl font-black text-primary">ETB {total.toLocaleString()}</span>
          </div>
          <Button
            className="mt-2 h-14 w-full rounded-[16px] text-xl font-black shadow-lg"
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            <ReceiptText className="h-5 w-5" />
            {t("pos.checkout")}
          </Button>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl shadow-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-3xl font-black tracking-tight">{t("pos.pay")}</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            {/* Total Amount Display */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 text-center border border-primary/20 shadow-sm">
              <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest mb-2">{t("pos.total")}</p>
              <p className="text-5xl font-black text-primary">ETB {total.toLocaleString()}</p>
              <div className="text-xs text-muted-foreground mt-2">{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Split toggle */}
            <div className="flex gap-2 bg-muted/50 rounded-xl p-1.5 border border-border/50">
              <Button 
                size="sm" 
                variant={!isSplitPayment ? "default" : "ghost"} 
                className="flex-1 rounded-lg h-9 text-sm font-semibold transition-all"
                onClick={() => setIsSplitPayment(false)}
              >
                Single
              </Button>
              <Button 
                size="sm" 
                variant={isSplitPayment ? "default" : "ghost"} 
                className="flex-1 rounded-lg h-9 text-sm font-semibold transition-all"
                onClick={() => setIsSplitPayment(true)}
              >
                Split
              </Button>
            </div>

            {!isSplitPayment ? (
              <div className="space-y-5">
                {/* Payment Method Selection */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['cash', 'card', 'mobile', 'chapa'] as const).map((m) => (
                      <Button 
                        key={m} 
                        variant={paymentMethod === m ? 'default' : 'outline'}
                        className={`h-24 flex flex-col gap-3 rounded-xl transition-all duration-200 ${
                          paymentMethod === m 
                            ? 'shadow-lg shadow-primary/30 ring-2 ring-primary' 
                            : 'hover:border-primary/50 hover:shadow-md'
                        }`}
                        onClick={() => setPaymentMethod(m)}
                      >
                        <div className="relative">
                          {m === 'cash' && <Banknote className="h-7 w-7" />}
                          {m === 'card' && <CreditCard className="h-7 w-7" />}
                          {m === 'mobile' && <Smartphone className="h-7 w-7" />}
                          {m === 'chapa' && (
                            <>
                              <Smartphone className="h-7 w-7" />
                              <Badge className="absolute -top-2 -right-3 h-5 px-1.5 text-[9px] font-bold bg-gradient-to-r from-primary to-primary/80 text-white">
                                CHAPA
                              </Badge>
                            </>
                          )}
                        </div>
                        <span className="text-xs font-bold leading-tight">
                          {m === 'cash' ? t("pos.cash") : m === 'card' ? t("pos.card") : m === 'mobile' ? t("pos.mobile") : 'Chapa'}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Cash Input Section */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t("pos.tendered")} Amount
                      </label>
                      <Input 
                        type="number" 
                        className="h-16 rounded-xl text-center text-3xl font-black border-2 border-primary/20 focus:border-primary/50 transition-colors" 
                        value={amountTendered} 
                        onChange={(e) => setAmountTendered(e.target.value)} 
                        placeholder={total.toString()} 
                      />
                    </div>
                    {Number(amountTendered) > total && (
                      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-4 border border-emerald-500/20">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{t("pos.change")}</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">
                          ETB {change.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-cash payment info */}
                {paymentMethod !== 'cash' && (
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900 text-center">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {paymentMethod === 'card' && 'Please process the card payment'}
                      {paymentMethod === 'mobile' && 'Mobile money payment will be processed'}
                      {paymentMethod === 'chapa' && 'Chapa payment gateway will be used'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Split Payment Details
                </div>
                {splitEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-in fade-in">
                    <Select value={entry.method} onValueChange={(v) => setSplitEntries(prev => prev.map((e, i) => i === idx ? { ...e, method: v as typeof e.method } : e))}>
                      <SelectTrigger className="w-28 h-11 rounded-lg border-border/70 bg-muted/50 shrink-0 font-semibold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number" 
                      placeholder="Amount" 
                      className="h-11 rounded-lg text-right font-bold border-border/70 bg-muted/50"
                      value={entry.amount}
                      onChange={(e) => setSplitEntries(prev => prev.map((en, i) => i === idx ? { ...en, amount: e.target.value } : en))} 
                    />
                    {splitEntries.length > 2 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => setSplitEntries(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full rounded-lg h-10 text-sm gap-2 border-dashed"
                  onClick={() => setSplitEntries(prev => [...prev, { method: 'cash', amount: '' }])}
                >
                  <Plus className="h-4 w-4" /> Add Method
                </Button>

                <div className={`flex items-center justify-between rounded-xl p-4 text-sm font-bold transition-all ${
                  splitRemaining > 0.01 
                    ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  <span>{splitRemaining > 0.01 ? 'Remaining to Pay' : '✓ Fully Covered'}</span>
                  <span className="text-lg font-black">ETB {(splitRemaining > 0.01 ? splitRemaining : splitTotal).toLocaleString()}</span>
                </div>

                {splitCashChange > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-4 border border-emerald-500/20">
                    <span className="font-bold">{t("pos.change")}</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      ETB {splitCashChange.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-3 border-t pt-4">
            <Button 
              variant="outline" 
              className="h-12 flex-1 rounded-lg font-semibold text-sm" 
              onClick={() => setShowCheckout(false)}
            >
              {t("common.close")}
            </Button>
            <Button 
              className="h-12 flex-1 rounded-lg font-black text-sm shadow-lg shadow-primary/30" 
              onClick={handleCheckout}
              disabled={loading || (isSplitPayment && splitRemaining > 0.01)}
            >
              {loading ? t("common.loading") : t("pos.pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Session Dialog */}
      <Dialog open={showOpenSession} onOpenChange={(open) => !open && session ? setShowOpenSession(false) : null}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              {t("pos.openSession")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-muted-foreground text-sm">Welcome, {user?.name}. Please enter the initial cash amount to start the POS session.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("pos.openingBalance")}</label>
              <Input
                type="number"
                className="text-2xl h-14 text-center font-bold rounded-xl"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl text-lg font-bold" onClick={handleOpenSession}>
              {t("pos.openSession")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={showCloseSession} onOpenChange={setShowCloseSession}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-destructive" />
              {t("pos.closeSession")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-2xl space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t("pos.openingBalance")}</p>
                <p className="text-xl font-bold">ETB {session?.openingBalance?.toLocaleString()}</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl space-y-1 border border-primary/10">
                <p className="text-[10px] uppercase font-bold text-primary tracking-wider">{t("pos.total")}</p>
                <p className="text-xl font-bold text-primary">ETB {session?.summary?.totalSales?.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("pos.actualClosing")}</label>
                <Input
                  type="number"
                  className="text-2xl h-14 text-center font-bold rounded-xl"
                  value={actualClosingBalance}
                  onChange={(e) => setActualClosingBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {actualClosingBalance && (
                <div className="bg-muted/30 p-4 rounded-xl flex justify-between items-center">
                  <span className="font-medium">{t("pos.difference")}</span>
                  <span className={`text-xl font-black ${
                    (Number(actualClosingBalance) - ((session?.openingBalance || 0) + (session?.summary?.totalSales || 0))) === 0 
                    ? 'text-green-600' 
                    : 'text-destructive'
                  }`}>
                    ETB {(Number(actualClosingBalance) - ((session?.openingBalance || 0) + (session?.summary?.totalSales || 0))).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  className="rounded-xl"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="Any discrepancies?"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" className="h-12 rounded-xl flex-1" onClick={() => setShowCloseSession(false)}>{t("common.close")}</Button>
            <Button variant="destructive" className="h-12 rounded-xl flex-1 font-bold" onClick={handleCloseSession}>
              {t("pos.closeSession")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl no-print">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">{t("pos.newSale")}</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-6">
            <div className="h-24 w-24 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="h-12 w-12 text-emerald-600" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-emerald-700">Sale Completed!</h3>
              <p className="text-muted-foreground text-sm">
                {completedOrder?.invoiceId
                  ? `Invoice ${completedOrder.invoiceId} has been processed successfully.`
                  : `Order #${completedOrder?._id?.slice(-8).toUpperCase()} has been processed successfully.`}
              </p>
            </div>
            
            <div className="w-full space-y-3">
              <Button className="w-full h-12 rounded-xl gap-2" onClick={handlePrint}>
                <Printer className="h-5 w-5" />
                {t("pos.print")} {t("pos.receipt")}
              </Button>
              <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => setShowSuccessDialog(false)}>
                {t("pos.newSale")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reports Dialog */}
      <Dialog open={showReports} onOpenChange={setShowReports}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl no-print">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">POS Reports</DialogTitle>
          </DialogHeader>

          {/* Tab toggle */}
          <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1 gap-1">
            <Button
              size="sm"
              variant={reportTab === "daily" ? "default" : "ghost"}
              className="flex-1 rounded-lg h-9 text-xs font-semibold"
              onClick={() => setReportTab("daily")}
            >
              Today's Summary
            </Button>
            <Button
              size="sm"
              variant={reportTab === "session" ? "default" : "ghost"}
              className="flex-1 rounded-lg h-9 text-xs font-semibold"
              onClick={() => setReportTab("session")}
            >
              Session Reconciliation
            </Button>
          </div>

          <ScrollArea className="max-h-[480px] pr-1">
            {reportLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reportTab === "daily" ? (
              dailyReport ? (
                <div className="space-y-4 py-1">
                  {/* KPI row */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Transactions", value: String(dailyReport.transactionCount as number) },
                      { label: "Total Revenue", value: `ETB ${(dailyReport.totalRevenue as number).toLocaleString()}` },
                      { label: "Discounts Given", value: `ETB ${(dailyReport.discountTotal as number).toLocaleString()}` },
                      { label: "Voided Sales", value: `${dailyReport.voidCount} (ETB ${(dailyReport.voidedAmount as number).toLocaleString()})` },
                    ].map((kpi) => (
                      <div key={kpi.label} className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                        <p className="mt-1 text-base font-bold">{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Payment breakdown */}
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Breakdown</p>
                    {[
                      { label: "Cash", value: dailyReport.cashSales as number },
                      { label: "Card", value: dailyReport.cardSales as number },
                      { label: "Mobile / Chapa", value: dailyReport.mobileSales as number },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold">ETB {row.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Top products */}
                  {(dailyReport.topProducts as unknown[]).length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Products</p>
                      {(dailyReport.topProducts as Array<{ name: string; sku: string; quantity: number; revenue: number }>).map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">{p.name}</span>
                          <span className="font-semibold">{p.quantity} units · ETB {p.revenue.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">No data available.</p>
              )
            ) : (
              sessionReport ? (
                <div className="space-y-3 py-1">
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session Info</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cashier</span>
                      <span className="font-semibold">{(sessionReport.user as Record<string, unknown>)?.name as string || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`font-semibold capitalize ${sessionReport.status === "open" ? "text-green-600" : "text-muted-foreground"}`}>
                        {sessionReport.status as string}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-semibold">{new Date(sessionReport.startTime as string).toLocaleTimeString()}</span>
                    </div>
                    {sessionReport.endTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Closed</span>
                        <span className="font-semibold">{new Date(sessionReport.endTime as string).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash Reconciliation</p>
                    {[
                      { label: "Opening Balance", value: sessionReport.openingBalance as number },
                      { label: "Cash Sales", value: (sessionReport.summary as Record<string, number>)?.cashSales },
                      { label: "Expected Closing", value: sessionReport.closingBalance as number ?? ((sessionReport.openingBalance as number) + ((sessionReport.summary as Record<string, number>)?.cashSales ?? 0)) },
                      { label: "Actual (Counted)", value: sessionReport.actualClosingBalance as number },
                      { label: "Difference", value: sessionReport.difference as number },
                    ].map((row) => (
                      row.value != null && (
                        <div key={row.label} className="flex justify-between">
                          <span className={`text-muted-foreground ${row.label === "Difference" ? "font-semibold" : ""}`}>{row.label}</span>
                          <span className={`font-semibold ${row.label === "Difference" && (row.value as number) < 0 ? "text-destructive" : row.label === "Difference" && (row.value as number) > 0 ? "text-green-600" : ""}`}>
                            ETB {(row.value as number).toLocaleString()}
                          </span>
                        </div>
                      )
                    ))}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Summary</p>
                    {[
                      { label: "Total Sales", value: (sessionReport.summary as Record<string, number>)?.totalSales },
                      { label: "Card Sales", value: (sessionReport.summary as Record<string, number>)?.cardSales },
                      { label: "Mobile / Chapa", value: (sessionReport.summary as Record<string, number>)?.mobileSales },
                      { label: "Discounts", value: (sessionReport.summary as Record<string, number>)?.discountTotal },
                      { label: "Voided", value: sessionReport.voidedAmount as number },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold">ETB {(row.value ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">No active session data.</p>
              )
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl w-full" onClick={() => setShowReports(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl no-print">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Today's Sales</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[480px] pr-2">
            {historyLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : salesHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No sales recorded today.</p>
            ) : (
              <div className="space-y-2">
                {salesHistory.map((sale: SaleHistoryItem) => (
                  <div key={sale._id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                    <div className="space-y-0.5">
                      <p className="font-semibold">{sale.invoiceId || `#${sale._id.slice(-8).toUpperCase()}`}</p>
                      <p className="text-muted-foreground capitalize">
                        {sale.paymentDetails?.method} · ETB {sale.totalAmount?.toLocaleString()}
                        {(sale.discountPercent || 0) > 0 && ` · ${sale.discountPercent}% off`}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-lg text-xs h-8"
                      onClick={() => { setVoidingId(sale._id); setShowVoidConfirm(true); }}
                    >
                      Void
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl w-full" onClick={() => setShowHistory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <Dialog open={showVoidConfirm} onOpenChange={(open) => { setShowVoidConfirm(open); if (!open) { setVoidingId(null); setVoidReason(''); } }}>
        <DialogContent className="sm:max-w-[380px] rounded-3xl no-print">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive">Void Sale?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This will reverse stock movements, reverse the journal entry, and mark the invoice void. This cannot be undone.</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                className="rounded-xl"
                placeholder="e.g. Customer returned item"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => { setShowVoidConfirm(false); setVoidingId(null); setVoidReason(''); }}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl flex-1 font-bold" onClick={handleVoidSale}>Confirm Void</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt — off-screen in DOM, printed via visibility CSS in PosReceipt */}
      {completedOrder && (
        <PosReceipt ref={receiptRef} order={completedOrder} products={products} />
      )}
    </div>
  );
}
