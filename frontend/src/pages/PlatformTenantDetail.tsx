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
import { Separator } from "@/components/ui/separator";
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
  Briefcase,
  Save,
  SlidersHorizontal,
  CalendarClock,
  ExternalLink,
  Activity,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  ClipboardList,
  Globe,
  Radio,
  Settings2,
  Cpu,
  Database,
  Layers,
  Zap,
  AlertCircle,
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
  manufacturing: "Manufacturing & production",
  inventory: "Inventory & stock",
  sales: "Sales & orders",
  procurement: "Procurement & POs",
  finance: "Finance & AP/AR",
  hr: "HR & payroll",
};

function mergeDefaultFlags(m?: Partial<TenantModuleFlags>): TenantModuleFlags {
  const base: TenantModuleFlags = {
    manufacturing: true,
    inventory: true,
    sales: true,
    procurement: true,
    finance: true,
    hr: true,
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

  // Status Change Dialog State
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTargetValue, setStatusTargetValue] = useState("");
  const [statusReasonInput, setStatusReasonInput] = useState("");

  // Trial Extension Dialog State
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialDaysInput, setTrialDaysInput] = useState("7");

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

      // If we are currently acting as this tenant, refresh permissions to update flags/sidebar
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
    setEditTimezone(loadedTenant.timezone || "Africa/Addis_Ababa");
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
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-24 pt-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 rounded-2xl border-0 bg-card p-6 shadow-erp sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" className="group -ml-2 mb-2 h-9 rounded-full text-muted-foreground hover:text-primary" asChild>
            <Link to="/platform" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-xs font-semibold">{tr("pages.platformTenant.back")}</span>
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary p-4 shadow-sm shadow-primary/20">
              <Building2 className="h-8 w-8 stroke-[2] text-primary-foreground" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight leading-none text-[#1a2744]">
                {t.displayName || t.legalName}
              </h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-[10px] font-bold tracking-wider bg-background border-border/10 px-2 py-0.5 shadow-sm">
                  KEY: {t.key}
                </Badge>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t.legalName}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            className="h-10 gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90"
            onClick={() => {
              setActAsTenantId(t._id);
              toast.success("Acting as company context set");
              navigate("/");
            }}
          >
            <ExternalLink className="h-4 w-4 stroke-[2]" />
            Open as tenant
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-full border border-border/60 px-5 text-sm font-semibold shadow-erp-sm"
            onClick={() => setAdminOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4 text-primary" />
            Create admin
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="px-8 pb-6 pt-10 sm:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#1a2744]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Settings2 className="h-5 w-5" />
                </div>
                Company settings
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground ml-14">
                Manage company profile, status, and subscription parameters.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/5 px-4 py-1.5 rounded-full border border-emerald-500/10">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-12 px-10 pb-12">
          {/* Status & Subscription */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status & Subscription</h3>
              <div className="h-px flex-1 bg-border/20" />
            </div>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch bg-secondary/5 p-8 rounded-2xl border border-border/5">
              <div className="space-y-8 flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Label className="w-40 shrink-0 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Current Status</Label>
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
                    <SelectTrigger className="max-w-[240px] h-12 rounded-xl bg-background border border-border/10 shadow-sm font-bold uppercase tracking-wider text-[10px] px-4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="font-bold uppercase text-[10px] tracking-wider">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-background rounded-xl border border-border/10 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-emerald-500" />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Last Activity</p>
                    </div>
                    <p className="text-sm font-medium text-foreground/80">
                      {t.lastApiActivityAt ? formatDistanceToNow(new Date(t.lastApiActivityAt), { addSuffix: true }) : "Never"}
                    </p>
                  </div>
                  <div className="p-5 bg-background rounded-xl border border-border/10 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Status Details</p>
                    </div>
                    <p className="text-sm font-medium text-foreground/80 line-clamp-1">
                      {t.statusReason?.trim() ? t.statusReason : "All systems operational"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 bg-background p-8 rounded-2xl border border-border/10 min-w-[300px] flex flex-col justify-between shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Trial Window</p>
                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/60">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {t.trialEndDate ? format(new Date(t.trialEndDate), "MMM dd, yyyy") : "Unlimited"}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Expiry Date</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl mt-6 font-bold text-[10px] uppercase tracking-wider border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
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
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Base Information</h3>
              <div className="h-px flex-1 bg-border/20" />
            </div>

            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 bg-secondary/5 p-8 rounded-2xl border border-border/5">
              <div className="space-y-2">
                <Label htmlFor="disp" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Display Name</Label>
                <Input
                  id="disp"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-background border-border/10 focus:ring-1 focus:ring-primary/20 transition-all font-bold text-sm px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Legal Name</Label>
                <Input
                  id="legal"
                  value={editLegalName}
                  onChange={(e) => setEditLegalName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-background border-border/10 focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Subscription Plan</Label>
                <div className="relative">
                  <Input
                    id="plan"
                    placeholder="starter, pro, enterprise…"
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-12 rounded-xl bg-background border-border/10 focus:ring-1 focus:ring-primary/20 transition-all font-bold text-xs uppercase tracking-wider pl-4 pr-10 shadow-none"
                  />
                  <Layers className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Industry</Label>
                <Select value={editIndustry} onValueChange={setEditIndustry} disabled={patchMut.isPending}>
                  <SelectTrigger className="h-12 rounded-xl bg-background border-border/10 font-bold text-[10px] uppercase tracking-wider px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind} className="font-bold uppercase text-[10px] tracking-wider">
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tz" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Timezone</Label>
                <div className="relative">
                  <Input
                    id="tz"
                    placeholder="Africa/Addis_Ababa"
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-12 rounded-xl bg-background border-border/10 focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm px-4"
                  />
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccy" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Currency</Label>
                <Input
                  id="ccy"
                  placeholder="ETB"
                  maxLength={8}
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-background border-border/10 focus:ring-1 focus:ring-primary/20 transition-all font-bold text-sm px-4 uppercase tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Billing Provider</Label>
                <Select
                  value={editBillingProvider}
                  onValueChange={setEditBillingProvider}
                  disabled={patchMut.isPending}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-background border-border/10 font-bold text-[10px] uppercase tracking-wider px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {BILLING_PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem key={provider} value={provider} className="font-bold uppercase text-[10px] tracking-wider">
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-customer-id" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Billing Customer ID</Label>
                <div className="relative">
                  <Input
                    id="billing-customer-id"
                    placeholder="cus_... or external ID"
                    value={editBillingCustomerId}
                    onChange={(e) => setEditBillingCustomerId(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-12 rounded-xl bg-background border-border/10 font-mono text-xs px-4"
                  />
                  <Database className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 text-primary" />
                </div>
              </div>
            </div>
          </section>

          {/* Communication & Features */}
          <div className="grid gap-8 lg:grid-cols-2">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">System Announcement</h3>
                <div className="h-px flex-1 bg-border/20" />
              </div>

              <div className="space-y-8 rounded-2xl bg-indigo-500/5 p-8 border border-indigo-500/10 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold tracking-tight">Active Banner</Label>
                      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Announcement for this company</p>
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
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Priority Level</Label>
                      <Select
                        value={tenantAnnouncementLevel}
                        onValueChange={(val: any) => setTenantAnnouncementLevel(val)}
                        disabled={patchMut.isPending}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-background border-border/10 font-bold text-[10px] uppercase tracking-wider px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="info" className="font-bold uppercase text-[10px] tracking-wider py-2">Info</SelectItem>
                          <SelectItem value="warning" className="font-bold uppercase text-[10px] tracking-wider py-2 text-orange-500">Warning</SelectItem>
                          <SelectItem value="maintenance" className="font-bold uppercase text-[10px] tracking-wider py-2 text-red-500">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 ml-1">Message Content</Label>
                      <Input
                        value={tenantAnnouncementMessage}
                        onChange={(e) => setTenantAnnouncementMessage(e.target.value)}
                        placeholder="Type message here..."
                        disabled={patchMut.isPending}
                        className="h-11 rounded-xl bg-background border-border/10 font-medium text-sm px-4 shadow-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Feature Modules</h3>
                <div className="h-px flex-1 bg-border/20" />
              </div>

              <div className="rounded-2xl bg-amber-500/5 p-8 border border-amber-500/10 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  {TENANT_MODULE_KEYS.map((k) => (
                    <div key={k} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border/10 hover:border-amber-500/30 transition-all group shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-[11px] font-bold uppercase tracking-tight text-foreground/80">{MODULE_LABELS[k]}</Label>
                        <p className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground/40">{k} module</p>
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

          <div className="pt-8 border-t border-border/5">
            <Button
              className="w-full h-16 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold text-sm uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all group overflow-hidden relative"
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
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Save className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform stroke-[2]" />
              )}
              <span className="relative z-10">Save Changes</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {(created || updated) && (
        <div className="flex items-center justify-center gap-4 px-10">
          <div className="h-px flex-1 bg-border/20" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 italic">
            {created && <span className="mr-4">Created: {format(created, "MMMM dd, yyyy")}</span>}
            {updated && <span>Last Updated: {format(updated, "MMMM dd, yyyy")}</span>}
          </p>
          <div className="h-px flex-1 bg-border/20" />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Employees", count: counts.employees, icon: Users, color: "blue", sub: "Total workforce" },
          { label: "Catalog", count: counts.products, icon: Package, color: "orange", sub: "Products & items" },
          { label: "Sales", count: counts.orders, icon: ShoppingCart, color: "emerald", sub: "Total orders" },
          { label: "Clients", count: counts.clients, icon: UserCircle, color: "pink", sub: "Customer base" },
          { label: "Invoices", count: counts.invoices, icon: FileText, color: "indigo", sub: "Billing records" },
          { label: "Procurement", count: counts.purchaseOrders, icon: Truck, color: "teal", sub: "Supply chain" },
        ].map((stat, i) => (
          <Card key={i} className="group relative overflow-hidden border-none bg-card shadow-lg rounded-2xl hover:translate-y-[-2px] transition-all duration-300">
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500/40`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-8 pt-8">
              <CardTitle className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{stat.label}</CardTitle>
              <div className={`p-3 bg-${stat.color}-500/10 rounded-xl text-${stat.color}-500 border border-${stat.color}-500/10`}>
                <stat.icon className="h-4 w-4 stroke-[2]" />
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-2">
              <div className="text-4xl font-bold tracking-tight text-foreground">{stat.count}</div>
              <p className="text-[10px] font-medium text-muted-foreground/50 mt-4 uppercase tracking-wider">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
        <CardHeader className="pt-10 pb-6 px-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight uppercase italic">
                <Briefcase className="h-7 w-7 text-primary" />
                Staff Registry
              </CardTitle>
              <CardDescription className="text-sm font-medium leading-relaxed">
                Active users within the {t.displayName || t.key} organizational node.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-10 pb-10">
          {users.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center bg-secondary/20 rounded-3xl border border-dashed border-border/40">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">No personnel records detected</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-border/20 overflow-hidden shadow-inner bg-background/20">
              <Table>
                <TableHeader className="bg-secondary/40 border-b border-border/20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Personnel Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">System ID</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Permission Set</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Department</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Operational State</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6 text-right">Electronic Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow
                      key={u._id || `${u.employeeId}-${i}`}
                      ref={(el) => {
                        if (u._id) userRowRefs.current[String(u._id)] = el;
                      }}
                      className={`group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0 ${highlightUserId && u._id && String(u._id) === highlightUserId
                        ? "bg-primary/5 ring-1 ring-primary/20"
                        : ""
                        }`}
                    >
                      <TableCell className="font-bold py-5 px-6 text-foreground/80">{u.name}</TableCell>
                      <TableCell className="font-mono text-[10px] font-bold opacity-40">{u.employeeId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-none px-2 py-0.5 font-black text-[9px] uppercase tracking-widest rounded-md">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{u.department || "General"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === 'active' ? 'default' : 'outline'}
                          className={`font-black uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-md border-none ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/10 text-muted-foreground'
                            }`}
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold text-muted-foreground text-right px-6">{u.email || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTenantAdminDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
        tenantId={tenantId!}
        tenantLabel={t.displayName || t.key}
      />

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
              <div className="p-3 bg-amber-500 rounded-xl shadow-lg">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold">Change Status</DialogTitle>
                <DialogDescription className="text-xs font-medium text-amber-900/50">Reason required for non-active states</DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">Proposed Status</Label>
              <div className="px-4 py-3 bg-secondary/10 rounded-xl border border-border/10 text-sm font-bold text-foreground/80 uppercase tracking-wider">
                {statusTargetValue}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">Reason for Status Change</Label>
              <textarea
                className="w-full min-h-[120px] bg-secondary/5 border border-border/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500/20 transition-all outline-none resize-none"
                placeholder="Why is this status being changed?"
                value={statusReasonInput}
                onChange={(e) => setStatusReasonInput(e.target.value)}
              />
            </div>
          </div>
          <div className="p-8 pt-0 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStatusDialogOpen(false)} className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-6">
              Cancel
            </Button>
            <Button
              className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-8 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20"
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
              <div className="p-3 bg-primary rounded-xl shadow-lg">
                <CalendarClock className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold">Extend Trial</DialogTitle>
                <DialogDescription className="text-xs font-medium text-primary/60">Shift the trial expiration date</DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">Days to Extend</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={trialDaysInput}
                onChange={(e) => setTrialDaysInput(e.target.value)}
                className="h-12 rounded-xl bg-secondary/5 border-border/10 focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg px-4"
              />
            </div>
          </div>
          <div className="p-8 pt-0 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setTrialDialogOpen(false)} className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-6">
              Cancel
            </Button>
            <Button
              className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
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
    </div>
  );
}
