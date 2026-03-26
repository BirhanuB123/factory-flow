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
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Requires <code className="text-primary">AUDIT_LOG_ENABLED=true</code> on the server for new entries.
        Total rows: {data?.total ?? 0}
      </p>
      <div className="rounded-xl border border-white/10 overflow-x-auto max-h-[480px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] uppercase">When</TableHead>
              <TableHead className="text-[10px] uppercase">Action</TableHead>
              <TableHead className="text-[10px] uppercase">Entity</TableHead>
              <TableHead className="text-[10px] uppercase">Actor</TableHead>
              <TableHead className="text-[10px] uppercase">Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.at ? new Date(row.at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.action}</TableCell>
                  <TableCell className="text-xs">
                    {row.entityType}
                    {row.entityId ? ` · ${String(row.entityId).slice(0, 12)}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.actor?.name ?? "—"} {row.actor?.role ? `(${row.actor.role})` : ""}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={row.summary}>
                    {row.summary}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
      className="max-w-[1400px]"
      title="Control Center"
      description="Manage company profile, regional preferences, notifications, and policy settings."
      icon={SettingsIcon}
      healthStats={[
        { label: "Core build", value: "1.2.0", accent: "text-primary" },
        { label: "Timezone", value: timezone.split("/").pop() ?? timezone },
        { label: "Currency", value: currency },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-border/60"
          >
            Export
          </Button>
          <Button
            onClick={handleSave}
            className="h-11 rounded-xl px-6 font-semibold text-sm gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="shop" className="space-y-6">
        <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-card via-card to-muted/20 shadow-md shadow-black/5 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/40" />
          <CardContent className="pt-5 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Where settings are stored
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 border border-border/50">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                    {DEVICE_ONLY_LABEL}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Company tab, identity, alerts, and system prefs save in this browser only.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <Badge className="text-[9px] uppercase tracking-wider">{TENANT_WIDE_LABEL}</Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Access matrix, audit log, and Ethiopia tax profile sync to the server for your company.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <StickyModuleTabs>
          <TabsList className={moduleTabsListClassName()}>
            <TabsTrigger value="shop" className={moduleTabsTriggerClassName()}>
              <Factory className="h-4 w-4 shrink-0" />
              Company
            </TabsTrigger>
            <TabsTrigger value="user" className={moduleTabsTriggerClassName()}>
              <User className="h-4 w-4 shrink-0" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="notifications" className={moduleTabsTriggerClassName()}>
              <Bell className="h-4 w-4 shrink-0" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="system" className={moduleTabsTriggerClassName()}>
              <Shield className="h-4 w-4 shrink-0" />
              System
            </TabsTrigger>
            <TabsTrigger value="access" className={moduleTabsTriggerClassName()}>
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Access (Phase 3)
            </TabsTrigger>
            {canAudit && (
              <TabsTrigger value="audit" className={moduleTabsTriggerClassName()}>
                <ListTree className="h-4 w-4 shrink-0" />
                Audit log
              </TabsTrigger>
            )}
            {canFinance && (
              <TabsTrigger value="ethiopia-tax" className={moduleTabsTriggerClassName()}>
                <Scale className="h-4 w-4 shrink-0" />
                Ethiopia tax
              </TabsTrigger>
            )}
          </TabsList>
        </StickyModuleTabs>

        {/* Shop Configuration */}
        <TabsContent value="shop" className="space-y-4">
          {tenantSubscription && user?.platformRole !== "super_admin" && (
            <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent shadow-lg shadow-primary/10">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                        <Zap className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                        Subscription status
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={subscriptionBadgeVariant(tenantSubscription.status)}
                        className="px-2.5 py-1"
                      >
                        {subscriptionStatusLabel(tenantSubscription.status)}
                      </Badge>
                      <span className="text-sm font-semibold">{tenantSubscription.displayName || shopName}</span>
                    </div>
                    {isSuspendedOrArchived && tenantSubscription.statusReason ? (
                      <p className="text-xs text-destructive inline-flex items-center gap-1.5">
                        <Ban className="h-3.5 w-3.5" />
                        {tenantSubscription.statusReason}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2 text-xs">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold uppercase tracking-wide text-foreground">
                        {tenantSubscription.plan || "starter"}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Trial ends</span>
                      <span className="font-semibold text-foreground">
                        {trialDate ? trialDate.toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {tenantSubscription.status === "active" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {tenantSubscription.status === "trial" && trialDaysLeft != null ? (
                        <span>
                          {isTrialExpired ? "Trial expired" : `${Math.max(0, trialDaysLeft)} day(s) left in trial`}
                        </span>
                      ) : tenantSubscription.status === "active" ? (
                        <span>Subscription is in good standing</span>
                      ) : (
                        <span>Review with your platform administrator</span>
                      )}
                    </div>
                    {canSelfPaySubscription ? (
                      <Button
                        onClick={handlePayWithChapa}
                        disabled={startChapaCheckout.isPending || verifyChapaCheckout.isPending}
                        className="h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                        variant="default"
                      >
                        {startChapaCheckout.isPending || verifyChapaCheckout.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Processing
                          </>
                        ) : (
                          "Pay with Chapa"
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm xl:col-span-2">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                    <Factory className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Company Profile</CardTitle>
                </div>
                <Badge className="w-fit text-[10px] uppercase tracking-wider">{DEVICE_ONLY_LABEL}</Badge>
                <CardDescription className="text-xs text-muted-foreground">
                  Local profile details used on this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
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
              <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                      <Globe className="h-4 w-4" />
                    </div>
                    <span className="text-base font-semibold">Regional Settings</span>
                  </div>
                <Badge className="w-fit text-[10px] uppercase tracking-wider">{DEVICE_ONLY_LABEL}</Badge>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
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
            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Identity Profile</CardTitle>
                </div>
                <Badge className="w-fit text-[10px] uppercase tracking-wider">{DEVICE_ONLY_LABEL}</Badge>
                <CardDescription className="text-xs text-muted-foreground">Local profile preferences on this device.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
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

            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                    <Palette className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Interface Preferences</CardTitle>
                </div>
                <Badge className="w-fit text-[10px] uppercase tracking-wider">{DEVICE_ONLY_LABEL}</Badge>
                <CardDescription className="text-xs text-muted-foreground">Display and layout behavior for this browser.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-6">
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
            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-white/10 text-amber-500">
                    <Zap className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Notification Channels</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">Choose where alerts are delivered.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
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

            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Operational Alerts</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">Enable module-specific operational warnings.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
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
            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">Data & Backup</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">Backup and export controls for local settings.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
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
              <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-base font-semibold">Environment</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
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

              <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] shadow-sm">
                <CardHeader className="p-6 pb-3">
                  <CardTitle className="text-base font-semibold text-rose-600 dark:text-rose-400">Reset local settings</CardTitle>
                  <CardDescription className="text-xs text-rose-700/80 dark:text-rose-300/80">
                    Clears device-only settings and restores defaults.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 flex items-center justify-between gap-4">
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80 max-w-[320px]">
                    This action affects only this browser profile.
                  </p>
                  <Button variant="destructive" size="sm" onClick={handleReset} className="h-10 rounded-xl px-6">
                    Reset
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Role permissions</CardTitle>
              <CardDescription className="text-xs">
                {permDoc?.matrix?.note} Seeded logins:{" "}
                <code className="text-primary">buyer@integracnc.com</code>,{" "}
                <code className="text-primary">warehouse@integracnc.com</code> (password123).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {permDoc && (
                <>
                  <div className="rounded-xl border border-border/60 p-4 text-sm">
                    <span className="text-muted-foreground">Your role:</span>{" "}
                    <span className="font-black">{permDoc.role}</span>
                    <br />
                    <span className="text-muted-foreground">Permissions:</span>{" "}
                    <span className="font-mono text-xs">{(permDoc.permissions || []).join(", ") || "—"}</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/30">
                          <th className="text-left p-3 font-semibold uppercase text-[11px]">Role</th>
                          <th className="text-left p-3 font-semibold uppercase text-[11px]">Granted actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(permDoc.matrix?.roles || []).map((r) => (
                          <tr key={r.role} className="border-b border-border/40">
                            <td className="p-3 font-bold align-top whitespace-nowrap">{r.role}</td>
                            <td className="p-3 text-muted-foreground">{r.grants.join(" · ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canAudit && (
          <TabsContent value="audit" className="space-y-6">
            <Card className="rounded-2xl border border-border/60 bg-background/80 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Audit trail</CardTitle>
                <CardDescription className="text-xs">
                  Compliance-friendly read-only log (SOX-style roles use finance_viewer + this tab).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuditLogPanel />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canFinance && (
          <TabsContent value="ethiopia-tax" className="space-y-6">
            <Card className="rounded-3xl border border-border/50 bg-card/80 shadow-lg shadow-black/[0.04] overflow-hidden backdrop-blur-sm">
              <div className="relative border-b border-border/40 bg-gradient-to-r from-amber-500/10 via-primary/8 to-emerald-500/10 px-6 py-6 sm:px-8">
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
                                  className="border-border/40 transition-colors hover:bg-muted/25 data-[state=selected]:bg-transparent"
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
                          className="h-11 rounded-xl px-8 font-semibold shadow-md shadow-primary/15"
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
