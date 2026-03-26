import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import api, { auditApi, billingApi, ethiopiaTaxApi, type EthiopiaTaxSettings } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Factory,
  User,
  Bell,
  Shield,
  Clock,
  Globe,
  Palette,
  Save,
  Sparkles,
  Sliders,
  ShieldCheck,
  Zap,
  Settings as SettingsIcon,
  ListTree,
  Loader2,
  Scale,
  CalendarClock,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Plus,
  Trash2,
  Building2,
  Percent,
  Tags,
  Hash,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  ModuleDashboardLayout,
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SETTINGS_KEY = "erp-settings";
const DEVICE_ONLY_LABEL = "Device-only preference";
const TENANT_WIDE_LABEL = "Tenant-wide server setting";

function subscriptionBadgeVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "suspended" || status === "archived") return "destructive";
  return "outline";
}

function subscriptionStatusLabel(status?: string): string {
  if (status === "active") return "Active";
  if (status === "trial") return "Trial";
  if (status === "suspended") return "Suspended";
  if (status === "archived") return "Archived";
  return "Unknown";
}

function AuditLogPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs-ui"],
    queryFn: () => auditApi.list({ limit: 150 }),
  });
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-destructive">Could not load audit log.</p>;
  }
  const rows = data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          System activity stream
        </p>
        <Badge variant="outline" className="text-[9px] font-mono border-border/40">
          Source: {data?.total ?? 0} total records
        </Badge>
      </div>
      <div className="rounded-2xl border border-border/40 bg-background/40 overflow-hidden shadow-sm">
        <div className="max-h-[520px] overflow-y-auto overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader className="bg-secondary/30 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3 px-4">Timestamp</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3 px-4">Operation</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3 px-4">Resource</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3 px-4">Subject</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3 px-4">Narrative</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-24 bg-background/20">
                    <div className="flex flex-col items-center gap-2">
                      <ListTree className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium">No audit entries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="group transition-colors hover:bg-muted/30 border-b border-border/20">
                    <TableCell className="text-[11px] font-medium py-3 px-4 whitespace-nowrap text-muted-foreground">
                      {row.at ? new Date(row.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-mono font-bold bg-background/50 border-border/40">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] font-medium py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-foreground">{row.entityType}</span>
                        {row.entityId ? <span className="text-[10px] text-muted-foreground font-mono">{String(row.entityId).slice(0, 12)}...</span> : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-secondary/50 flex items-center justify-center text-[10px] font-bold border border-border/40">
                          {row.actor?.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="font-semibold text-foreground/90">{row.actor?.name ?? "System"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-3 px-4 text-muted-foreground leading-relaxed max-w-[320px] truncate group-hover:whitespace-normal group-hover:overflow-visible" title={row.summary}>
                      {row.summary}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const defaultSettings = {
  shopName: "Integra CNC",
  shopAddress: "1234 Industrial Blvd, Suite 100",
  shopCity: "Detroit, MI 48201",
  shopPhone: "(313) 555-0199",
  shopEmail: "ops@integracnc.com",
  timezone: "America/Detroit",
  currency: "ETB",
  displayName: "Alex Torres",
  role: "Shop Manager",
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  jobStatusAlerts: true,
  delayAlerts: true,
  autoBackup: true,
  darkMode: false,
  compactView: false,
  dateFormat: "YYYY-MM-DD",
  defaultJobView: "table",
  uiLanguage: "en" as "en" | "am" | "om",
  showEthiopianDates: true,
};

export default function Settings() {
  const { user, refreshPermissions } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tenantSubscription = user?.tenantSubscription;
  const trialDate = tenantSubscription?.trialEndDate ? new Date(tenantSubscription.trialEndDate) : null;
  const trialDaysLeft =
    trialDate != null ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isTrialExpired = typeof trialDaysLeft === "number" && trialDaysLeft < 0;
  const isSuspendedOrArchived =
    tenantSubscription?.status === "suspended" || tenantSubscription?.status === "archived";
  const canAudit =
    user?.role === "Admin" || user?.role === "finance_head" || user?.role === "finance_viewer";
  const canFinance =
    user?.role === "Admin" || user?.role === "finance_head" || user?.role === "finance_viewer";
  const canEditEthTax = user?.role === "Admin" || user?.role === "finance_head";
  const qcEth = useQueryClient();

  const { data: permDoc } = useQuery({
    queryKey: ["auth-permissions-doc"],
    queryFn: async () => (await api.get("/auth/permissions")).data as {
      role: string;
      permissions: string[];
      matrix: { note: string; actions: { label: string }[]; roles: { role: string; grants: string[] }[] };
    },
  });

  const [shopName, setShopName] = useState(defaultSettings.shopName);
  const [shopAddress, setShopAddress] = useState(defaultSettings.shopAddress);
  const [shopCity, setShopCity] = useState(defaultSettings.shopCity);
  const [shopPhone, setShopPhone] = useState(defaultSettings.shopPhone);
  const [shopEmail, setShopEmail] = useState(defaultSettings.shopEmail);
  const [timezone, setTimezone] = useState(defaultSettings.timezone);
  const [currency, setCurrency] = useState(defaultSettings.currency);
  const [displayName, setDisplayName] = useState(defaultSettings.displayName);
  const [role] = useState(defaultSettings.role);
  const [emailNotifications, setEmailNotifications] = useState(defaultSettings.emailNotifications);
  const [smsNotifications, setSmsNotifications] = useState(defaultSettings.smsNotifications);
  const [lowStockAlerts, setLowStockAlerts] = useState(defaultSettings.lowStockAlerts);
  const [jobStatusAlerts, setJobStatusAlerts] = useState(defaultSettings.jobStatusAlerts);
  const [delayAlerts, setDelayAlerts] = useState(defaultSettings.delayAlerts);
  const [autoBackup, setAutoBackup] = useState(defaultSettings.autoBackup);
  const [darkMode, setDarkMode] = useState(defaultSettings.darkMode);
  const [compactView, setCompactView] = useState(defaultSettings.compactView);
  const [dateFormat, setDateFormat] = useState(defaultSettings.dateFormat);
  const [defaultJobView, setDefaultJobView] = useState(defaultSettings.defaultJobView);
  const [uiLanguage, setUiLanguage] = useState<"en" | "am" | "om">(defaultSettings.uiLanguage);
  const [showEthiopianDates, setShowEthiopianDates] = useState(defaultSettings.showEthiopianDates);

  const { data: ethTax, isLoading: ethTaxLoading } = useQuery({
    queryKey: ["ethiopia-tax-settings"],
    queryFn: ethiopiaTaxApi.getSettings,
    enabled: canFinance,
  });
  const [ethForm, setEthForm] = useState<Partial<EthiopiaTaxSettings>>({});
  useEffect(() => {
    if (!ethTax) return;
    setEthForm({
      ...ethTax,
      sellerVatRegistered: ethTax.sellerVatRegistered !== false,
      whtCategoryRates: Array.isArray(ethTax.whtCategoryRates)
        ? ethTax.whtCategoryRates.map((r) => ({
          key: r.key ?? "",
          label: r.label ?? "",
          salesRatePercent:
            r.salesRatePercent === undefined || r.salesRatePercent === null
              ? null
              : Number(r.salesRatePercent),
          purchaseRatePercent:
            r.purchaseRatePercent === undefined || r.purchaseRatePercent === null
              ? null
              : Number(r.purchaseRatePercent),
        }))
        : [],
    });
  }, [ethTax]);
  const saveEthTax = useMutation({
    mutationFn: () => {
      const rates = (ethForm.whtCategoryRates ?? [])
        .map((r) => ({
          key: String(r.key ?? "").trim(),
          label: String(r.label ?? "").trim(),
          salesRatePercent:
            r.salesRatePercent === null ||
              r.salesRatePercent === undefined ||
              String(r.salesRatePercent) === ""
              ? null
              : Math.max(0, Number(r.salesRatePercent)),
          purchaseRatePercent:
            r.purchaseRatePercent === null ||
              r.purchaseRatePercent === undefined ||
              String(r.purchaseRatePercent) === ""
              ? null
              : Math.max(0, Number(r.purchaseRatePercent)),
        }))
        .filter((r) => r.key.length > 0);
      return ethiopiaTaxApi.updateSettings({
        ...ethForm,
        sellerVatRegistered: ethForm.sellerVatRegistered !== false,
        whtCategoryRates: rates,
      });
    },
    onSuccess: (d) => {
      setEthForm({
        ...d,
        sellerVatRegistered: d.sellerVatRegistered !== false,
        whtCategoryRates: Array.isArray(d.whtCategoryRates)
          ? d.whtCategoryRates.map((r) => ({
            key: r.key ?? "",
            label: r.label ?? "",
            salesRatePercent:
              r.salesRatePercent === undefined || r.salesRatePercent === null
                ? null
                : Number(r.salesRatePercent),
            purchaseRatePercent:
              r.purchaseRatePercent === undefined || r.purchaseRatePercent === null
                ? null
                : Number(r.purchaseRatePercent),
          }))
          : [],
      });
      qcEth.invalidateQueries({ queryKey: ["ethiopia-tax-settings"] });
      toast.success("Ethiopia tax settings saved");
    },
    onError: () => toast.error("Could not save tax settings"),
  });
  const startChapaCheckout = useMutation({
    mutationFn: (body?: { plan?: string; email?: string; returnPath?: string }) =>
      billingApi.startChapaCheckout(body),
    onSuccess: (result) => {
      const checkoutUrl = result?.data?.checkoutUrl;
      if (!checkoutUrl) {
        toast.error("Could not open Chapa checkout");
        return;
      }
      window.location.assign(checkoutUrl);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not start Chapa checkout";
      toast.error(message);
    },
  });
  const verifyChapaCheckout = useMutation({
    mutationFn: (txRef: string) => billingApi.verifyChapaPayment(txRef),
    onSuccess: async () => {
      await refreshPermissions();
      toast.success("Payment verified. Subscription is now active.");
      const params = new URLSearchParams(location.search);
      params.delete("chapa_ref");
      params.delete("chapa_status");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : "",
        },
        { replace: true }
      );
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Payment not yet completed";
      toast.error(message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const txRef = String(params.get("chapa_ref") || "").trim();
    if (!txRef || verifyChapaCheckout.isPending || verifyChapaCheckout.isSuccess) return;
    verifyChapaCheckout.mutate(txRef);
  }, [location.search, verifyChapaCheckout]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (saved.shopName != null) setShopName(String(saved.shopName));
        if (saved.shopAddress != null) setShopAddress(String(saved.shopAddress));
        if (saved.shopCity != null) setShopCity(String(saved.shopCity));
        if (saved.shopPhone != null) setShopPhone(String(saved.shopPhone));
        if (saved.shopEmail != null) setShopEmail(String(saved.shopEmail));
        if (saved.timezone != null) setTimezone(String(saved.timezone));
        if (saved.currency != null) setCurrency(String(saved.currency));
        if (saved.displayName != null) setDisplayName(String(saved.displayName));
        if (saved.emailNotifications != null) setEmailNotifications(Boolean(saved.emailNotifications));
        if (saved.smsNotifications != null) setSmsNotifications(Boolean(saved.smsNotifications));
        if (saved.lowStockAlerts != null) setLowStockAlerts(Boolean(saved.lowStockAlerts));
        if (saved.jobStatusAlerts != null) setJobStatusAlerts(Boolean(saved.jobStatusAlerts));
        if (saved.delayAlerts != null) setDelayAlerts(Boolean(saved.delayAlerts));
        if (saved.autoBackup != null) setAutoBackup(Boolean(saved.autoBackup));
        if (saved.darkMode != null) setDarkMode(Boolean(saved.darkMode));
        if (saved.compactView != null) setCompactView(Boolean(saved.compactView));
        if (saved.dateFormat != null) setDateFormat(String(saved.dateFormat));
        if (saved.defaultJobView != null) setDefaultJobView(String(saved.defaultJobView));
        if (saved.uiLanguage === "am" || saved.uiLanguage === "om" || saved.uiLanguage === "en") {
          setUiLanguage(saved.uiLanguage);
        }
        if (typeof saved.showEthiopianDates === "boolean") setShowEthiopianDates(saved.showEthiopianDates);
      }
    } catch {
      // ignore invalid stored data
    }
  }, []);

  const getSettingsSnapshot = () => ({
    shopName,
    shopAddress,
    shopCity,
    shopPhone,
    shopEmail,
    timezone,
    currency,
    displayName,
    role,
    emailNotifications,
    smsNotifications,
    lowStockAlerts,
    jobStatusAlerts,
    delayAlerts,
    autoBackup,
    darkMode,
    compactView,
    dateFormat,
    defaultJobView,
    uiLanguage,
    showEthiopianDates,
  });

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettingsSnapshot()));
    window.dispatchEvent(new Event("erp-settings-updated"));
    toast.success("Settings saved successfully");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(getSettingsSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erp-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported");
  };

  const handleReset = () => {
    localStorage.removeItem(SETTINGS_KEY);
    setShopName(defaultSettings.shopName);
    setShopAddress(defaultSettings.shopAddress);
    setShopCity(defaultSettings.shopCity);
    setShopPhone(defaultSettings.shopPhone);
    setShopEmail(defaultSettings.shopEmail);
    setTimezone(defaultSettings.timezone);
    setCurrency(defaultSettings.currency);
    setDisplayName(defaultSettings.displayName);
    setEmailNotifications(defaultSettings.emailNotifications);
    setSmsNotifications(defaultSettings.smsNotifications);
    setLowStockAlerts(defaultSettings.lowStockAlerts);
    setJobStatusAlerts(defaultSettings.jobStatusAlerts);
    setDelayAlerts(defaultSettings.delayAlerts);
    setAutoBackup(defaultSettings.autoBackup);
    setDarkMode(defaultSettings.darkMode);
    setCompactView(defaultSettings.compactView);
    setDateFormat(defaultSettings.dateFormat);
    setDefaultJobView(defaultSettings.defaultJobView);
    setUiLanguage(defaultSettings.uiLanguage);
    setShowEthiopianDates(defaultSettings.showEthiopianDates);
    toast.success("Settings reset to defaults");
  };
  const canSelfPaySubscription = user?.role === "Admin" || user?.role === "finance_head";
  const handlePayWithChapa = () => {
    const plan = String(tenantSubscription?.plan || "starter").toLowerCase();
    startChapaCheckout.mutate({ plan, returnPath: "/settings", email: shopEmail || user?.email });
  };

  return (
    <ModuleDashboardLayout
      className="max-w-[1600px]"
      title="Control Center"
      description="Manage enterprise identity, regional preferences, and security policies"
      icon={SettingsIcon}
      healthStats={[
        { label: "Core Build", value: "1.2.0", accent: "text-primary" },
        { label: "Regional", value: timezone.split("/").pop() ?? timezone, accent: "text-blue-500" },
        { label: "Currency", value: currency, accent: "text-emerald-500" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-border/60 bg-background/50 backdrop-blur-sm"
          >
            <Globe className="mr-2 h-3.5 w-3.5" />
            Export Data
          </Button>
          <Button
            onClick={handleSave}
            className="h-11 rounded-xl px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
          >
            <Save className="mr-2 h-4 w-4" />
            Commit Changes
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="shop" className="space-y-6">
        <Card className="rounded-2xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Data Sovereignty & Persistence
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="group flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-5 transition-all hover:border-primary/20 hover:bg-background/60">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/50 border border-border/40 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border-border/40">
                    {DEVICE_ONLY_LABEL}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed pr-4">
                    Identity, notifications, and local preferences are stored in this browser's secure cache.
                  </p>
                </div>
              </div>
              <div className="group flex gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 transition-all hover:bg-primary/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Badge variant="default" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 shadow-sm">
                    {TENANT_WIDE_LABEL}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed pr-4">
                    Access roles, compliance logs, and tax profiles are synchronized across all company nodes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <StickyModuleTabs>
          <TabsList className="bg-secondary/10 backdrop-blur-lg border border-border/40 p-1 mb-8 self-start">
            <TabsTrigger value="shop" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
              <Factory className="mr-2 h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="user" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
              <User className="mr-2 h-4 w-4" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
              <Bell className="mr-2 h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
              <Sliders className="mr-2 h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="access" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Access
            </TabsTrigger>
            {canAudit && (
              <TabsTrigger value="audit" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
                <ListTree className="mr-2 h-4 w-4" />
                Audit Log
              </TabsTrigger>
            )}
            {canFinance && (
              <TabsTrigger value="ethiopia-tax" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 py-2 transition-all">
                <Scale className="mr-2 h-4 w-4" />
                Tax Profile
              </TabsTrigger>
            )}
          </TabsList>
        </StickyModuleTabs>

        {/* Shop Configuration */}
        <TabsContent value="shop" className="space-y-4">
          {tenantSubscription && user?.platformRole !== "super_admin" && (
            <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/5 backdrop-blur-sm overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
              <CardContent className="pt-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/15 rounded-xl border border-primary/20">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                          Subscription
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={subscriptionBadgeVariant(tenantSubscription.status)}
                            className="px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wider"
                          >
                            {subscriptionStatusLabel(tenantSubscription.status)}
                          </Badge>
                          <span className="text-lg font-black tracking-tight">{tenantSubscription.displayName || shopName}</span>
                        </div>
                      </div>
                    </div>
                    {isSuspendedOrArchived && tenantSubscription.statusReason ? (
                      <p className="text-xs text-destructive font-medium bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20 inline-flex items-center gap-2">
                        <Ban className="h-4 w-4" />
                        {tenantSubscription.statusReason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="grid grid-cols-2 lg:flex lg:items-center gap-3">
                      <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/50 px-4 py-2 min-w-[120px]">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Level</span>
                        <span className="font-black text-foreground text-sm uppercase">
                          {tenantSubscription.plan || "starter"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/50 px-4 py-2 min-w-[140px]">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Renewal</span>
                        <span className="font-bold text-foreground text-sm">
                          {trialDate ? trialDate.toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/30 border border-border/40">
                        {tenantSubscription.status === "active" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/20" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                        )}
                        <span className="font-semibold text-muted-foreground text-[11px]">
                          {tenantSubscription.status === "trial" && trialDaysLeft != null ? (
                            isTrialExpired ? "Trial expired" : `${Math.max(0, trialDaysLeft)} day(s) remaining`
                          ) : tenantSubscription.status === "active" ? (
                            "In good standing"
                          ) : (
                            "Review account"
                          )}
                        </span>
                      </div>

                      {canSelfPaySubscription ? (
                        <Button
                          onClick={handlePayWithChapa}
                          disabled={startChapaCheckout.isPending || verifyChapaCheckout.isPending}
                          className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                          variant="default"
                        >
                          {startChapaCheckout.isPending || verifyChapaCheckout.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            "Settle Balance (Chapa)"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm xl:col-span-2 overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <Factory className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-bold tracking-tight">Company Profile</CardTitle>
                      <CardDescription className="text-[11px]">Identity and contact ledger</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border-border/40">
                    {DEVICE_ONLY_LABEL}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Company name</Label>
                    <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Contact email</Label>
                    <Input type="email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium text-muted-foreground">Phone</Label>
                      <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium text-muted-foreground">City/Region</Label>
                      <Input value={shopCity} onChange={(e) => setShopCity(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 xl:col-span-1">
              <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500 shadow-inner">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <CardTitle className="text-lg font-bold tracking-tight">Regional</CardTitle>
                        <CardDescription className="text-[11px]">Localization prefences</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border-border/40">
                      {DEVICE_ONLY_LABEL}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6 pt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium text-muted-foreground">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <Clock className="h-4 w-4 mr-2 text-primary" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                          <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                          <SelectItem value="America/Detroit">Detroit (ET)</SelectItem>
                          <SelectItem value="Africa/Addis_Ababa">East Africa (EAT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium text-muted-foreground">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <Globe className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                          <SelectItem value="ETB">ETB (Br) — default</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        Interface language
                      </Label>
                      <Select
                        value={uiLanguage}
                        onValueChange={(v) => setUiLanguage(v as "en" | "am" | "om")}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="am">አማርኛ (Amharic)</SelectItem>
                          <SelectItem value="om">Afaan Oromo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Ethiopian date display</p>
                        <p className="text-[11px] text-muted-foreground">
                          Show EC next to Gregorian (G.C.) in lists
                        </p>
                      </div>
                      <Switch
                        checked={showEthiopianDates}
                        onCheckedChange={setShowEthiopianDates}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Sync Status</p>
                      <p className="text-xs text-muted-foreground">
                        Settings are saved locally on this device until synced to server-backed modules.
                      </p>
                    </div>
                    <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">
                      Ready
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* User Preferences */}
        <TabsContent value="user" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-bold tracking-tight">Identity Profile</CardTitle>
                      <CardDescription className="text-[11px]">Personal access ledger</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border-border/40">
                    {DEVICE_ONLY_LABEL}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6 pt-8">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Display name</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Role</Label>
                    <Input value={role} disabled className="h-11 rounded-xl opacity-70" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500 shadow-inner">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-bold tracking-tight">Interface</CardTitle>
                      <CardDescription className="text-[11px]">Display and density prefences</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border-border/40">
                    {DEVICE_ONLY_LABEL}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Date format</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                        <SelectItem value="YYYY-MM-DD">2026-03-12</SelectItem>
                        <SelectItem value="MM/DD/YYYY">03/12/2026</SelectItem>
                        <SelectItem value="DD/MM/YYYY">12/03/2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Default job view</Label>
                    <Select value={defaultJobView} onValueChange={setDefaultJobView}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-2xl border-white/10">
                        <SelectItem value="table">Ledger Table</SelectItem>
                        <SelectItem value="kanban">Kanban Grid</SelectItem>
                        <SelectItem value="calendar">Temporal Grid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Compact density</p>
                      <p className="text-[11px] text-muted-foreground">Show denser table and list spacing.</p>
                    </div>
                    <Switch checked={compactView} onCheckedChange={setCompactView} className="data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Dark mode</p>
                      <p className="text-[11px] text-muted-foreground">Use dark theme for low-light environments.</p>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} className="data-[state=checked]:bg-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-inner">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold tracking-tight">Channels</CardTitle>
                    <CardDescription className="text-[11px]">Alert delivery hubs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Email alerts</p>
                      <p className="text-[11px] text-muted-foreground">Send important system alerts by email.</p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} className="data-[state=checked]:bg-amber-500" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">SMS alerts</p>
                      <p className="text-[11px] text-muted-foreground">Send urgent notifications to mobile.</p>
                    </div>
                    <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} className="data-[state=checked]:bg-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold tracking-tight">Operational Alerts</CardTitle>
                    <CardDescription className="text-[11px]">Module-specific criticality triggers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4 pt-6">
                <div className="space-y-4">
                  {[
                    { label: "Inventory Criticality", sub: "Low stock/reorder point alerts", checked: lowStockAlerts, setter: setLowStockAlerts },
                    { label: "Job Lifecycle Update", sub: "Real-time production stage changes", checked: jobStatusAlerts, setter: setJobStatusAlerts },
                    { label: "Throughput Latency", sub: "Production delay & risk warnings", checked: delayAlerts, setter: setDelayAlerts },
                  ].map((alert, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold">{alert.label}</p>
                        <p className="text-[11px] text-muted-foreground">{alert.sub}</p>
                      </div>
                      <Switch checked={alert.checked} onCheckedChange={alert.setter} className="data-[state=checked]:bg-primary" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold tracking-tight">Security & Backups</CardTitle>
                    <CardDescription className="text-[11px]">Local data integrity controls</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Auto backup</p>
                      <p className="text-[11px] text-muted-foreground">Create periodic local snapshots.</p>
                    </div>
                    <Switch checked={autoBackup} onCheckedChange={setAutoBackup} className="data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Export JSON</p>
                      <p className="text-[11px] text-muted-foreground">Download current configuration state.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-9 rounded-xl px-5">Export</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-bold tracking-tight">Environment</CardTitle>
                      <CardDescription className="text-[11px]">System and runtime metadata</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4 pt-6">
                  <div className="grid grid-cols-2 gap-y-3 text-xs">
                    <p className="text-muted-foreground">Core revision</p>
                    <p className="text-primary text-right font-medium">1.2.0-F_FLOW</p>
                    <p className="text-muted-foreground">Mode</p>
                    <p className="text-emerald-600 dark:text-emerald-400 text-right font-medium">Optimized production</p>
                    <p className="text-muted-foreground">Baseline sync</p>
                    <p className="text-right font-medium">March 16, 2026</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-sm overflow-hidden">
                <CardHeader className="p-6 pb-4 border-b border-rose-500/20 bg-rose-500/5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 shadow-inner">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-bold text-rose-600 dark:text-rose-400 tracking-tight">Danger Zone</CardTitle>
                      <CardDescription className="text-[11px] text-rose-700/70 dark:text-rose-300/70">Destructive actions for local data</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex items-center justify-between gap-6">
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80 max-w-[280px] leading-relaxed">
                    Clears device-only settings and restores system defaults for this browser profile.
                  </p>
                  <Button variant="destructive" size="sm" onClick={handleReset} className="h-11 rounded-xl px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20">
                    Reset local
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
            <CardHeader className="p-6 pb-4 border-b border-border/40 font-bold">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-bold tracking-tight">Access Matrix</CardTitle>
                  <CardDescription className="text-[11px]">System-wide role-based access control</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 pt-6">
              {permDoc && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Session</p>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20">
                          {permDoc.role.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{permDoc.role}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">Active authorization</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 space-y-2 overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Scopes</p>
                      <p className="font-mono text-[10px] leading-relaxed text-foreground/80 line-clamp-2">
                        {(permDoc.permissions || []).join(" · ") || "No global scopes assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Permissions Map</p>
                      <span className="text-[10px] text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">Read Only View</span>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-border/40 bg-background/40 shadow-sm">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/30">
                          <tr className="border-b border-border/40 hover:bg-transparent">
                            <th className="text-left py-4 px-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">System Role</th>
                            <th className="text-left py-4 px-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Capability Set</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {(permDoc.matrix?.roles || []).map((r) => (
                            <tr key={r.role} className="group transition-colors hover:bg-muted/30">
                              <td className="py-4 px-5 font-bold align-top whitespace-nowrap text-foreground">{r.role}</td>
                              <td className="py-4 px-5 text-muted-foreground leading-relaxed font-medium">
                                <div className="flex flex-wrap gap-1.5">
                                  {r.grants.map((grant, idx) => (
                                    <span key={idx} className="bg-secondary/20 border border-border/40 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap">
                                      {grant}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canAudit && (
          <TabsContent value="audit" className="space-y-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/40 font-bold">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                    <ListTree className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg font-bold tracking-tight">Audit Trail</CardTitle>
                    <CardDescription className="text-[11px]">Compliance-ready immutable activity log</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-6">
                <AuditLogPanel />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canFinance && (
          <TabsContent value="ethiopia-tax" className="space-y-6">
            <Card className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-md shadow-sm overflow-hidden">
              <div className="relative border-b border-border/40 bg-gradient-to-r from-amber-500/10 via-primary/8 to-emerald-500/10 px-6 py-8 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,hsl(var(--primary)/0.12),transparent)] pointer-events-none" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 shadow-inner">
                      <Scale className="h-7 w-7 text-primary" />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl">
                          Ethiopia tax profile
                        </CardTitle>
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-semibold">
                          {TENANT_WIDE_LABEL}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm leading-relaxed max-w-2xl text-muted-foreground">
                        Legal details on printed tax invoices and statutory CSV exports. Confirm rates with ERCA and
                        your accountant.
                        {!canEditEthTax && (
                          <span className="block mt-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                            View only — finance_viewer cannot edit.
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  {canEditEthTax && (
                    <Button
                      onClick={() => saveEthTax.mutate()}
                      disabled={saveEthTax.isPending || ethTaxLoading}
                      className="shrink-0 h-11 rounded-xl px-6 font-semibold shadow-md shadow-primary/20"
                    >
                      {saveEthTax.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save tax settings
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="space-y-8 p-6 sm:p-8">
                {ethTaxLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                    <p className="text-sm text-muted-foreground">Loading tax configuration…</p>
                  </div>
                ) : (
                  <>
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <Building2 className="h-4 w-4 text-primary" />
                        Legal entity & invoices
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-muted/15 p-5 sm:p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-foreground/90">Legal name</Label>
                            <Input
                              disabled={!canEditEthTax}
                              value={ethForm.companyLegalName ?? ""}
                              onChange={(e) => setEthForm((p) => ({ ...p, companyLegalName: e.target.value }))}
                              className="rounded-xl h-11 bg-background/80 border-border/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-foreground/90">Company TIN</Label>
                            <Input
                              disabled={!canEditEthTax}
                              value={ethForm.companyTIN ?? ""}
                              onChange={(e) => setEthForm((p) => ({ ...p, companyTIN: e.target.value }))}
                              className="rounded-xl h-11 font-mono bg-background/80 border-border/60"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-semibold text-foreground/90">Address</Label>
                            <Textarea
                              disabled={!canEditEthTax}
                              value={ethForm.companyAddress ?? ""}
                              onChange={(e) => setEthForm((p) => ({ ...p, companyAddress: e.target.value }))}
                              className="rounded-xl min-h-[88px] bg-background/80 border-border/60 resize-y"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-foreground/90">Phone</Label>
                            <Input
                              disabled={!canEditEthTax}
                              value={ethForm.companyPhone ?? ""}
                              onChange={(e) => setEthForm((p) => ({ ...p, companyPhone: e.target.value }))}
                              className="rounded-xl h-11 bg-background/80 border-border/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-foreground/90">Currency</Label>
                            <Input
                              disabled={!canEditEthTax}
                              value={ethForm.currency ?? "ETB"}
                              onChange={(e) => setEthForm((p) => ({ ...p, currency: e.target.value }))}
                              className="rounded-xl h-11 font-mono bg-background/80 border-border/60"
                            />
                          </div>
                        </div>
                        <Separator className="bg-border/50" />
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            <Hash className="h-4 w-4 text-primary" />
                            Sales invoice numbering
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Invoice numbers are assigned on the server when you create an invoice or invoice-from-order.
                            Next number is{" "}
                            <span className="font-mono font-semibold text-foreground">
                              {(ethForm.invoiceSeriesPrefix ?? "INV").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20) || "INV"}
                              -{String((ethForm.nextInvoiceSequence ?? 0) + 1).padStart(6, "0")}
                            </span>
                            .
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-foreground/90">Series prefix</Label>
                              <Input
                                disabled={!canEditEthTax}
                                value={ethForm.invoiceSeriesPrefix ?? "INV"}
                                onChange={(e) =>
                                  setEthForm((p) => ({ ...p, invoiceSeriesPrefix: e.target.value }))
                                }
                                placeholder="INV"
                                className="rounded-xl h-11 font-mono bg-background/80 border-border/60"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-foreground/90">
                                Sequence counter (last used)
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                disabled={!canEditEthTax}
                                value={ethForm.nextInvoiceSequence ?? 0}
                                onChange={(e) =>
                                  setEthForm((p) => ({
                                    ...p,
                                    nextInvoiceSequence: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }))
                                }
                                className="rounded-xl h-11 font-mono bg-background/80 border-border/60 tabular-nums"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Set higher only if migrating from another system (avoid duplicates).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <Percent className="h-4 w-4 text-primary" />
                        Default rates & basis
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/25 to-muted/5 p-5 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Default VAT %</Label>
                            <Input
                              type="number"
                              disabled={!canEditEthTax}
                              value={ethForm.defaultVatRatePercent ?? 15}
                              onChange={(e) =>
                                setEthForm((p) => ({ ...p, defaultVatRatePercent: parseFloat(e.target.value) || 0 }))
                              }
                              className="rounded-xl h-11 bg-background/90 tabular-nums"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Sales WHT %</Label>
                            <Input
                              type="number"
                              disabled={!canEditEthTax}
                              value={ethForm.salesWithholdingRatePercent ?? 0}
                              onChange={(e) =>
                                setEthForm((p) => ({
                                  ...p,
                                  salesWithholdingRatePercent: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="rounded-xl h-11 bg-background/90 tabular-nums"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Sales WHT base</Label>
                            <Select
                              disabled={!canEditEthTax}
                              value={ethForm.salesWhtBase ?? "taxable_excl_vat"}
                              onValueChange={(v) => setEthForm((p) => ({ ...p, salesWhtBase: v }))}
                            >
                              <SelectTrigger className="rounded-xl h-11 bg-background/90">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="taxable_excl_vat">Taxable (excl. VAT)</SelectItem>
                                <SelectItem value="total_incl_vat">Total (incl. VAT)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Purchase WHT %</Label>
                            <Input
                              type="number"
                              disabled={!canEditEthTax}
                              value={ethForm.purchaseWithholdingRatePercent ?? 0}
                              onChange={(e) =>
                                setEthForm((p) => ({
                                  ...p,
                                  purchaseWithholdingRatePercent: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="rounded-xl h-11 bg-background/90 tabular-nums"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                            <Label className="text-xs font-semibold">Sales price basis</Label>
                            <Select
                              disabled={!canEditEthTax}
                              value={ethForm.salesPriceBasis ?? "exclusive_vat"}
                              onValueChange={(v) => setEthForm((p) => ({ ...p, salesPriceBasis: v }))}
                            >
                              <SelectTrigger className="rounded-xl h-11 bg-background/90">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exclusive_vat">Exclusive of VAT</SelectItem>
                                <SelectItem value="inclusive_vat">Inclusive of VAT</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] p-5 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1.5 max-w-xl">
                          <Label className="text-xs font-bold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
                            Seller VAT-registered
                          </Label>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            When off, default output VAT is 0% unless you override on a specific invoice or mark the
                            line as VAT exempt.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                            {ethForm.sellerVatRegistered !== false ? "Charging VAT" : "Not charging VAT"}
                          </span>
                          <Switch
                            disabled={!canEditEthTax}
                            checked={ethForm.sellerVatRegistered !== false}
                            onCheckedChange={(c) => setEthForm((p) => ({ ...p, sellerVatRegistered: c }))}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <Tags className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                              WHT by category
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                              Match the <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">key</span> to
                              Finance and AP “Tax category key”. Empty rate cells use your default sales or purchase WHT
                              above.
                            </p>
                          </div>
                        </div>
                        {canEditEthTax && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl border-dashed border-primary/30 hover:bg-primary/5"
                            onClick={() =>
                              setEthForm((p) => ({
                                ...p,
                                whtCategoryRates: [
                                  ...(p.whtCategoryRates ?? []),
                                  { key: "", label: "", salesRatePercent: null, purchaseRatePercent: null },
                                ],
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Add category
                          </Button>
                        )}
                      </div>
                      <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-background/40">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-border/60 bg-muted/40 hover:bg-muted/40">
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[22%] h-11">
                                Key
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[26%]">
                                Label
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[22%]">
                                Sales WHT %
                              </TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider w-[22%]">
                                Purchase WHT %
                              </TableHead>
                              {canEditEthTax && (
                                <TableHead className="w-14 text-right text-[10px] font-bold uppercase"> </TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(ethForm.whtCategoryRates ?? []).length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell
                                  colSpan={canEditEthTax ? 5 : 4}
                                  className="text-center py-14 text-muted-foreground"
                                >
                                  <p className="text-sm font-medium">No categories yet</p>
                                  <p className="text-xs mt-1 max-w-md mx-auto">
                                    Add rows for supply types that need different withholding rates than your defaults.
                                  </p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              (ethForm.whtCategoryRates ?? []).map((row, i) => (
                                <TableRow
                                  key={i}
                                  className="group border-border/40 transition-colors hover:bg-muted/30 data-[state=selected]:bg-transparent"
                                >
                                  <TableCell className="p-3 align-middle">
                                    <Input
                                      disabled={!canEditEthTax}
                                      className="h-10 text-xs font-mono rounded-lg"
                                      value={row.key}
                                      onChange={(e) =>
                                        setEthForm((p) => {
                                          const next = [...(p.whtCategoryRates ?? [])];
                                          next[i] = { ...next[i], key: e.target.value };
                                          return { ...p, whtCategoryRates: next };
                                        })
                                      }
                                      placeholder="e.g. service"
                                    />
                                  </TableCell>
                                  <TableCell className="p-3 align-middle">
                                    <Input
                                      disabled={!canEditEthTax}
                                      className="h-10 text-xs rounded-lg"
                                      value={row.label ?? ""}
                                      onChange={(e) =>
                                        setEthForm((p) => {
                                          const next = [...(p.whtCategoryRates ?? [])];
                                          next[i] = { ...next[i], label: e.target.value };
                                          return { ...p, whtCategoryRates: next };
                                        })
                                      }
                                      placeholder="Display name"
                                    />
                                  </TableCell>
                                  <TableCell className="p-3 align-middle">
                                    <Input
                                      type="number"
                                      disabled={!canEditEthTax}
                                      className="h-10 text-xs tabular-nums rounded-lg"
                                      value={row.salesRatePercent ?? ""}
                                      onChange={(e) =>
                                        setEthForm((p) => {
                                          const next = [...(p.whtCategoryRates ?? [])];
                                          const v = e.target.value;
                                          next[i] = {
                                            ...next[i],
                                            salesRatePercent: v === "" ? null : parseFloat(v) || 0,
                                          };
                                          return { ...p, whtCategoryRates: next };
                                        })
                                      }
                                      placeholder="—"
                                    />
                                  </TableCell>
                                  <TableCell className="p-3 align-middle">
                                    <Input
                                      type="number"
                                      disabled={!canEditEthTax}
                                      className="h-10 text-xs tabular-nums rounded-lg"
                                      value={row.purchaseRatePercent ?? ""}
                                      onChange={(e) =>
                                        setEthForm((p) => {
                                          const next = [...(p.whtCategoryRates ?? [])];
                                          const v = e.target.value;
                                          next[i] = {
                                            ...next[i],
                                            purchaseRatePercent: v === "" ? null : parseFloat(v) || 0,
                                          };
                                          return { ...p, whtCategoryRates: next };
                                        })
                                      }
                                      placeholder="—"
                                    />
                                  </TableCell>
                                  {canEditEthTax && (
                                    <TableCell className="p-3 align-middle text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() =>
                                          setEthForm((p) => ({
                                            ...p,
                                            whtCategoryRates: (p.whtCategoryRates ?? []).filter((_, j) => j !== i),
                                          }))
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <Label className="text-xs font-semibold text-foreground/90">E-invoicing & reporting notes</Label>
                      <Textarea
                        disabled={!canEditEthTax}
                        value={ethForm.eInvoicingNotes ?? ""}
                        onChange={(e) => setEthForm((p) => ({ ...p, eInvoicingNotes: e.target.value }))}
                        placeholder="Internal reminders for digital reporting, EFD integration, or accountant handoff…"
                        className="rounded-2xl min-h-[100px] bg-muted/10 border-border/50 resize-y"
                      />
                    </section>

                    {canEditEthTax && (
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-border/40">
                        <p className="text-[11px] text-muted-foreground sm:mr-auto sm:self-center">
                          Changes apply to new invoices and bills; review existing documents if you change rates.
                        </p>
                        <Button
                          onClick={() => saveEthTax.mutate()}
                          disabled={saveEthTax.isPending}
                          className="h-11 rounded-xl px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                        >
                          {saveEthTax.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save tax settings
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </ModuleDashboardLayout>
  );
}
