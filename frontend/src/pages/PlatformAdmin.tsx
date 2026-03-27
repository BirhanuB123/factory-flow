import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CreateTenantAdminDialog } from "@/components/CreateTenantAdminDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  platformApi,
  rememberPlatformStepUpPassword,
  setNextPlatformStepUpPassword,
  type PlatformTenant,
} from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { PlatformStepUpDialog } from "@/components/PlatformStepUpDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  ModuleDashboardLayout,
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import {
  Building2,
  Loader2,
  Plus,
  Users,
  Package,
  ShoppingCart,
  FileText,
  UserPlus,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CalendarClock,
  ShieldCheck,
  Activity,
  ClipboardList,
  Search,
  ArrowRightCircle,
  ArrowRight,
  Timer,
  CloudCog,
  LayoutGrid,
  Trash2,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_OPTIONS = ["active", "trial", "suspended", "archived"] as const;

const PLATFORM_AUDIT_ACTION_PRESETS = [
  "tenant.create",
  "tenant.patch",
  "tenant.status",
  "tenant.admin.create",
] as const;

function isMongoObjectId(v: string | undefined | null): boolean {
  return !!v && /^[a-f\d]{24}$/i.test(v);
}

function formatRelativeOrDash(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

function formatDateOrDash(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "yyyy-MM-dd");
}

function statusBadgeVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "suspended") return "destructive";
  if (status === "archived") return "outline";
  return "outline";
}

/** Deep links when audit row has tenant / employee context. */
function platformAuditLinks(row: {
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}): { tenantPath?: string; userPath?: string } {
  const details = row.details || {};
  const tenantFromDetails =
    typeof details.tenantId === "string" && isMongoObjectId(details.tenantId)
      ? details.tenantId
      : undefined;

  if (row.resourceType === "Tenant" && row.resourceId && isMongoObjectId(row.resourceId)) {
    return { tenantPath: `/platform/tenants/${row.resourceId}` };
  }
  if (row.resourceType === "Employee" && row.resourceId && tenantFromDetails) {
    return {
      tenantPath: `/platform/tenants/${tenantFromDetails}`,
      userPath: `/platform/tenants/${tenantFromDetails}?user=${encodeURIComponent(row.resourceId)}`,
    };
  }
  if (tenantFromDetails) {
    return { tenantPath: `/platform/tenants/${tenantFromDetails}` };
  }
  return {};
}

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setActAsTenantId } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [adminTenant, setAdminTenant] = useState<PlatformTenant | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newLegal, setNewLegal] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newStatus, setNewStatus] = useState<string>("trial");
  const [tenantSearchInput, setTenantSearchInput] = useState(
    () => searchParams.get("tenantSearch")?.trim() || ""
  );
  const [tenantSearchQuery, setTenantSearchQuery] = useState(
    () => searchParams.get("tenantSearch")?.trim() || ""
  );
  const [globalAnnouncementEnabled, setGlobalAnnouncementEnabled] = useState(false);
  const [globalAnnouncementLevel, setGlobalAnnouncementLevel] =
    useState<"info" | "warning" | "maintenance">("info");
  const [globalAnnouncementMessage, setGlobalAnnouncementMessage] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpTitle, setStepUpTitle] = useState("Confirm sensitive platform action");
  const [stepUpDesc, setStepUpDesc] = useState("Re-enter your password to continue.");
  const [stepUpAction, setStepUpAction] = useState<null | (() => Promise<void>)>(null);

  const [auditAction, setAuditAction] = useState<string>("all");
  const [auditDateFrom, setAuditDateFrom] = useState<string>("");
  const [auditDateTo, setAuditDateTo] = useState<string>("");
  const [auditPage, setAuditPage] = useState(0);
  const [auditExporting, setAuditExporting] = useState(false);
  const auditPageSize = 50;

  // Status Change Dialog State
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTargetTenant, setStatusTargetTenant] = useState<PlatformTenant | null>(null);
  const [statusTargetValue, setStatusTargetValue] = useState("");
  const [statusReasonInput, setStatusReasonInput] = useState("");

  // Trial Extension Dialog State
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialTargetTenant, setTrialTargetTenant] = useState<PlatformTenant | null>(null);
  const [trialDaysInput, setTrialDaysInput] = useState("7");

  const metricsQ = useQuery({
    queryKey: ["platform-metrics"],
    queryFn: () => platformApi.getMetrics(),
  });

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () => platformApi.listTenants(),
  });
  const globalAnnouncementQ = useQuery({
    queryKey: ["platform-global-announcement"],
    queryFn: () => platformApi.getGlobalAnnouncement(),
  });

  // Debounce free-typing search to avoid firing API on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = tenantSearchInput.trim();
      if (next !== tenantSearchQuery) setTenantSearchQuery(next);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [tenantSearchInput, tenantSearchQuery]);

  // Keep URL in sync for shareable/bookmarkable search.
  useEffect(() => {
    const current = searchParams.get("tenantSearch")?.trim() || "";
    if (current === tenantSearchQuery) return;
    const nextParams = new URLSearchParams(searchParams);
    if (tenantSearchQuery) nextParams.set("tenantSearch", tenantSearchQuery);
    else nextParams.delete("tenantSearch");
    setSearchParams(nextParams, { replace: true });
  }, [tenantSearchQuery, searchParams, setSearchParams]);

  // Handle browser navigation changes (back/forward) for tenant search.
  useEffect(() => {
    const fromUrl = searchParams.get("tenantSearch")?.trim() || "";
    setTenantSearchInput((prev) => (prev === fromUrl ? prev : fromUrl));
    setTenantSearchQuery((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    setAuditPage(0);
  }, [auditAction, auditDateFrom, auditDateTo]);

  const auditQ = useQuery({
    queryKey: ["platform-audit", auditAction, auditDateFrom, auditDateTo, auditPage],
    queryFn: () =>
      platformApi.listPlatformAuditLogs({
        limit: auditPageSize,
        skip: auditPage * auditPageSize,
        action: auditAction === "all" ? undefined : auditAction,
        dateFrom: auditDateFrom || undefined,
        dateTo: auditDateTo || undefined,
      }),
  });

  const auditActionOptions = Array.from(
    new Set([...PLATFORM_AUDIT_ACTION_PRESETS, ...(auditQ.data?.actions ?? [])])
  ).sort();

  const auditTotal = auditQ.data?.total ?? 0;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditPageSize) || 1);

  const handleAuditExportCsv = async () => {
    setAuditExporting(true);
    try {
      const blob = await platformApi.exportPlatformAuditLogsCsv({
        action: auditAction === "all" ? undefined : auditAction,
        dateFrom: auditDateFrom || undefined,
        dateTo: auditDateTo || undefined,
        maxRows: 5000,
      });
      if (blob.type && blob.type.includes("application/json")) {
        const text = await blob.text();
        try {
          const j = JSON.parse(text) as { message?: string };
          toast.error(j.message || "Export failed");
        } catch {
          toast.error("Export failed");
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `platform-audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not export CSV";
      toast.error(msg);
    } finally {
      setAuditExporting(false);
    }
  };

  const createMut = useMutation({
    mutationFn: () =>
      platformApi.createTenant({
        key: newKey,
        legalName: newLegal,
        displayName: newDisplay || newLegal,
        status: newStatus,
      }),
    onSuccess: () => {
      toast.success("Company created");
      setCreateOpen(false);
      setNewKey("");
      setNewLegal("");
      setNewDisplay("");
      setNewStatus("trial");
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not create company";
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
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Update failed";
      toast.error(msg);
    },
  });

  const trialMut = useMutation({
    mutationFn: ({
      tenantId,
      extendDays,
    }: {
      tenantId: string;
      extendDays: number;
    }) => platformApi.extendTenantTrial(tenantId, { extendDays }),
    onSuccess: () => {
      toast.success("Trial extended");
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
  const globalAnnouncementMut = useMutation({
    mutationFn: () =>
      platformApi.updateGlobalAnnouncement({
        enabled: globalAnnouncementEnabled,
        level: globalAnnouncementLevel,
        message: globalAnnouncementMessage,
      }),
    onSuccess: () => {
      toast.success("Global announcement updated");
      qc.invalidateQueries({ queryKey: ["platform-global-announcement"] });
      qc.invalidateQueries({ queryKey: ["announcement-current"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: unknown) => {
      const respData = (e as { response?: { data?: unknown } })?.response?.data;
      const msg =
        (respData &&
          typeof respData === "object" &&
          "message" in respData &&
          typeof (respData as { message?: unknown }).message === "string"
          ? (respData as { message: string }).message
          : undefined) ||
        (typeof respData === "string" ? respData : undefined) ||
        (e as { message?: string })?.message ||
        "Could not update announcement";
      toast.error(msg);
    },
  });

  const metrics = metricsQ.data?.data;
  const tenants = tenantsQ.data?.data ?? [];
  const filteredTenants = useMemo(() => {
    const q = tenantSearchQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) => {
      const key = String(tenant.key || "").toLowerCase();
      const legalName = String(tenant.legalName || "").toLowerCase();
      const displayName = String(tenant.displayName || "").toLowerCase();
      return key.includes(q) || legalName.includes(q) || displayName.includes(q);
    });
  }, [tenants, tenantSearchQuery]);

  const requestStepUp = (
    action: () => Promise<void>,
    opts?: { title?: string; description?: string }
  ) => {
    setStepUpTitle(opts?.title || "Confirm sensitive platform action");
    setStepUpDesc(opts?.description || "Re-enter your password to continue.");
    setStepUpAction(() => action);
    setStepUpOpen(true);
  };

  useEffect(() => {
    const g = globalAnnouncementQ.data?.data;
    if (!g) return;
    setGlobalAnnouncementEnabled(!!g.enabled);
    setGlobalAnnouncementLevel(g.level || "info");
    setGlobalAnnouncementMessage(g.message || "");
  }, [globalAnnouncementQ.data]);

  return (
    <>
      <ModuleDashboardLayout
        className="max-w-[1600px] mx-auto"
        title="PLATFORM ADMINISTRATION"
        description="CENTRAL GOVERNANCE: MANAGE TENANT LIFECYCLE, AUTHORIZATION DOMAINS, AND GLOBAL INFRASTRUCTURE"
        icon={Building2}
        healthStats={[
          { label: "INSTANCES", value: String(metrics?.tenants.total ?? 0), accent: "text-blue-500" },
          { label: "BIOLOGICALS", value: String(metrics?.employees ?? 0), accent: "text-indigo-500" },
          { label: "LOG_STREAM", value: String(auditTotal), accent: "text-emerald-500" },
        ]}
      >
        <Tabs defaultValue="overview" className="space-y-8">
          <StickyModuleTabs>
            <TabsList className={moduleTabsListClassName()}>
              <TabsTrigger value="overview" className={moduleTabsTriggerClassName()}>
                <Activity className="h-4 w-4" />
                DASHBOARD
              </TabsTrigger>
              <TabsTrigger value="tenants" className={moduleTabsTriggerClassName()}>
                <Building2 className="h-4 w-4" />
                REGISTRY
              </TabsTrigger>
              <TabsTrigger value="audit" className={moduleTabsTriggerClassName()}>
                <ClipboardList className="h-4 w-4" />
                AUDIT LOG
              </TabsTrigger>
            </TabsList>
          </StickyModuleTabs>

          <TabsContent value="overview" className="space-y-10">
            {metricsQ.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Metrics...</p>
              </div>
            ) : metricsQ.isError ? (
              <div className="p-8 rounded-3xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
                <p className="font-black uppercase tracking-widest text-sm italic">Telemetry Error: Could not synchronize metrics.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden group relative transition-all hover:translate-y-[-4px]">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Building2 className="h-32 w-32 text-blue-500" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-8 pt-8">
                      <CardTitle className="text-[10px] font-black tracking-[0.3em] text-blue-500 italic uppercase">Operational Units</CardTitle>
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                        <Building2 className="h-5 w-5" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 pt-4">
                      <div className="text-5xl font-black tracking-tighter text-foreground mb-6">{metrics?.tenants.total ?? 0}</div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {Object.entries(metrics?.tenants.byStatus ?? {}).map(([k, v]) => (
                          <Badge
                            key={k}
                            variant={statusBadgeVariant(k)}
                            className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border-none shadow-sm bg-muted/20"
                          >
                            {k}: {v}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden group relative transition-all hover:translate-y-[-4px]">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Users className="h-32 w-32 text-indigo-500" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-8 pt-8">
                      <CardTitle className="text-[10px] font-black tracking-[0.3em] text-indigo-500 italic uppercase">Global Population</CardTitle>
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                        <Users className="h-5 w-5" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 pt-4">
                      <div className="text-5xl font-black tracking-tighter text-foreground mb-6">{metrics?.employees ?? 0}</div>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Synchronized across all units
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden group relative transition-all hover:translate-y-[-4px]">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Activity className="h-32 w-32 text-emerald-500" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-8 pt-8">
                      <CardTitle className="text-[10px] font-black tracking-[0.3em] text-emerald-500 italic uppercase">Infrastructure Node</CardTitle>
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                        <Activity className="h-5 w-5" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 pt-4">
                      <div className="text-4xl font-black tracking-tighter text-foreground mb-6 uppercase italic">Node-01</div>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Global Production Layer</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden">
                  <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-primary to-emerald-500" />
                  <CardHeader className="p-10 pb-6">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                          <Activity className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-black tracking-tight uppercase italic">Global Protocol Broadcast</CardTitle>
                          <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60 italic">System-wide dissemination</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 px-6 py-3 bg-secondary/30 rounded-2xl border border-border/10 backdrop-blur-sm">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 cursor-pointer">
                          {globalAnnouncementEnabled ? "TRANSMITTING" : "STANDBY"}
                        </Label>
                        <Switch
                          checked={globalAnnouncementEnabled}
                          onCheckedChange={setGlobalAnnouncementEnabled}
                          disabled={globalAnnouncementMut.isPending || globalAnnouncementQ.isLoading}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-10 pt-0 space-y-8">
                    <div className="grid gap-8 sm:grid-cols-4 items-end">
                      <div className="sm:col-span-1 space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Priority Vector</Label>
                        <Select
                          value={globalAnnouncementLevel}
                          onValueChange={(v) =>
                            setGlobalAnnouncementLevel(v as "info" | "warning" | "maintenance")
                          }
                          disabled={globalAnnouncementMut.isPending}
                        >
                          <SelectTrigger className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-black text-xs uppercase tracking-widest px-5 shadow-none focus:bg-background transition-all">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-border/10">
                            <SelectItem value="info" className="font-bold uppercase text-[10px] tracking-widest">Normal</SelectItem>
                            <SelectItem value="warning" className="font-bold uppercase text-[10px] tracking-widest text-amber-500">Advisory</SelectItem>
                            <SelectItem value="maintenance" className="font-bold uppercase text-[10px] tracking-widest text-primary">Emergency</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3 space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Protocol Content</Label>
                        <Input
                          id="global-announcement-message"
                          value={globalAnnouncementMessage}
                          onChange={(e) => setGlobalAnnouncementMessage(e.target.value)}
                          placeholder="Identify system-wide maintenance windows or critical alerts..."
                          className="h-12 rounded-2xl bg-secondary/20 border-border/10 font-bold text-sm px-5 focus:bg-background transition-all"
                          disabled={globalAnnouncementMut.isPending}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button
                        size="lg"
                        className="px-12 h-14 rounded-2xl shadow-2xl shadow-primary/20 bg-primary text-primary-foreground font-black tracking-tight text-sm uppercase hover:scale-[1.02] active:scale-[0.98] transition-all"
                        onClick={() =>
                          requestStepUp(
                            async () => {
                              await globalAnnouncementMut.mutateAsync();
                            },
                            {
                              title: "Authorize Global Broadcast",
                              description: "This will inject the specified protocol message into 100% of network nodes.",
                            }
                          )
                        }
                        disabled={globalAnnouncementMut.isPending}
                      >
                        {globalAnnouncementMut.isPending ? (
                          <Loader2 className="h-6 w-6 animate-spin mr-3" />
                        ) : (
                          <ArrowRightCircle className="h-6 w-6 mr-3 stroke-[2.5]" />
                        )}
                        Commit Broadcast
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="tenants" className="space-y-10">
            <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-10">
                <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-2 w-12 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                      <div className="space-y-1">
                        <h2 className="text-sm font-black uppercase tracking-[0.4em] text-foreground italic">Registry Nexus</h2>
                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Global Instance Indexing</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative group max-w-2xl flex-1">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                        </div>
                        <Input
                          placeholder="IDENTIFY TENANT BY KEY OR STATUTORY NOMENCLATURE..."
                          className="h-14 pl-14 pr-14 rounded-2xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold tracking-tight text-sm uppercase placeholder:text-muted-foreground/30"
                          value={tenantSearchInput}
                          onChange={(e) => setTenantSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setTenantSearchQuery(tenantSearchInput.trim());
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          className="h-14 px-10 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          onClick={() => setTenantSearchQuery(tenantSearchInput.trim())}
                        >
                          Execute Search
                        </Button>
                        {(tenantSearchQuery || tenantSearchInput) && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-14 w-14 rounded-2xl flex items-center justify-center p-0 bg-background/40 border-border/10 hover:bg-background transition-all group"
                            onClick={() => {
                              setTenantSearchInput("");
                              setTenantSearchQuery("");
                            }}
                          >
                            <Loader2 className="h-5 w-5 opacity-40 rotate-45 group-hover:opacity-100 transition-opacity" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                      <DialogTrigger asChild>
                        <Button className="h-20 px-12 rounded-[2rem] bg-foreground text-background hover:bg-foreground/90 font-black text-lg shadow-[0_30px_60px_rgba(0,0,0,0.15)] active:scale-95 hover:scale-[1.02] transition-all group">
                          <div className="h-10 w-10 rounded-xl bg-background/10 flex items-center justify-center mr-4 group-hover:bg-background/20 transition-colors">
                            <Plus className="h-6 w-6 stroke-[3]" />
                          </div>
                          Onboard Instance
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl rounded-[3rem] border-none shadow-2xl bg-card/90 backdrop-blur-3xl px-12 pt-14 pb-12 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-primary to-emerald-500" />
                        <DialogHeader className="space-y-4 text-center sm:text-left relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                              <LayoutGrid className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                              <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">Initialize Index</DialogTitle>
                              <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Provision STATUTORY entity profiles</DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="grid gap-8 py-10 relative z-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Domain Key (Slug)</Label>
                              <Input
                                placeholder="ACME-GLOBAL"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                className="h-12 rounded-2xl bg-secondary/30 border-border/10 font-black text-sm px-5 focus:bg-background transition-all uppercase tracking-widest placeholder:opacity-20"
                              />
                            </div>
                            <div className="space-y-3">
                              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Provisioning State</Label>
                              <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="h-12 rounded-2xl bg-secondary/30 border-border/10 font-black text-[11px] uppercase tracking-widest px-5 shadow-none focus:bg-background transition-all">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/10">
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s} className="font-bold uppercase text-[10px] tracking-widest">
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Statutory Identity</Label>
                            <Input
                              placeholder="ACME GLOBAL MANUFACTURING LTD."
                              value={newLegal}
                              onChange={(e) => setNewLegal(e.target.value)}
                              className="h-12 rounded-2xl bg-secondary/30 border-border/10 font-bold text-sm px-5 focus:bg-background transition-all uppercase placeholder:opacity-20"
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Public Alias</Label>
                            <Input
                              placeholder="ACME HUB"
                              value={newDisplay}
                              onChange={(e) => setNewDisplay(e.target.value)}
                              className="h-12 rounded-2xl bg-secondary/30 border-border/10 font-bold text-sm px-5 focus:bg-background transition-all uppercase placeholder:opacity-20"
                            />
                          </div>
                        </div>
                        <DialogFooter className="pt-6 relative z-10">
                          <div className="flex flex-col sm:flex-row gap-4 w-full">
                            <Button variant="secondary" className="h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest flex-1 bg-background/50 border-none hover:bg-background transition-all" onClick={() => setCreateOpen(false)}>
                              Abort Session
                            </Button>
                            <Button
                              className="h-14 rounded-2xl bg-primary shadow-2xl shadow-primary/30 font-black uppercase text-[11px] tracking-widest flex-1 hover:scale-[1.02] active:scale-95 transition-all"
                              disabled={createMut.isPending || !newKey.trim() || !newLegal.trim()}
                              onClick={() =>
                                requestStepUp(
                                  async () => {
                                    await createMut.mutateAsync();
                                  },
                                  {
                                    title: "Authorize Entity Provisioning",
                                    description: "Level-1 credentials required to commit new indices to global registry.",
                                  }
                                )
                              }
                            >
                              {createMut.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Authorize Deployment"}
                            </Button>
                          </div>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            {tenantsQ.isLoading ? (
              <div className="flex flex-col items-center justify-center py-48 bg-secondary/5 rounded-[2.5rem] border border-dashed border-border/20">
                <Loader2 className="h-12 w-12 animate-spin text-primary/40 mb-4" />
                <p className="font-black text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40">Synchronizing registry state...</p>
              </div>
            ) : (
              <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
                <CardHeader className="pt-10 pb-6 px-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1.5">
                      <CardTitle className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-3">
                        <LayoutGrid className="h-7 w-7 text-primary" />
                        Tenant Ledger
                      </CardTitle>
                      <CardDescription className="text-sm font-medium leading-relaxed max-w-2xl">
                        Real-time inventory of global nodes, operational health metrics, and administrative status.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 bg-secondary/40 px-4 py-2 rounded-2xl border border-border/10">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{filteredTenants.length} Nodes Active</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 px-10 pb-10">
                  <div className="rounded-[2rem] border border-border/10 overflow-hidden bg-background/20 shadow-inner">
                    <Table>
                      <TableHeader className="bg-secondary/40 border-b border-border/20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Domain Identifier</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Statutory Nomenclature</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Operational State</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Governance Status</TableHead>
                          <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Metadata & Registry</TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Controls</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-48 text-center">
                              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/30 italic">No nodes matching specified parameters</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTenants.map((t) => (
                            <TableRow key={t._id} className="group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0">
                              <TableCell className="py-6 px-6">
                                <Link
                                  to={`/platform/tenants/${t._id}`}
                                  className="group/link inline-flex items-center gap-4"
                                >
                                  <div className="h-11 w-11 rounded-2xl bg-secondary/40 flex items-center justify-center font-black text-xs group-hover/link:bg-primary group-hover/link:text-primary-foreground transition-all shadow-sm">
                                    {t.key.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-tight text-foreground/80 group-hover/link:text-primary transition-colors underline-offset-4 decoration-2 decoration-primary/20 hover:underline">{t.key}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">UID: {t._id.substring(t._id.length - 8)}</span>
                                  </div>
                                </Link>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm text-foreground/80 line-clamp-1">{t.displayName || t.legalName}</span>
                                  <span className="text-[10px] font-medium text-muted-foreground italic opacity-60 line-clamp-1 max-w-[180px]">{t.legalName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={t.status}
                                  onValueChange={(status) => {
                                    const requiresReason = status === "Suspend" || status === "Archived";
                                    if (requiresReason) {
                                      setStatusTargetTenant(t);
                                      setStatusTargetValue(status);
                                      setStatusReasonInput(t.statusReason || t.health?.statusReason || "");
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
                                  <SelectTrigger className="w-[130px] h-9 rounded-xl bg-secondary/10 border-border/10 font-black text-[9px] uppercase tracking-widest px-3 shadow-none focus:ring-1 focus:ring-primary/20 transition-all">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-border/20">
                                    {STATUS_OPTIONS.map((s) => (
                                      <SelectItem key={s} value={s} className="font-bold uppercase text-[10px] tracking-widest">
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(t.status)} className="px-3 py-1 font-black uppercase text-[9px] tracking-widest rounded-md border-none bg-muted/20">
                                  {t.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <CalendarClock className="h-3 w-3 text-muted-foreground/40" />
                                    <span className="text-[10px] font-bold text-foreground/60">{t.createdAt ? format(new Date(t.createdAt), "MMM dd, yyyy") : "N/A"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Activity className="h-3 w-3 text-muted-foreground/40" />
                                    <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">INTEGRITY VERIFIED</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                  asChild
                                >
                                  <Link to={`/platform/tenants/${t._id}`}>
                                    <ArrowRight className="h-5 w-5" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        {!filteredTenants.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center">
                              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/20 italic">No node definitions matching specified query</p>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {adminTenant ? (
              <CreateTenantAdminDialog
                open={!!adminTenant}
                onOpenChange={(o) => !o && setAdminTenant(null)}
                tenantId={adminTenant._id}
                tenantLabel={adminTenant.displayName || adminTenant.key}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="audit" className="space-y-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between bg-emerald-500/5 p-8 rounded-[2.5rem] border border-emerald-500/10 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
                  <ClipboardList className="h-8 w-8 text-white stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-black tracking-tight uppercase italic">Governance Stream</h2>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Global Platform Audit Trail</p>
                </div>
              </div>
              <div className="flex items-center gap-6 bg-white/50 dark:bg-black/20 backdrop-blur-xl px-8 py-4 rounded-3xl border border-border/10 shadow-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Event Density</span>
                  <span className="text-2xl font-black text-foreground">{auditTotal}</span>
                </div>
                <div className="h-10 w-px bg-border/20" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Active Monitoring</span>
                </div>
              </div>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden">
              <CardHeader className="pt-10 pb-6 px-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="text-xl font-black tracking-tighter uppercase italic flex items-center gap-3">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                      Registry Mutations
                    </CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Persistent ledger of administrative operations</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 px-6 rounded-xl bg-background/50 border-none font-black text-[10px] uppercase tracking-widest hover:bg-background transition-all shadow-sm group"
                    disabled={auditExporting}
                    onClick={() => void handleAuditExportCsv()}
                  >
                    {auditExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-3 text-primary" />
                    ) : (
                      <Download className="h-4 w-4 mr-3 text-primary group-hover:scale-110 transition-transform" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 px-10 pb-10">
                <div className="grid gap-6 lg:grid-cols-3 bg-secondary/20 p-8 rounded-[2rem] border border-border/10 shadow-inner">
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/60 ml-1">Mutation Vector</Label>
                    <Select value={auditAction} onValueChange={setAuditAction}>
                      <SelectTrigger className="w-full h-12 bg-background/40 border-border/10 shadow-none rounded-xl font-black text-[10px] uppercase tracking-widest px-5">
                        <SelectValue placeholder="Universal History" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        <SelectItem value="all" className="font-bold uppercase text-[10px] tracking-widest">Universal History</SelectItem>
                        {auditActionOptions.map((a) => (
                          <SelectItem key={a} value={a} className="font-bold uppercase text-[10px] tracking-widest">
                            {a.replace(/\./g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/60 ml-1">Range Start</Label>
                    <Input
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      className="h-12 bg-background/40 border-border/10 shadow-none rounded-xl font-bold text-sm px-5"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/60 ml-1">Range End</Label>
                    <Input
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      className="h-12 bg-background/40 border-border/10 shadow-none rounded-xl font-bold text-sm px-5"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/40" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                      IDENTIFIED: <span className="text-foreground">{auditTotal} EVENTS</span>
                      {auditTotal > auditPageSize && (
                        <> · PAGE {auditPage + 1}/{auditTotalPages}</>
                      )}
                    </span>
                  </div>
                  {auditTotal > auditPageSize && (
                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] bg-background/50 border-none hover:bg-background transition-all"
                        disabled={auditPage <= 0}
                        onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Backward
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] bg-background/50 border-none hover:bg-background transition-all"
                        disabled={(auditPage + 1) * auditPageSize >= auditTotal}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        Forward
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-border/10 overflow-hidden shadow-inner bg-background/20 mt-2">
                  <Table>
                    <TableHeader className="bg-secondary/40 border-b border-border/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Event Horizon</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Operation Vector</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Governance Actor</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Resource Link</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Mutation Summary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(auditQ.data?.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center bg-background/20">
                            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/20 italic">No governance events identified within specific parameters</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        (auditQ.data?.data ?? []).map((row) => {
                          const links = platformAuditLinks(row);
                          const created = new Date(row.createdAt);
                          return (
                            <TableRow key={row._id} className="group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0">
                              <TableCell className="py-6 px-6 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-foreground/80">{formatRelativeOrDash(row.createdAt)}</span>
                                  <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{formatDateOrDash(row.createdAt)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="px-3 py-1 font-black uppercase text-[9px] tracking-widest border-primary/20 bg-primary/5 text-primary">
                                  {row.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center font-black text-[10px] border border-border/10 shadow-sm text-muted-foreground">
                                    {row.actorName?.substring(0, 1) || "A"}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-tight text-foreground/80">{row.actorName || "—"}</span>
                                    {row.actorEmployeeId && <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{row.actorEmployeeId}</span>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  {links.tenantPath ? (
                                    <Link to={links.tenantPath} className="group/link flex flex-col items-start">
                                      <span className="text-xs font-bold text-primary group-hover/link:underline">{row.resourceType || "Resource Node"}</span>
                                      <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">{row.resourceId?.substring(row.resourceId.length - 8) || "Global"}</span>
                                    </Link>
                                  ) : (
                                    <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{row.resourceId || "Global"}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[400px] px-6">
                                <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic line-clamp-2" title={row.details ? JSON.stringify(row.details) : undefined}>
                                  {row.details ? (typeof row.details === 'string' ? row.details : JSON.stringify(row.details)) : "—"}
                                </p>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ModuleDashboardLayout>
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
              Provide a rationale for marking <span className="font-black text-foreground italic">{statusTargetTenant?.displayName || statusTargetTenant?.key}</span> as <Badge variant="secondary" className="px-2 py-0.5 rounded-md font-black uppercase text-[9px] tracking-widest bg-primary/10 text-primary border-none inline-flex align-middle ml-1">{statusTargetValue}</Badge>.
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
                if (!statusTargetTenant) return;
                setStatusDialogOpen(false);
                requestStepUp(
                  async () => {
                    await statusMut.mutateAsync({
                      id: statusTargetTenant._id,
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
              Extend the trial window for <span className="font-black text-foreground italic">{trialTargetTenant?.displayName || trialTargetTenant?.key}</span>.
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
                if (!trialTargetTenant) return;
                const days = Math.min(Math.max(parseInt(trialDaysInput, 10) || 0, 1), 3650);
                setTrialDialogOpen(false);
                requestStepUp(
                  async () => {
                    await trialMut.mutateAsync({ tenantId: trialTargetTenant._id, extendDays: days });
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
    </>
  );
}
