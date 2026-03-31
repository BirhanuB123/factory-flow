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
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get("user");
  const userRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const qc = useQueryClient();
  const { setActAsTenantId } = useAuth();

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
          <Link to="/platform">Back to platform</Link>
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
            Back to platform
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
    <div className="max-w-6xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between bg-card/40 backdrop-blur-xl p-10 rounded-[2.5rem] border border-border/10 shadow-2xl shadow-black/5">
        <div className="space-y-6">
          <Button variant="ghost" size="sm" className="mb-2 -ml-3 h-10 rounded-xl text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-all group" asChild>
            <Link to="/platform" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="font-black text-[10px] uppercase tracking-[0.3em]">Infrastructure Map</span>
            </Link>
          </Button>
          <div className="flex items-center gap-5">
            <div className="p-5 bg-primary rounded-3xl shadow-2xl shadow-primary/30 rotate-[-2deg]">
              <Building2 className="h-10 w-10 text-primary-foreground stroke-[2.5]" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-4xl font-black tracking-tighter text-foreground leading-none uppercase italic">
                {t.displayName || t.legalName}
              </h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-[10px] font-black tracking-[0.2em] bg-background/50 border-border/10 px-3 py-1 shadow-sm uppercase">
                  NODE: {t.key}
                </Badge>
                <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40 italic">{t.legalName}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 shrink-0 mt-4 lg:mt-0">
          <Button
            className="h-16 px-10 rounded-[2rem] bg-foreground text-background hover:bg-foreground/90 font-black text-sm uppercase tracking-widest shadow-2xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all group"
            onClick={() => {
              setActAsTenantId(t._id);
              toast.success("Company context set for ERP API");
              navigate("/");
            }}
          >
            <ExternalLink className="h-5 w-5 mr-3 stroke-[3] group-hover:scale-110 transition-transform" />
            Impersonate Entity
          </Button>
          <Button
            variant="secondary"
            className="h-16 px-8 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-background/50 backdrop-blur-sm border border-border/10 hover:bg-background transition-all"
            onClick={() => setAdminOpen(true)}
          >
            <UserPlus className="h-5 w-5 mr-3 stroke-[2.5] text-primary" />
            Provision Admin
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
        <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-primary to-emerald-500" />
        <CardHeader className="pt-12 pb-8 px-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-4 text-3xl font-black tracking-tight uppercase italic">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                Operational DNA
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60 ml-16">
                Lifecycle parameters, resource boundaries, and regional localization.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-emerald-500/10 px-5 py-2.5 rounded-2xl border border-emerald-500/20 shadow-sm">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Integrity Verified</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-16 px-12 pb-16">
          {/* Status & Lifecycle */}
          <section className="space-y-10">
            <div className="flex items-center gap-4">
              <div className="h-px w-12 bg-primary/30" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 whitespace-nowrap italic">Status & Lifecycle</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
            </div>

            <div className="flex flex-col gap-10 lg:flex-row lg:items-stretch bg-secondary/20 p-10 rounded-[2.5rem] border border-border/10 shadow-inner">
              <div className="space-y-8 flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Label className="w-48 shrink-0 text-[11px] uppercase tracking-[0.3em] font-black text-muted-foreground/60 ml-1 italic">Current Lifecycle State</Label>
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
                            title: "Confirm company status change",
                            description: `Update "${t.displayName || t.key}" status to ${status}.`,
                          }
                        );
                      }
                    }}
                    disabled={statusMut.isPending}
                  >
                    <SelectTrigger className="max-w-[280px] h-14 rounded-2xl bg-background border-none shadow-xl font-black uppercase tracking-[0.2em] text-[10px] px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/10">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="font-black uppercase text-[10px] tracking-widest py-3">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 bg-background/50 backdrop-blur-md rounded-2xl border border-border/10 space-y-2 shadow-sm group hover:bg-background transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-3 w-3 text-emerald-500" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Heartbeat Metrics</p>
                    </div>
                    <p className="text-sm font-bold text-foreground/80 lowercase italic font-mono tracking-tight">
                      last activity: {t.lastApiActivityAt ? formatDistanceToNow(new Date(t.lastApiActivityAt), { addSuffix: true }) : "never"}
                    </p>
                  </div>
                  <div className="p-6 bg-background/50 backdrop-blur-md rounded-2xl border border-border/10 space-y-2 shadow-sm group hover:bg-background transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="h-3 w-3 text-blue-500" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Governance Narrative</p>
                    </div>
                    <p className="text-sm font-bold text-foreground/80 lowercase italic line-clamp-1">
                      {t.statusReason?.trim() ? t.statusReason : "Stable infrastructure node"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 bg-background shadow-2xl shadow-black/5 p-10 rounded-[2.5rem] border border-border/20 min-w-[320px] flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                  <CalendarClock className="h-24 w-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Trial Boundary</p>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-10">
                    <p className="text-4xl font-black tracking-tighter text-foreground">
                      {t.trialEndDate ? format(new Date(t.trialEndDate), "MMM dd, yyyy") : "UNLIMITED"}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] leading-none">Termination Deadline Vector</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full h-14 rounded-2xl bg-primary shadow-2xl shadow-primary/20 font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10"
                  disabled={trialMut.isPending}
                  onClick={() => {
                    setTrialDaysInput("7");
                    setTrialDialogOpen(true);
                  }}
                >
                  Shift Timeline Window
                </Button>
              </div>
            </div>
          </section>

          {/* Core Configuration */}
          <section className="space-y-10">
            <div className="flex items-center gap-4">
              <div className="h-px w-12 bg-blue-500/30" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 whitespace-nowrap italic">Core Infrastructure Node</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
            </div>

            <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 bg-background/30 p-10 rounded-[2.5rem] border border-border/10 shadow-inner">
              <div className="space-y-3">
                <Label htmlFor="disp" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Entity Alias</Label>
                <Input
                  id="disp"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-sm px-6 shadow-sm uppercase tracking-tight"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="legal" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Statutory Title</Label>
                <Input
                  id="legal"
                  value={editLegalName}
                  onChange={(e) => setEditLegalName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-6 shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="plan" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Provisioned Tier</Label>
                <div className="relative">
                  <Input
                    id="plan"
                    placeholder="starter, pro, enterprise…"
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-xs uppercase tracking-[0.2em] pl-6 pr-12 shadow-sm"
                  />
                  <Layers className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Industry Vertical</Label>
                <Select value={editIndustry} onValueChange={setEditIndustry} disabled={patchMut.isPending}>
                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-[10px] uppercase tracking-widest px-6 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/10">
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind} className="font-black uppercase text-[10px] tracking-widest py-3">
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="tz" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Chronological Zone</Label>
                <div className="relative">
                  <Input
                    id="tz"
                    placeholder="Africa/Addis_Ababa"
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-6 shadow-sm"
                  />
                  <Globe className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="ccy" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Monetary Token</Label>
                <Input
                  id="ccy"
                  placeholder="ETB"
                  maxLength={8}
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-sm px-6 uppercase tracking-widest shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Billing Protocol</Label>
                <Select
                  value={editBillingProvider}
                  onValueChange={setEditBillingProvider}
                  disabled={patchMut.isPending}
                >
                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-[10px] uppercase tracking-widest px-6 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/10">
                    {BILLING_PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem key={provider} value={provider} className="font-black uppercase text-[10px] tracking-widest py-3">
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="billing-customer-id" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1">Ledger Identifier</Label>
                <div className="relative">
                  <Input
                    id="billing-customer-id"
                    placeholder="cus_... or external customer id"
                    value={editBillingCustomerId}
                    onChange={(e) => setEditBillingCustomerId(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-xs px-6 shadow-sm"
                  />
                  <Database className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-primary" />
                </div>
              </div>
            </div>
          </section>

          {/* Communication & Modules */}
          <div className="grid gap-12 lg:grid-cols-2">
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px w-10 bg-indigo-500/30" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 whitespace-nowrap italic">Broadcast Node</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
              </div>

              <div className="space-y-10 rounded-[2.5rem] bg-indigo-500/5 p-10 border border-indigo-500/10 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/20">
                      <Radio className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-black tracking-tight uppercase italic">Local Banner</Label>
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Dedicated announcement stream</p>
                    </div>
                  </div>
                  <Switch
                    checked={tenantAnnouncementEnabled}
                    onCheckedChange={setTenantAnnouncementEnabled}
                    disabled={patchMut.isPending}
                    className="data-[state=checked]:bg-indigo-500 scale-110"
                  />
                </div>

                {tenantAnnouncementEnabled && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1 italic">Priority Level</Label>
                      <Select
                        value={tenantAnnouncementLevel}
                        onValueChange={(val: any) => setTenantAnnouncementLevel(val)}
                        disabled={patchMut.isPending}
                      >
                        <SelectTrigger className="h-14 rounded-2xl bg-background border-border/10 font-black text-[10px] uppercase tracking-widest px-6 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/10">
                          <SelectItem value="info" className="font-black uppercase text-[10px] tracking-widest py-3">Low / Information</SelectItem>
                          <SelectItem value="warning" className="font-black uppercase text-[10px] tracking-widest py-3 text-orange-500">Elevated / Warning</SelectItem>
                          <SelectItem value="maintenance" className="font-black uppercase text-[10px] tracking-widest py-3 text-red-500">Critical / Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/50 ml-1 italic">Payload Content</Label>
                      <Input
                        value={tenantAnnouncementMessage}
                        onChange={(e) => setTenantAnnouncementMessage(e.target.value)}
                        placeholder="Broadcast message for this entity..."
                        disabled={patchMut.isPending}
                        className="h-14 rounded-2xl bg-background border-border/10 font-bold text-sm px-6 shadow-sm italic"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px w-10 bg-amber-500/30" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 whitespace-nowrap italic">Module Architecture</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              </div>

              <div className="rounded-[2.5rem] bg-amber-500/5 p-10 border border-amber-500/10 shadow-inner">
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-10 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                    <Cpu className="h-5 w-5" />
                  </div>
                  Provision functional modules for this instance
                </CardDescription>
                <div className="grid gap-4 sm:grid-cols-2">
                  {TENANT_MODULE_KEYS.map((k) => (
                    <div key={k} className="flex items-center justify-between p-5 bg-background/50 backdrop-blur-md rounded-2xl border border-border/10 hover:bg-background transition-all group shadow-sm">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black uppercase tracking-tight italic text-foreground/80">{MODULE_LABELS[k]}</Label>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">{k} system node</p>
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

          <div className="pt-12 border-t border-border/10">
            <Button
              className="w-full h-20 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl shadow-primary/30 font-black text-sm uppercase tracking-[0.3em] hover:scale-[1.01] active:scale-[0.99] transition-all group overflow-hidden relative"
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
                    title: "Re-authenticate Governance",
                    description: "Authorization required to commit shift persistent operational DNA.",
                  }
                )
              }
            >
              {patchMut.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
              ) : (
                <Save className="h-6 w-6 mr-4 group-hover:scale-110 transition-transform stroke-[2.5]" />
              )}
              <span className="relative z-10">Commit Configuration Mutations</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {(created || updated) && (
        <div className="flex items-center justify-center gap-6 px-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/20" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 italic">
            {created && <span className="mr-4">Origin Date: {format(created, "PPp")}</span>}
            {updated && <span>Latest Sync: {format(updated, "PPp")}</span>}
          </p>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/20" />
        </div>
      )}

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Employees", count: counts.employees, icon: Users, color: "blue", sub: "Biological Units" },
          { label: "Catalog", count: counts.products, icon: Package, color: "orange", sub: "Stock Ledgers" },
          { label: "Flow Rate", count: counts.orders, icon: ShoppingCart, color: "emerald", sub: "Successive Cycles" },
          { label: "Stakeholders", count: counts.clients, icon: UserCircle, color: "pink", sub: "Network Density" },
          { label: "Settlements", count: counts.invoices, icon: FileText, color: "indigo", sub: "Financial Packets" },
          { label: "Supply Chain", count: counts.purchaseOrders, icon: Truck, color: "teal", sub: "Procurement Volume" },
        ].map((stat, i) => (
          <Card key={i} className="group relative overflow-hidden border-none bg-card/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-black/5 hover:scale-[1.02] transition-all duration-500">
            <div className={`absolute top-0 left-0 w-2 h-full bg-${stat.color}-500 opacity-20`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-10 pt-10">
              <CardTitle className={`text-[10px] font-black tracking-[0.3em] text-${stat.color}-500 uppercase italic`}>{stat.label}</CardTitle>
              <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl border border-${stat.color}-500/20 text-${stat.color}-500 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon className="h-5 w-5 stroke-[2.5]" />
              </div>
            </CardHeader>
            <CardContent className="px-10 pb-10 pt-4">
              <div className="text-5xl font-black tracking-tighter text-foreground font-mono">{stat.count}</div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mt-6 italic">{stat.sub}</p>
            </CardContent>
            <div className={`absolute -right-8 -bottom-8 opacity-[0.03] group-hover:scale-110 group-hover:-rotate-12 transition-all duration-1000`}>
              <stat.icon className="h-48 w-48 text-foreground" />
            </div>
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
                Active users within the {t.displayName || t.key} organizational node. Up to 150 biological records.
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

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none bg-background/80 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500/50 via-primary/50 to-indigo-500/50" />
          <DialogHeader className="pt-10 px-10">
            <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-5 w-5" />
              </div>
              Status Vector Shift
            </DialogTitle>
            <DialogDescription className="text-sm font-medium pt-2">
              Provide a rationale for marking <span className="font-black text-foreground italic">{t.displayName || t.key}</span> as <Badge variant="secondary" className="px-2 py-0.5 rounded-md font-black uppercase text-[9px] tracking-widest bg-primary/10 text-primary border-none inline-flex align-middle ml-1">{statusTargetValue}</Badge>.
            </DialogDescription>
          </DialogHeader>
          <div className="px-10 py-8 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="status-reason-input" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Rationale Narrative</Label>
              <Input
                id="status-reason-input"
                placeholder="e.g. Non-payment, user requested archiving..."
                value={statusReasonInput}
                onChange={(e) => setStatusReasonInput(e.target.value)}
                className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-6 italic shadow-inner"
              />
            </div>
          </div>
          <DialogFooter className="bg-secondary/20 p-8 flex gap-3 sm:justify-center">
            <Button variant="ghost" onClick={() => setStatusDialogOpen(false)} className="rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-background h-12 px-8">Abort</Button>
            <Button
              className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-primary text-primary-foreground shadow-xl shadow-primary/20 h-12 px-8 hover:scale-[1.05] transition-all"
              onClick={() => {
                setStatusDialogOpen(false);
                requestStepUp(
                  async () => {
                    await statusMut.mutateAsync({
                      id: t._id,
                      status: statusTargetValue,
                      statusReason: statusReasonInput,
                    });
                  },
                  {
                    title: "Confirm company status change",
                    description: `Setting status to ${statusTargetValue} with provided reason.`,
                  }
                );
              }}
            >
              Update Protocol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none bg-background/80 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500/50 via-amber-500/50 to-yellow-500/50" />
          <DialogHeader className="pt-10 px-10">
            <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <CalendarClock className="h-5 w-5" />
              </div>
              Timeline Expansion
            </DialogTitle>
            <DialogDescription className="text-sm font-medium pt-2">
              Extend the trial window for <span className="font-black text-foreground italic">{t.displayName || t.key}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="px-10 py-8 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="trial-days-input" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Days to Append</Label>
              <div className="relative">
                <Input
                  id="trial-days-input"
                  type="number"
                  min="1"
                  max="3650"
                  value={trialDaysInput}
                  onChange={(e) => setTrialDaysInput(e.target.value)}
                  className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-xl px-12 shadow-inner text-center"
                />
                <Zap className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-orange-500" />
              </div>
            </div>
          </div>
          <DialogFooter className="bg-secondary/20 p-8 flex gap-3 sm:justify-center">
            <Button variant="ghost" onClick={() => setTrialDialogOpen(false)} className="rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-background h-12 px-8">Abort</Button>
            <Button
              className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-orange-500 text-white shadow-xl shadow-orange-500/20 h-12 px-8 hover:scale-[1.05] transition-all border-none"
              onClick={() => {
                const days = Math.min(Math.max(parseInt(trialDaysInput, 10) || 0, 1), 3650);
                setTrialDialogOpen(false);
                requestStepUp(
                  async () => {
                    await trialMut.mutateAsync({ id: t._id, extendDays: days });
                  },
                  {
                    title: "Confirm trial extension",
                    description: `Extending trial by ${days} days.`,
                  }
                );
              }}
            >
              Extend Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
