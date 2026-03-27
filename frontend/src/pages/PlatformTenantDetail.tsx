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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between bg-gradient-to-br from-secondary/40 to-background p-8 rounded-[2.5rem] border border-border/20 shadow-xl shadow-black/5">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-9 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all" asChild>
            <Link to="/platform">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="font-bold text-[10px] uppercase tracking-[0.2em]">Infrastructure Map</span>
            </Link>
          </Button>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                <Building2 className="h-8 w-8 text-primary-foreground stroke-[2.5]" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-3xl font-black tracking-tighter text-foreground/90 leading-none">
                  {t.displayName || t.legalName}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] font-bold tracking-widest bg-background/50 border-none px-2 py-0.5 shadow-sm uppercase">
                    ID: {t.key}
                  </Badge>
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60 italic">{t.legalName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button
            className="h-12 px-6 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={() => {
              setActAsTenantId(t._id);
              toast.success("Company context set for ERP API");
              navigate("/");
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2 stroke-[2.5]" />
            Impersonate Entity
          </Button>
          <Button
            variant="secondary"
            className="h-12 px-6 rounded-2xl font-bold bg-background shadow-sm border-none hover:bg-background/90"
            onClick={() => setAdminOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2 stroke-[2.5]" />
            Provision Admin
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
        <CardHeader className="pt-10 pb-6 px-10">
          <div className="space-y-1.5 text-center sm:text-left">
            <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight uppercase italic justify-center sm:justify-start">
              <SlidersHorizontal className="h-7 w-7 text-primary" />
              Operational DNA
            </CardTitle>
            <CardDescription className="text-sm font-medium leading-relaxed max-w-2xl">
              Configure lifecycle parameters, resource boundaries, and regional localization for this tenant index.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-12 px-10 pb-12">
          {/* Status & Lifecycle */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 whitespace-nowrap">Status & Lifecycle</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between bg-secondary/20 p-6 rounded-3xl border border-border/10">
              <div className="space-y-4 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Label className="w-40 shrink-0 text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground/80">Current State</Label>
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
                    <SelectTrigger className="max-w-[240px] h-11 rounded-xl bg-background border-none shadow-sm font-bold uppercase tracking-wider text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/40">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="font-bold uppercase text-[10px] tracking-widest">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-background/40 rounded-2xl border border-border/10 space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Heartbeat Status</p>
                    <p className="text-xs font-bold text-foreground/80">
                      Last active {t.lastApiActivityAt ? formatDistanceToNow(new Date(t.lastApiActivityAt), { addSuffix: true }) : "never"}
                    </p>
                  </div>
                  <div className="p-4 bg-background/40 rounded-2xl border border-border/10 space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Governance Notes</p>
                    <p className="text-xs font-bold text-foreground/80 truncate">
                      {t.statusReason?.trim() ? t.statusReason : "Stable infrastructure"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 bg-background/60 p-6 rounded-3xl border border-border/20 shadow-xl shadow-black/5 min-w-[280px]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Trial Window</p>
                  <CalendarClock className="h-4 w-4 text-primary opacity-40" />
                </div>
                <div className="space-y-1 mb-6">
                  <p className="text-2xl font-black tracking-tight">
                    {t.trialEndDate ? format(new Date(t.trialEndDate), "MMM dd, yyyy") : "Unlimited"}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Termination Deadline</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-10 rounded-xl bg-primary shadow-lg shadow-primary/20 font-bold text-[10px] uppercase tracking-widest"
                  disabled={trialMut.isPending}
                  onClick={() => {
                    setTrialDaysInput("7");
                    setTrialDialogOpen(true);
                  }}
                >
                  Shift Timeline
                </Button>
              </div>
            </div>
          </section>

          {/* Core Configuration */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 whitespace-nowrap">Core Configuration</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="disp" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Identity Display</Label>
                <Input
                  id="disp"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold text-sm px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Statutory Title</Label>
                <Input
                  id="legal"
                  value={editLegalName}
                  onChange={(e) => setEditLegalName(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold text-sm px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Subscription Tier</Label>
                <div className="relative">
                  <Input
                    id="plan"
                    placeholder="starter, pro, enterprise…"
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    disabled={patchMut.isPending}
                    className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-black text-xs uppercase tracking-widest pl-4 pr-10"
                  />
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Industry Vertical</Label>
                <Select value={editIndustry} onValueChange={setEditIndustry} disabled={patchMut.isPending}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold text-sm px-4 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/40">
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind} className="capitalize font-medium text-sm">
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tz" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Chronological Zone</Label>
                <Input
                  id="tz"
                  placeholder="Africa/Addis_Ababa"
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-medium text-sm px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccy" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Monetary Token</Label>
                <Input
                  id="ccy"
                  placeholder="ETB"
                  maxLength={8}
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-black text-sm px-4 uppercase tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Billing Protocol</Label>
                <Select
                  value={editBillingProvider}
                  onValueChange={setEditBillingProvider}
                  disabled={patchMut.isPending}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold text-sm px-4 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/40">
                    {BILLING_PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem key={provider} value={provider} className="capitalize font-medium text-sm">
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-customer-id" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Ledger Identifier</Label>
                <Input
                  id="billing-customer-id"
                  placeholder="cus_... or external customer id"
                  value={editBillingCustomerId}
                  onChange={(e) => setEditBillingCustomerId(e.target.value)}
                  disabled={patchMut.isPending}
                  className="h-12 rounded-xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-mono text-xs px-4"
                />
              </div>
            </div>
          </section>

          {/* Communication & Toggles */}
          <section className="grid gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-8 bg-border/40" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 whitespace-nowrap">Broadcast Node</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
              </div>

              <div className="space-y-6 rounded-[2rem] bg-indigo-500/5 p-8 border border-indigo-500/10">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black tracking-tight uppercase italic italic">Local Banner</Label>
                    <p className="text-[10px] font-medium text-muted-foreground opacity-70">Dedicated announcement stream</p>
                  </div>
                  <Switch
                    checked={tenantAnnouncementEnabled}
                    onCheckedChange={setTenantAnnouncementEnabled}
                    disabled={patchMut.isPending}
                    className="data-[state=checked]:bg-indigo-500"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Urgency Vector</Label>
                    <Select
                      value={tenantAnnouncementLevel}
                      onValueChange={(v) =>
                        setTenantAnnouncementLevel(v as "info" | "warning" | "maintenance")
                      }
                      disabled={patchMut.isPending}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-background border-none shadow-sm font-bold text-xs px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        <SelectItem value="info" className="font-bold uppercase text-[9px] tracking-widest">Information</SelectItem>
                        <SelectItem value="warning" className="font-bold uppercase text-[9px] tracking-widest text-amber-600">Warning</SelectItem>
                        <SelectItem value="maintenance" className="font-bold uppercase text-[9px] tracking-widest text-indigo-600">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenant-announcement-message" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Stream Content</Label>
                    <Input
                      id="tenant-announcement-message"
                      value={tenantAnnouncementMessage}
                      onChange={(e) => setTenantAnnouncementMessage(e.target.value)}
                      placeholder="e.g. Regional maintenance cycle scheduled."
                      disabled={patchMut.isPending}
                      className="h-11 rounded-xl bg-background border-none shadow-sm font-medium text-sm px-4"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-8 bg-border/40" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 whitespace-nowrap">Neural Modules</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
              </div>

              <div className="grid gap-3">
                {TENANT_MODULE_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/10 px-5 py-3 border border-border/5 group hover:bg-secondary/20 transition-all"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black tracking-tight uppercase text-foreground/80">{MODULE_LABELS[key]}</span>
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{key} module gateway</span>
                    </div>
                    <Switch
                      checked={editModules[key]}
                      onCheckedChange={(checked) =>
                        setEditModules((prev) => ({ ...prev, [key]: checked }))
                      }
                      disabled={patchMut.isPending}
                      className="data-[state=checked]:bg-emerald-500 scale-90"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-8">
            <Button
              size="lg"
              className="px-12 h-14 rounded-2xl shadow-2xl shadow-primary/20 bg-primary text-primary-foreground font-black tracking-tight text-base hover:scale-[1.02] active:scale-[0.98] transition-all"
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
              disabled={
                patchMut.isPending ||
                !editDisplayName.trim() ||
                !editLegalName.trim() ||
                !editTimezone.trim() ||
                !editCurrency.trim()
              }
            >
              {patchMut.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
              ) : (
                <Save className="h-6 w-6 mr-3 stroke-[3]" />
              )}
              Commit Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {(created || updated) && (
        <p className="text-xs text-muted-foreground">
          {created && <>Created {format(created, "PPp")}</>}
          {created && updated && " · "}
          {updated && <>Updated {format(updated, "PPp")}</>}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-500/10 via-background to-background shadow-xl shadow-blue-500/5 group hover:shadow-blue-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Users className="h-24 w-24 text-blue-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-blue-500/70 uppercase">Employees</CardTitle>
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.employees}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Active biological units</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-500/10 via-background to-background shadow-xl shadow-orange-500/5 group hover:shadow-orange-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Package className="h-24 w-24 text-orange-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-orange-500/70 uppercase">Catalog</CardTitle>
            <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <Package className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.products}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Inventory ledger entries</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-green-500/10 via-background to-background shadow-xl shadow-green-500/5 group hover:shadow-green-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <ShoppingCart className="h-24 w-24 text-green-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-green-500/70 uppercase">Flow Rate</CardTitle>
            <div className="p-2.5 bg-green-500/10 rounded-xl border border-green-500/20">
              <ShoppingCart className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.orders}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Successive order cycle</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-pink-500/10 via-background to-background shadow-xl shadow-pink-500/5 group hover:shadow-pink-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <UserCircle className="h-24 w-24 text-pink-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-pink-500/70 uppercase">Stakeholders</CardTitle>
            <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
              <UserCircle className="h-4 w-4 text-pink-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.clients}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Customer network density</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500/10 via-background to-background shadow-xl shadow-indigo-500/5 group hover:shadow-indigo-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <FileText className="h-24 w-24 text-indigo-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-indigo-500/70 uppercase">Settlements</CardTitle>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <FileText className="h-4 w-4 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.invoices}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Financial document generation</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-teal-500/10 via-background to-background shadow-xl shadow-teal-500/5 group hover:shadow-teal-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Truck className="h-24 w-24 text-teal-500" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold tracking-[0.2em] text-teal-500/70 uppercase">Supply Chain</CardTitle>
            <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20">
              <Truck className="h-4 w-4 text-teal-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-4xl font-black tracking-tight text-foreground/90">{counts.purchaseOrders}</div>
            <p className="text-[11px] text-muted-foreground mt-4 font-semibold italic opacity-60">Procurement cycle volume</p>
          </CardContent>
        </Card>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update status reason</DialogTitle>
            <DialogDescription>
              Provide a reason for marking <strong>{t.displayName || t.key}</strong> as <strong>{statusTargetValue}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status-reason-input">Reason / Note</Label>
              <Input
                id="status-reason-input"
                placeholder="e.g. Non-payment, user requested archiving..."
                value={statusReasonInput}
                onChange={(e) => setStatusReasonInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
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
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend trial window</DialogTitle>
            <DialogDescription>
              How many days would you like to extend the trial for <strong>{t.displayName || t.key}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trial-days-input">Days to extend</Label>
              <Input
                id="trial-days-input"
                type="number"
                min="1"
                max="3650"
                value={trialDaysInput}
                onChange={(e) => setTrialDaysInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialogOpen(false)}>Cancel</Button>
            <Button
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
