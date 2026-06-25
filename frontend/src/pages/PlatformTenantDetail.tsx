import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  platformApi,
  rememberPlatformStepUpPassword,
  setNextPlatformStepUpPassword,
  type PlatformTenant,
  TENANT_MODULE_KEYS,
  type TenantModuleFlags,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTenantAdminDialog } from "@/components/CreateTenantAdminDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlatformStepUpDialog } from "@/components/PlatformStepUpDialog";
import {
  ModuleDashboardLayout,
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Users,
  Package,
  ShoppingCart,
  UserCircle,
  FileText,
  Truck,
  UserPlus,
  Save,
  CalendarClock,
  ExternalLink,
  Activity,
  ShieldCheck,
  Globe,
  Radio,
  Settings2,
  Database,
  Layers,
  AlertCircle,
  KeyRound,
  Copy,
  CheckCheck,
  LayoutGrid,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_OPTIONS = ["active", "trial", "suspended", "archived"] as const;

const INDUSTRY_OPTIONS = [
  "manufacturing",
  "distribution",
  "retail",
  "service",
  "other",
] as const;
const BILLING_PROVIDER_OPTIONS = ["none", "manual", "stripe", "chapa", "other"] as const;

const MODULE_LABELS: Record<(typeof TENANT_MODULE_KEYS)[number], string> = {
  manufacturing: "Manufacturing & Production",
  inventory: "Inventory & Stock",
  sales: "Sales & Orders",
  procurement: "Procurement & POs",
  finance: "Finance & AP/AR",
  hr: "HR & Payroll",
  crm: "CRM & Customers",
  pos: "Point of Sale",
  global_trade: "Global Trade & Shipping",
  analytics: "Analytics & Intelligence",
};

function mergeDefaultFlags(m?: Partial<TenantModuleFlags>): TenantModuleFlags {
  const base: TenantModuleFlags = {
    manufacturing: true,
    inventory: true,
    sales: true,
    procurement: true,
    finance: true,
    hr: true,
    crm: true,
    pos: true,
    global_trade: true,
    analytics: true,
  };
  for (const k of TENANT_MODULE_KEYS) {
    if (m && typeof m[k] === "boolean") base[k] = m[k];
  }
  return base;
}

export default function PlatformTenantDetail() {
  const { t: tr } = useLocale();
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get("user");
  const userRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const qc = useQueryClient();
  const { user, setActAsTenantId, actAsTenantId, refreshPermissions } = useAuth();

  const [adminOpen, setAdminOpen] = useState(false);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editLegalName, setEditLegalName] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editIndustry, setEditIndustry] = useState<string>("manufacturing");
  const [editBillingProvider, setEditBillingProvider] = useState<string>("none");
  const [editBillingCustomerId, setEditBillingCustomerId] = useState("");
  const [tenantAnnouncementEnabled, setTenantAnnouncementEnabled] = useState(false);
  const [tenantAnnouncementLevel, setTenantAnnouncementLevel] =
    useState<"info" | "warning" | "maintenance">("info");
  const [tenantAnnouncementMessage, setTenantAnnouncementMessage] = useState("");
  const [editModules, setEditModules] = useState<TenantModuleFlags>(() => mergeDefaultFlags());
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpTitle, setStepUpTitle] = useState("Confirm sensitive platform action");
  const [stepUpDesc, setStepUpDesc] = useState("Re-enter your password to continue.");
  const [stepUpAction, setStepUpAction] = useState<null | (() => Promise<void>)>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTargetValue, setStatusTargetValue] = useState("");
  const [statusReasonInput, setStatusReasonInput] = useState("");

  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialDaysInput, setTrialDaysInput] = useState("7");

  const [resetAdminTarget, setResetAdminTarget] = useState<{ employeeId: string; name: string; role: string } | null>(null);
  const [resetAdminConfirmOpen, setResetAdminConfirmOpen] = useState(false);
  const [resetAdminResultOpen, setResetAdminResultOpen] = useState(false);
  const [resetAdminTempPassword, setResetAdminTempPassword] = useState("");
  const [resetAdminLoading, setResetAdminLoading] = useState(false);
  const [resetAdminCopied, setResetAdminCopied] = useState(false);

  const detailQ = useQuery({
    queryKey: ["platform-tenant", tenantId],
    queryFn: () => platformApi.getTenantDetail(tenantId!),
    enabled: !!tenantId,
  });

  const patchMut = useMutation({
    mutationFn: () =>
      platformApi.patchTenant(tenantId!, {
        displayName: editDisplayName.trim(),
        legalName: editLegalName.trim(),
        plan: editPlan.trim() || "starter",
        timezone: editTimezone.trim(),
        currency: editCurrency.trim().toUpperCase(),
        industry: editIndustry,
        billingProvider: editBillingProvider as "none" | "manual" | "stripe" | "chapa" | "other",
        billingCustomerId: editBillingCustomerId.trim(),
        announcement: {
          enabled: tenantAnnouncementEnabled,
          level: tenantAnnouncementLevel,
          message: tenantAnnouncementMessage,
        },
        moduleFlags: editModules,
      }),
    onSuccess: () => {
      toast.success("Company settings saved");
      qc.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      if (actAsTenantId === tenantId || (!actAsTenantId && user?.tenantId === tenantId)) {
        refreshPermissions();
      }
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Save failed";
      toast.error(msg);
    },
  });

  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
      statusReason,
    }: {
      id: string;
      status: string;
      statusReason?: string;
    }) => platformApi.updateTenantStatus(id, status, statusReason),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Update failed";
      toast.error(msg);
    },
  });

  const trialMut = useMutation({
    mutationFn: ({ id, extendDays }: { id: string; extendDays: number }) =>
      platformApi.extendTenantTrial(id, { extendDays }),
    onSuccess: () => {
      toast.success("Trial extended");
      qc.invalidateQueries({ queryKey: ["platform-tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not extend trial";
      toast.error(msg);
    },
  });

  const loadedTenant =
    detailQ.data?.data?.tenant != null
      ? (detailQ.data.data.tenant as PlatformTenant)
      : undefined;

  useEffect(() => {
    if (!loadedTenant) return;
    setEditDisplayName(loadedTenant.displayName || "");
    setEditLegalName(loadedTenant.legalName || "");
    setEditPlan(loadedTenant.plan || "starter");
    setEditTimezone(loadedTenant.timezone || "Africa/Addis Ababa");
    setEditCurrency(loadedTenant.currency || "ETB");
    setEditIndustry(
      INDUSTRY_OPTIONS.includes(loadedTenant.industry as (typeof INDUSTRY_OPTIONS)[number])
        ? (loadedTenant.industry as string)
        : "manufacturing"
    );
    setEditBillingProvider(
      BILLING_PROVIDER_OPTIONS.includes(
        loadedTenant.billingProvider as (typeof BILLING_PROVIDER_OPTIONS)[number]
      )
        ? (loadedTenant.billingProvider as string)
        : "none"
    );
    setEditBillingCustomerId(loadedTenant.billingCustomerId || "");
    setTenantAnnouncementEnabled(!!loadedTenant.announcement?.enabled);
    setTenantAnnouncementLevel(loadedTenant.announcement?.level || "info");
    setTenantAnnouncementMessage(loadedTenant.announcement?.message || "");
    setEditModules(mergeDefaultFlags(loadedTenant.moduleFlags));
  }, [loadedTenant]);

  const auditUsersPreview = detailQ.data?.data?.users;

  useEffect(() => {
    if (!highlightUserId || !auditUsersPreview?.length) return;
    const timer = window.setTimeout(() => {
      userRowRefs.current[highlightUserId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [highlightUserId, auditUsersPreview]);

  const requestStepUp = (
    action: () => Promise<void>,
    opts?: { title?: string; description?: string }
  ) => {
    setStepUpTitle(opts?.title || "Confirm sensitive platform action");
    setStepUpDesc(opts?.description || "Re-enter your password to continue.");
    setStepUpAction(() => action);
    setStepUpOpen(true);
  };

  const handleResetAdminPassword = async () => {
    if (!resetAdminTarget || !tenantId) return;
    setResetAdminLoading(true);
    try {
      const result = await platformApi.resetAdminAccess(tenantId, resetAdminTarget.employeeId);
      setResetAdminConfirmOpen(false);
      setResetAdminTempPassword(result.temporaryPassword ?? "");
      setResetAdminCopied(false);
      setResetAdminResultOpen(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Reset failed.";
      toast.error(msg);
    } finally {
      setResetAdminLoading(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-muted-foreground">Missing tenant id.</p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link to="/platform">{tr("pages.platformTenant.back")}</Link>
        </Button>
      </div>
    );
  }

  if (detailQ.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detailQ.isError || !detailQ.data?.data) {
    const status = (detailQ.error as { response?: { status?: number } })?.response?.status;
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-sm text-destructive">
          {status === 404 ? "Company not found." : "Could not load company details."}
        </p>
        <Button asChild variant="outline">
          <Link to="/platform">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tr("pages.platformTenant.back")}
          </Link>
        </Button>
      </div>
    );
  }

  const { tenant, counts, users } = detailQ.data.data;
  const t = tenant as PlatformTenant;

  const created = t.createdAt ? new Date(t.createdAt) : null;
  const updated = t.updatedAt ? new Date(t.updatedAt) : null;

  return (
    <>
      <div className="mx-auto max-w-[1600px] pb-8">
        {/* Back navigation */}
        <Button
          variant="ghost"
          size="sm"
          className="group mb-6 -ml-1 h-9 gap-2 rounded-full text-muted-foreground hover:text-primary"
          asChild
        >
          <Link to="/platform" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-semibold">{tr("pages.platformTenant.back")}</span>
          </Link>
        </Button>

        <ModuleDashboardLayout
          title={t.displayName || t.legalName}
          description={`${t.legalName} · ${(t.plan || "starter").charAt(0).toUpperCase() + (t.plan || "starter").slice(1)} plan · ${t.industry || "manufacturing"}`}
          icon={Building2}
          healthStats={[
            { label: "Employees", value: String(counts.employees), accent: "text-blue-500" },
            { label: "Products", value: String(counts.products), accent: "text-orange-500" },
            { label: "Orders", value: String(counts.orders), accent: "text-emerald-500" },
            { label: "Clients", value: String(counts.clients), accent: "text-pink-500" },
            {
              label: "Status",
              value: (t.status || "unknown").toUpperCase(),
              accent:
                t.status === "active"
                  ? "text-emerald-500"
                  : t.status === "trial"
                  ? "text-amber-500"
                  : "text-destructive",
            },
          ]}
          actions={
            <>
              <Button
                className="h-10 gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90"
                onClick={() => {
                  setActAsTenantId(t._id);
                  toast.success("Acting as company context set");
                  navigate("/");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open as Tenant
              </Button>
              <Button
                variant="secondary"
                className="h-10 rounded-full border border-border/60 px-5 text-sm font-semibold shadow-sm"
                onClick={() => setAdminOpen(true)}
              >
                <UserPlus className="mr-1.5 h-4 w-4 text-primary" />
                Create Admin
              </Button>
            </>
          }
        >
          <Tabs defaultValue="overview" className="space-y-6">
            <StickyModuleTabs>
              <TabsList className={moduleTabsListClassName()}>
                <TabsTrigger value="overview" className={moduleTabsTriggerClassName()}>
                  <LayoutGrid className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="settings" className={moduleTabsTriggerClassName()}>
                  <Settings2 className="h-4 w-4" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="users" className={moduleTabsTriggerClassName()}>
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              </TabsList>
            </StickyModuleTabs>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="space-y-8">
              {/* Stat cards */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Employees", count: counts.employees, icon: Users, color: "blue", sub: "Total workforce" },
                  { label: "Catalog", count: counts.products, icon: Package, color: "orange", sub: "Products & items" },
                  { label: "Sales", count: counts.orders, icon: ShoppingCart, color: "emerald", sub: "Total orders" },
                  { label: "Clients", count: counts.clients, icon: UserCircle, color: "pink", sub: "Customer base" },
                  { label: "Invoices", count: counts.invoices, icon: FileText, color: "indigo", sub: "Billing records" },
                  { label: "Procurement", count: counts.purchaseOrders, icon: Truck, color: "teal", sub: "Supply chain" },
                ].map((stat, i) => (
                  <Card key={i} className="group relative overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className={`h-1 bg-${stat.color}-500/60`} />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
                      <CardTitle className={`text-xs font-bold tracking-wider text-${stat.color}-500 uppercase`}>{stat.label}</CardTitle>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-[12px] border border-${stat.color}-500/20 bg-${stat.color}-500/10 text-${stat.color}-500`}>
                        <stat.icon className="h-4 w-4 stroke-[2]" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-2">
                      <div className="text-4xl font-black tracking-tight text-foreground mb-4">{stat.count}</div>
                      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">{stat.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Activity & Status summary */}
              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-emerald-500" />
                <CardHeader className="px-8 pb-4 pt-8">
                  <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight text-foreground">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-primary/20 bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    Activity & Health
                  </CardTitle>
                  <CardDescription className="text-xs">Recent platform signals for this company.</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-5 bg-secondary/10 rounded-[14px] border border-border/30 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-emerald-500" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Activity</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground/80">
                        {t.lastApiActivityAt
                          ? formatDistanceToNow(new Date(t.lastApiActivityAt), { addSuffix: true })
                          : "Never"}
                      </p>
                    </div>
                    <div className="p-5 bg-secondary/10 rounded-[14px] border border-border/30 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status Note</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground/80 line-clamp-1">
                        {t.statusReason?.trim() ? t.statusReason : "All systems operational"}
                      </p>
                    </div>
                    <div className="p-5 bg-secondary/10 rounded-[14px] border border-border/30 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trial Expiry</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground/80">
                        {t.trialEndDate ? format(new Date(t.trialEndDate), "MMM dd, yyyy") : "Unlimited"}
                      </p>
                    </div>
                  </div>

                  {(created || updated) && (
                    <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-border/20">
                      {created && (
                        <p className="text-[11px] font-medium text-muted-foreground/50">
                          Created: <span className="font-semibold text-foreground/60">{format(created, "MMMM dd, yyyy")}</span>
                        </p>
                      )}
                      {updated && (
                        <p className="text-[11px] font-medium text-muted-foreground/50">
                          Last updated: <span className="font-semibold text-foreground/60">{format(updated, "MMMM dd, yyyy")}</span>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Settings Tab ── */}
            <TabsContent value="settings" className="space-y-8">
              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-indigo-500" />
                <CardHeader className="px-8 pb-6 pt-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-primary/20 bg-primary/10 text-primary">
                        <Settings2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <CardTitle className="text-xl font-black tracking-tight text-foreground">Company Settings</CardTitle>
                        <CardDescription className="text-xs">Manage profile, status, billing, and feature modules.</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-[10px] border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-10 px-8 pb-10">

                  {/* Status & Subscription */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Status & Subscription</h3>
                      <div className="h-px flex-1 bg-border/30" />
                    </div>

                    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                      <div className="space-y-6 flex-1 rounded-[14px] border border-border/30 bg-secondary/5 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Label className="w-36 shrink-0 text-xs font-bold text-muted-foreground">Current Status</Label>
                          <Select
                            value={t.status}
                            onValueChange={(status) => {
                              const requiresReason = status === "suspended" || status === "archived";
                              if (requiresReason) {
                                setStatusTargetValue(status);
                                setStatusReasonInput(t.statusReason || "");
                                setStatusDialogOpen(true);
                              } else {
                                requestStepUp(
                                  async () => {
                                    await statusMut.mutateAsync({ id: t._id, status, statusReason: "" });
                                  },
                                  {
                                    title: "Confirm status change",
                                    description: `Update "${t.displayName || t.key}" to ${status}.`,
                                  }
                                );
                              }
                            }}
                            disabled={statusMut.isPending}
                          >
                            <SelectTrigger className="max-w-[220px] h-10 rounded-[12px] bg-background border-border/60 font-bold uppercase tracking-wider text-[11px] px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-[12px]">
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="font-bold uppercase text-[11px] tracking-wider">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-[14px] border border-border/30 bg-background p-6 min-w-[280px] flex flex-col justify-between shadow-sm">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">Trial Window</p>
                            <CalendarClock className="h-4 w-4 text-primary/40" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-2xl font-black tracking-tight text-foreground">
                              {t.trialEndDate ? format(new Date(t.trialEndDate), "MMM dd, yyyy") : "Unlimited"}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Expiry Date</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-10 rounded-[12px] mt-5 font-bold text-xs border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                          disabled={trialMut.isPending}
                          onClick={() => {
                            setTrialDaysInput("7");
                            setTrialDialogOpen(true);
                          }}
                        >
                          Extend Trial Period
                        </Button>
                      </div>
                    </div>
                  </section>

                  {/* Base Information */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Company Information</h3>
                      <div className="h-px flex-1 bg-border/30" />
                    </div>

                    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 rounded-[14px] border border-border/30 bg-secondary/5 p-6">
                      <div className="space-y-2">
                        <Label htmlFor="disp" className="text-xs font-bold text-muted-foreground/60">Display Name</Label>
                        <Input
                          id="disp"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          disabled={patchMut.isPending}
                          className="h-10 rounded-[12px] bg-background border-border/60 font-semibold text-sm px-4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legal" className="text-xs font-bold text-muted-foreground/60">Legal Name</Label>
                        <Input
                          id="legal"
                          value={editLegalName}
                          onChange={(e) => setEditLegalName(e.target.value)}
                          disabled={patchMut.isPending}
                          className="h-10 rounded-[12px] bg-background border-border/60 font-medium text-sm px-4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plan" className="text-xs font-bold text-muted-foreground/60">Subscription Plan</Label>
                        <div className="relative">
                          <Input
                            id="plan"
                            placeholder="starter, pro, enterprise…"
                            value={editPlan}
                            onChange={(e) => setEditPlan(e.target.value)}
                            disabled={patchMut.isPending}
                            className="h-10 rounded-[12px] bg-background border-border/60 font-bold text-xs uppercase tracking-wider pl-4 pr-10"
                          />
                          <Layers className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground/60">Industry</Label>
                        <Select value={editIndustry} onValueChange={setEditIndustry} disabled={patchMut.isPending}>
                          <SelectTrigger className="h-10 rounded-[12px] bg-background border-border/60 font-bold text-[11px] uppercase tracking-wider px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[12px]">
                            {INDUSTRY_OPTIONS.map((ind) => (
                              <SelectItem key={ind} value={ind} className="font-bold uppercase text-[11px] tracking-wider">
                                {ind}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tz" className="text-xs font-bold text-muted-foreground/60">Timezone</Label>
                        <div className="relative">
                          <Input
                            id="tz"
                            placeholder="Africa/Addis Ababa"
                            value={editTimezone}
                            onChange={(e) => setEditTimezone(e.target.value)}
                            disabled={patchMut.isPending}
                            className="h-10 rounded-[12px] bg-background border-border/60 font-medium text-sm px-4 pr-10"
                          />
                          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ccy" className="text-xs font-bold text-muted-foreground/60">Currency</Label>
                        <Input
                          id="ccy"
                          placeholder="ETB"
                          maxLength={8}
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value)}
                          disabled={patchMut.isPending}
                          className="h-10 rounded-[12px] bg-background border-border/60 font-bold text-sm px-4 uppercase tracking-wider"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground/60">Billing Provider</Label>
                        <Select value={editBillingProvider} onValueChange={setEditBillingProvider} disabled={patchMut.isPending}>
                          <SelectTrigger className="h-10 rounded-[12px] bg-background border-border/60 font-bold text-[11px] uppercase tracking-wider px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[12px]">
                            {BILLING_PROVIDER_OPTIONS.map((provider) => (
                              <SelectItem key={provider} value={provider} className="font-bold uppercase text-[11px] tracking-wider">
                                {provider}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing-customer-id" className="text-xs font-bold text-muted-foreground/60">Billing Customer ID</Label>
                        <div className="relative">
                          <Input
                            id="billing-customer-id"
                            placeholder="cus_... or external ID"
                            value={editBillingCustomerId}
                            onChange={(e) => setEditBillingCustomerId(e.target.value)}
                            disabled={patchMut.isPending}
                            className="h-10 rounded-[12px] bg-background border-border/60 font-mono text-xs px-4 pr-10"
                          />
                          <Database className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Announcement & Feature Modules */}
                  <div className="grid gap-8 lg:grid-cols-2">
                    <section className="space-y-5">
                      <div className="flex items-center gap-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">System Announcement</h3>
                        <div className="h-px flex-1 bg-border/30" />
                      </div>
                      <div className="space-y-6 rounded-[14px] border border-indigo-500/20 bg-indigo-500/5 p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-[12px] bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                              <Radio className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-sm font-bold tracking-tight">Active Banner</Label>
                              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Company-specific announcement</p>
                            </div>
                          </div>
                          <Switch
                            checked={tenantAnnouncementEnabled}
                            onCheckedChange={setTenantAnnouncementEnabled}
                            disabled={patchMut.isPending}
                            className="data-[state=checked]:bg-indigo-500"
                          />
                        </div>

                        {tenantAnnouncementEnabled && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground/60">Priority Level</Label>
                              <Select
                                value={tenantAnnouncementLevel}
                                onValueChange={(val: string) =>
                                  setTenantAnnouncementLevel(val as "info" | "warning" | "maintenance")
                                }
                                disabled={patchMut.isPending}
                              >
                                <SelectTrigger className="h-10 rounded-[12px] bg-background border-border/60 font-bold text-[11px] uppercase tracking-wider px-4">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-[12px]">
                                  <SelectItem value="info" className="font-bold uppercase text-[11px] tracking-wider py-2">Info</SelectItem>
                                  <SelectItem value="warning" className="font-bold uppercase text-[11px] tracking-wider py-2 text-orange-500">Warning</SelectItem>
                                  <SelectItem value="maintenance" className="font-bold uppercase text-[11px] tracking-wider py-2 text-red-500">Maintenance</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground/60">Message</Label>
                              <Input
                                value={tenantAnnouncementMessage}
                                onChange={(e) => setTenantAnnouncementMessage(e.target.value)}
                                placeholder="Type message here..."
                                disabled={patchMut.isPending}
                                className="h-10 rounded-[12px] bg-background border-border/60 font-medium text-sm px-4"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="space-y-5">
                      <div className="flex items-center gap-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Feature Modules</h3>
                        <div className="h-px flex-1 bg-border/30" />
                      </div>
                      <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/5 p-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {TENANT_MODULE_KEYS.map((k) => (
                            <div key={k} className="flex items-center justify-between p-3.5 bg-background rounded-[12px] border border-border/50 hover:border-amber-500/30 transition-all shadow-sm">
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-bold tracking-tight text-foreground/80">{MODULE_LABELS[k]}</Label>
                                <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">{k}</p>
                              </div>
                              <Switch
                                checked={editModules[k]}
                                onCheckedChange={(checked) =>
                                  setEditModules((prev) => ({ ...prev, [k]: checked }))
                                }
                                disabled={patchMut.isPending}
                                className="data-[state=checked]:bg-amber-500 scale-90"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Save button */}
                  <div className="pt-6 border-t border-border/30 flex justify-end">
                    <Button
                      className="h-12 min-w-[200px] rounded-[12px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold text-sm hover:bg-primary/90 transition-all group"
                      disabled={
                        patchMut.isPending ||
                        !editDisplayName.trim() ||
                        !editLegalName.trim() ||
                        !editTimezone.trim() ||
                        !editCurrency.trim()
                      }
                      onClick={() =>
                        requestStepUp(
                          async () => {
                            await patchMut.mutateAsync();
                          },
                          {
                            title: "Confirm Changes",
                            description: "Authorized personnel required to save company configuration.",
                          }
                        )
                      }
                    >
                      {patchMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Users Tab ── */}
            <TabsContent value="users" className="space-y-8">
              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-indigo-500 via-primary to-sky-500" />
                <CardHeader className="px-8 pb-4 pt-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-primary/20 bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <CardTitle className="text-xl font-black tracking-tight text-foreground">
                          Team Members
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Active users in the {t.displayName || t.key} organization.
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-[10px] border border-border/60 bg-muted/25 px-3 py-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        {users.length} {users.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  {users.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center bg-secondary/10 rounded-[14px] border border-dashed border-border/40">
                      <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-semibold text-muted-foreground/40">No team members found</p>
                      <p className="text-xs text-muted-foreground/30 mt-1">Create an admin account to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[14px] border border-border/60 bg-background">
                      <Table>
                        <TableHeader className="bg-secondary/40 border-b border-border/20">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4 px-6">Name</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Employee ID</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Role</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Department</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Status</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4 text-right">Email</TableHead>
                            <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4 pr-6 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u, i) => (
                            <TableRow
                              key={u._id || `${u.employeeId}-${i}`}
                              ref={(el) => {
                                if (u._id) userRowRefs.current[String(u._id)] = el;
                              }}
                              className={`group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0 ${
                                highlightUserId && u._id && String(u._id) === highlightUserId
                                  ? "bg-primary/5 ring-1 ring-primary/20"
                                  : ""
                              }`}
                            >
                              <TableCell className="font-semibold py-4 px-6 text-foreground/80">{u.name}</TableCell>
                              <TableCell className="font-mono text-[10px] font-bold text-muted-foreground/50">{u.employeeId}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-none px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md">
                                  {u.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[11px] font-semibold text-muted-foreground">{u.department || "General"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={u.status === "active" ? "default" : "outline"}
                                  className={`font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border-none ${
                                    u.status === "active"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-muted/10 text-muted-foreground"
                                  }`}
                                >
                                  {u.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[11px] font-medium text-muted-foreground text-right">{u.email || "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reset password"
                                  className="h-8 w-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 transition-all"
                                  onClick={() => {
                                    setResetAdminTarget({ employeeId: u.employeeId, name: u.name, role: u.role });
                                    setResetAdminConfirmOpen(true);
                                  }}
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ModuleDashboardLayout>
      </div>

      <CreateTenantAdminDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
        tenantId={tenantId!}
        tenantLabel={t.displayName || t.key}
      />

      {/* Reset Password: Confirmation */}
      <Dialog open={resetAdminConfirmOpen} onOpenChange={(o) => { if (!resetAdminLoading) setResetAdminConfirmOpen(o); }}>
        <DialogContent className="rounded-2xl border border-border/60 bg-card shadow-erp sm:max-w-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500" />
          <DialogHeader className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-2">
              <KeyRound className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight">Reset Password?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              A new temporary password will be generated for{" "}
              <span className="font-bold text-foreground">{resetAdminTarget?.name}</span>{" "}
              ({resetAdminTarget?.role}). They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-3">
            <Button
              variant="ghost"
              className="h-10 rounded-[12px] px-6 font-bold text-xs"
              onClick={() => setResetAdminConfirmOpen(false)}
              disabled={resetAdminLoading}
            >
              Cancel
            </Button>
            <Button
              className="h-10 rounded-[12px] px-8 font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25"
              onClick={handleResetAdminPassword}
              disabled={resetAdminLoading}
            >
              {resetAdminLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Resetting…</> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password: Result */}
      <Dialog open={resetAdminResultOpen} onOpenChange={setResetAdminResultOpen}>
        <DialogContent className="rounded-2xl border border-border/60 bg-card shadow-erp sm:max-w-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500" />
          <DialogHeader className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-2">
              <KeyRound className="h-6 w-6 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight">Temporary Password</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Share this with{" "}
              <span className="font-bold text-foreground">{resetAdminTarget?.name}</span> securely. They must change it immediately after logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex items-center gap-2 rounded-[12px] border border-border/60 bg-muted/40 px-4 py-3">
            <span className="flex-1 font-mono text-lg font-black tracking-widest text-foreground select-all">
              {resetAdminTempPassword}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg shrink-0 hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => {
                navigator.clipboard.writeText(resetAdminTempPassword);
                setResetAdminCopied(true);
                setTimeout(() => setResetAdminCopied(false), 2000);
              }}
            >
              {resetAdminCopied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500/80 text-center">
            This password will not be shown again
          </p>
          <DialogFooter className="mt-4">
            <Button
              className="w-full h-10 rounded-[12px] font-bold text-sm"
              onClick={() => setResetAdminResultOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlatformStepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title={stepUpTitle}
        description={stepUpDesc}
        onConfirm={async (password, options) => {
          setNextPlatformStepUpPassword(password);
          if (options.rememberFor5m) {
            rememberPlatformStepUpPassword(password);
          }
          if (!stepUpAction) return;
          await stepUpAction();
        }}
      />

      {/* Status Reason Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-amber-500/10 p-8 border-b border-amber-500/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 rounded-[12px] shadow-lg">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold">Change Status</DialogTitle>
                <DialogDescription className="text-xs font-medium text-amber-900/50">A reason is required for non-active states</DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground/60">Proposed Status</Label>
              <div className="px-4 py-2.5 bg-secondary/10 rounded-[12px] border border-border/30 text-sm font-bold text-foreground/80 uppercase tracking-wider">
                {statusTargetValue}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground/60">Reason for Change</Label>
              <textarea
                className="w-full min-h-[100px] bg-secondary/5 border border-border/30 rounded-[12px] p-4 text-sm focus:ring-2 focus:ring-amber-500/20 transition-all outline-none resize-none"
                placeholder="Why is this status being changed?"
                value={statusReasonInput}
                onChange={(e) => setStatusReasonInput(e.target.value)}
              />
            </div>
          </div>
          <div className="p-8 pt-0 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStatusDialogOpen(false)} className="rounded-[12px] font-bold text-xs h-10 px-6">
              Cancel
            </Button>
            <Button
              className="rounded-[12px] font-bold text-xs h-10 px-8 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20"
              disabled={statusMut.isPending}
              onClick={() => {
                requestStepUp(
                  async () => {
                    await statusMut.mutateAsync({
                      id: t._id,
                      status: statusTargetValue,
                      statusReason: statusReasonInput,
                    });
                    setStatusDialogOpen(false);
                  },
                  {
                    title: "Confirm Status Override",
                    description: `Transition company to ${statusTargetValue}.`,
                  }
                );
              }}
            >
              Update Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trial Extension Dialog */}
      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary/10 p-8 border-b border-primary/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary rounded-[12px] shadow-lg">
                <CalendarClock className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold">Extend Trial</DialogTitle>
                <DialogDescription className="text-xs font-medium text-primary/60">Shift the trial expiration date forward</DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground/60">Days to Extend</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={trialDaysInput}
                onChange={(e) => setTrialDaysInput(e.target.value)}
                className="h-12 rounded-[12px] bg-secondary/5 border-border/30 font-bold text-xl px-4 text-center"
              />
            </div>
          </div>
          <div className="p-8 pt-0 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setTrialDialogOpen(false)} className="rounded-[12px] font-bold text-xs h-10 px-6">
              Cancel
            </Button>
            <Button
              className="rounded-[12px] font-bold text-xs h-10 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              disabled={trialMut.isPending}
              onClick={() => {
                requestStepUp(
                  async () => {
                    await trialMut.mutateAsync({
                      id: t._id,
                      extendDays: parseInt(trialDaysInput) || 7,
                    });
                    setTrialDialogOpen(false);
                  },
                  {
                    title: "Confirm Extension",
                    description: `Shift deadline window by ${trialDaysInput} days.`,
                  }
                );
              }}
            >
              Extend Trial
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}