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
  History
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

export default function Pos() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
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
  const [completedOrder, setCompletedOrder] = useState<any>(null);
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
        const product = res.data.data.find((p: any) => p.barcode === code || p.sku === code);
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to open session");
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to close session");
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
        paymentDetails: {
          method: paymentMethod,
          amountTendered: Number(amountTendered) || total,
          change: change
        }
      });

      if (res.data.success) {
        if (res.data.checkoutUrl) {
          // Redirect to Chapa
          window.location.href = res.data.checkoutUrl;
          return;
        }

        setCompletedOrder(res.data.data);
        setShowSuccessDialog(true);
        setCart([]);
        setShowCheckout(false);
        setAmountTendered("");
        setDiscountPercent(0);
        setSelectedClient("walk-in");
        fetchProducts(search);
        fetchActiveSession();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Sale failed");
    } finally {
      setLoading(false);
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
    <div className="flex h-[calc(100vh-64px)] flex-col md:flex-row bg-background no-print">
      {/* Product List Section */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden border-r">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              className="pl-10 h-11 text-lg rounded-xl"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-11 w-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowCloseSession(true)}
          >
            <Store className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl">
            <History className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {products.map((product) => (
              <Card
                key={product._id}
                className="cursor-pointer hover:border-primary transition-all active:scale-95 group overflow-hidden rounded-2xl"
                onClick={() => addToCart(product)}
              >
                <div className="h-32 bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/5 transition-colors">
                  <Store className="h-12 w-12 opacity-20" />
                </div>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm font-semibold truncate">{product.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex justify-between items-center">
                  <span className="font-bold text-primary">ETB {product.price.toLocaleString()}</span>
                  <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="text-[10px]">
                    {product.stock} {product.unit}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="w-full md:w-96 bg-muted/30 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t("pos.cart")}
          </h2>
          <Badge variant="outline" className="rounded-full px-3">{cart.length} items</Badge>
        </div>

        <Separator />

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="flex flex-col gap-3 py-2">
            {cart.map((item) => (
              <div key={item._id} className="flex gap-3 bg-card p-3 rounded-xl shadow-sm border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">ETB {item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => updateQuantity(item._id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={() => updateQuantity(item._id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeFromCart(item._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ShoppingCart className="h-10 w-10 opacity-20" />
                <p className="text-sm">Empty Cart</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="space-y-4 bg-card p-3 rounded-xl border shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <UserIcon className="h-3 w-3" /> Customer
            </label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="h-9 rounded-lg">
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
              className="h-9 rounded-lg" 
              value={discountPercent} 
              onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2">
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
            <span className="text-primary text-2xl">ETB {total.toLocaleString()}</span>
          </div>
          <Button
            className="w-full h-14 text-xl rounded-2xl shadow-lg mt-2"
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            {t("pos.checkout")}
          </Button>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{t("pos.pay")}</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-muted-foreground text-sm uppercase font-semibold tracking-wider">{t("pos.total")}</p>
              <p className="text-4xl font-black text-primary">ETB {total.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2 rounded-2xl"
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote className="h-6 w-6" />
                <span className="text-xs">{t("pos.cash")}</span>
              </Button>
              <Button
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2 rounded-2xl"
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-xs">{t("pos.card")}</span>
              </Button>
              <Button
                variant={paymentMethod === 'mobile' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2 rounded-2xl"
                onClick={() => setPaymentMethod('mobile')}
              >
                <Smartphone className="h-6 w-6" />
                <span className="text-xs">{t("pos.mobile")}</span>
              </Button>
              <Button
                variant={paymentMethod === 'chapa' ? 'default' : 'outline'}
                className="h-20 flex flex-col gap-2 rounded-2xl border-primary/20 hover:border-primary/50"
                onClick={() => setPaymentMethod('chapa')}
              >
                <div className="relative">
                  <Smartphone className="h-6 w-6 text-primary" />
                  <Badge className="absolute -top-2 -right-4 h-4 px-1 text-[8px] bg-primary text-primary-foreground">CHAPA</Badge>
                </div>
                <span className="text-xs font-bold text-primary">Chapa</span>
              </Button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("pos.tendered")}</label>
                  <Input
                    type="number"
                    className="text-2xl h-14 text-center font-bold rounded-xl"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder={total.toString()}
                  />
                </div>
                {Number(amountTendered) > total && (
                  <div className="bg-primary/10 p-4 rounded-xl flex justify-between items-center">
                    <span className="font-medium text-primary">{t("pos.change")}</span>
                    <span className="text-2xl font-black text-primary">ETB {change.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" className="h-12 rounded-xl flex-1" onClick={() => setShowCheckout(false)}>{t("common.close")}</Button>
            <Button className="h-12 rounded-xl flex-1" onClick={handleCheckout} disabled={loading}>
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
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">{t("pos.newSale")}</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-6">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
              <Plus className="h-10 w-10 text-green-600 rotate-45" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold">Sale Completed!</h3>
              <p className="text-muted-foreground text-sm">Order #{completedOrder?._id?.slice(-8).toUpperCase()} has been processed successfully.</p>
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

      {/* Receipt Area (Hidden from screen, visible in print via PosReceipt's internal styles) */}
      <div className="hidden print:block">
        {completedOrder && (
          <PosReceipt ref={receiptRef} order={completedOrder} products={products} />
        )}
      </div>
    </div>
  );
}
