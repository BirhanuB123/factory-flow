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
        title="Platform administration"
        description="Manage companies, lifecycle, tenant admins, and platform-wide audit controls."
        icon={Building2}
        className="w-full"
        healthStats={[
          { label: "Companies", value: String(metrics?.tenants.total ?? 0) },
          { label: "Employees", value: String(metrics?.employees ?? 0) },
          { label: "Actions", value: String(auditTotal) },
        ]}
      >
      <Tabs defaultValue="overview" className="space-y-4">
        <StickyModuleTabs>
          <TabsList className={moduleTabsListClassName()}>
            <TabsTrigger value="overview" className={moduleTabsTriggerClassName()}>
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tenants" className={moduleTabsTriggerClassName()}>
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="audit" className={moduleTabsTriggerClassName()}>
              <ClipboardList className="h-4 w-4" />
              Platform audit
            </TabsTrigger>
          </TabsList>
        </StickyModuleTabs>

        <TabsContent value="overview" className="space-y-4">
          {metricsQ.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : metricsQ.isError ? (
            <p className="text-sm text-destructive">Could not load metrics.</p>
          ) : (
            <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-500/10 via-background to-background shadow-xl shadow-blue-500/5 group hover:shadow-blue-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Building2 className="h-24 w-24 text-blue-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-blue-500/70 uppercase">Total Tenants</CardTitle>
                  <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <Building2 className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">{metrics?.tenants.total ?? 0}</div>
                  <div className="flex flex-wrap gap-1.5 mt-6">
                    {Object.entries(metrics?.tenants.byStatus ?? {}).map(([k, v]) => (
                      <Badge 
                        key={k} 
                        variant={statusBadgeVariant(k)} 
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border-none shadow-sm"
                      >
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500/10 via-background to-background shadow-xl shadow-indigo-500/5 group hover:shadow-indigo-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Users className="h-24 w-24 text-indigo-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-indigo-500/70 uppercase">Global Users</CardTitle>
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <Users className="h-4 w-4 text-indigo-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">{metrics?.employees ?? 0}</div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-semibold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active across all registered tenants
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-purple-500/10 via-background to-background shadow-xl shadow-purple-500/5 group hover:shadow-purple-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Activity className="h-24 w-24 text-purple-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-purple-500/70 uppercase">Platfrom Node</CardTitle>
                  <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <Activity className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">Mainland</div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-semibold">Real-time production infrastructure</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-500/10 via-background to-background shadow-xl shadow-orange-500/5 group hover:shadow-orange-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Package className="h-24 w-24 text-orange-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-orange-500/70 uppercase">Catalog Items</CardTitle>
                  <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <Package className="h-4 w-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">{metrics?.products ?? 0}</div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-semibold">Total products across the ecosystem</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-500/10 via-background to-background shadow-xl shadow-emerald-500/5 group hover:shadow-emerald-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <ShoppingCart className="h-24 w-24 text-emerald-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-emerald-500/70 uppercase">System Flow</CardTitle>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <ShoppingCart className="h-4 w-4 text-emerald-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">{metrics?.orders ?? 0}</div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-semibold">Cumulative order processing volume</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-none bg-gradient-to-br from-pink-500/10 via-background to-background shadow-xl shadow-pink-500/5 group hover:shadow-pink-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <FileText className="h-24 w-24 text-pink-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-bold tracking-[0.2em] text-pink-500/70 uppercase">Ledger Entries</CardTitle>
                  <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
                    <FileText className="h-4 w-4 text-pink-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-4xl font-black tracking-tight text-foreground/90">{metrics?.invoices ?? 0}</div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-semibold">Global financial document generation</p>
                </CardContent>
              </Card>
            </div>
            <Card className="border-none shadow-xl shadow-primary/5 bg-gradient-to-br from-card to-background overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2.5 text-xl font-black tracking-tight italic">
                      <Activity className="h-6 w-6 text-primary" />
                      GLOBAL ANNOUNCEMENT
                    </CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">
                      System-wide broadcast control center
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-2xl border border-border/40 backdrop-blur-sm">
                    <Switch
                      checked={globalAnnouncementEnabled}
                      onCheckedChange={setGlobalAnnouncementEnabled}
                      disabled={globalAnnouncementMut.isPending || globalAnnouncementQ.isLoading}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label className="font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer text-muted-foreground">
                      {globalAnnouncementEnabled ? "Broadcasting" : "Standby"}
                    </Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-8">
                <div className="grid gap-8 sm:grid-cols-4">
                  <div className="sm:col-span-1 space-y-3">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mb-1 block">Priority Level</Label>
                    <Select
                      value={globalAnnouncementLevel}
                      onValueChange={(v) =>
                        setGlobalAnnouncementLevel(v as "info" | "warning" | "maintenance")
                      }
                      disabled={globalAnnouncementMut.isPending}
                    >
                      <SelectTrigger className="bg-background/40 border-border/40 h-11 rounded-xl focus:ring-primary/20 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        <SelectItem value="info" className="font-medium">Information (Blue)</SelectItem>
                        <SelectItem value="warning" className="font-medium text-amber-600">Warning (Yellow)</SelectItem>
                        <SelectItem value="maintenance" className="font-medium text-purple-600">Maintenance (Purple)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-3">
                    <Label htmlFor="global-announcement-message" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mb-1 block">Broadcast Message</Label>
                    <div className="relative">
                      <Input
                        id="global-announcement-message"
                        value={globalAnnouncementMessage}
                        onChange={(e) => setGlobalAnnouncementMessage(e.target.value)}
                        placeholder="e.g. System maintenance scheduled for tonight at 22:00 UTC."
                        className="bg-background/40 border-border/40 h-11 rounded-xl focus:bg-background transition-all pl-4 text-sm font-medium pr-12"
                        disabled={globalAnnouncementMut.isPending}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 hover:opacity-100 transition-opacity">
                        <FileText className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    size="lg"
                    className="px-10 h-12 rounded-2xl shadow-xl shadow-primary/20 font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all"
                    onClick={() =>
                      requestStepUp(
                        async () => {
                          await globalAnnouncementMut.mutateAsync();
                        },
                        {
                          title: "Confirm Broadcast",
                          description: "This will update the banner message for all 100% of tenants.",
                        }
                      )
                    }
                    disabled={globalAnnouncementMut.isPending}
                  >
                    {globalAnnouncementMut.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <ArrowRightCircle className="h-5 w-5 mr-2" />
                    )}
                    Publish Announcement
                  </Button>
                </div>
              </CardContent>
            </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-8">
          <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-8 bg-primary rounded-full" />
                    <h2 className="text-sm font-black uppercase tracking-[0.3em] text-foreground/70 italic">Registry Nexus</h2>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative group max-w-xl flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      </div>
                      <Input
                        placeholder="Identify tenant by key or legal nomenclature..."
                        className="h-14 pl-12 pr-12 rounded-2xl bg-secondary/20 border-border/10 focus:bg-background transition-all font-bold tracking-tight text-base"
                        value={tenantSearchInput}
                        onChange={(e) => setTenantSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setTenantSearchQuery(tenantSearchInput.trim());
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        onClick={() => setTenantSearchQuery(tenantSearchInput.trim())}
                      >
                        Execute Search
                      </Button>
                      {(tenantSearchQuery || tenantSearchInput) && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-14 w-14 rounded-2xl flex items-center justify-center p-0 bg-background/50 border-none hover:bg-background transition-all group"
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
                      <Button className="h-16 px-10 rounded-[1.5rem] bg-foreground text-background hover:bg-foreground/90 font-black text-base shadow-[0_20px_50px_rgba(0,0,0,0.1)] active:scale-95 hover:scale-[1.02] transition-all">
                        <Plus className="h-6 w-6 mr-3 stroke-[3]" />
                        Onboard Entity
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl bg-card/90 backdrop-blur-2xl px-8 pt-10 pb-8">
                      <DialogHeader className="space-y-3 text-center sm:text-left">
                        <DialogTitle className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-3 justify-center sm:justify-start">
                          <PlusCircle className="h-7 w-7 text-primary" />
                          Initialize Index
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium leading-relaxed">
                          Define domain identifiers and statutory titles to provision a new tenant on the platform.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-6 py-6 border-y border-border/10 my-2">
                        <div className="space-y-2">
                          <Label htmlFor="p-key" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Domain Handle (Slug)</Label>
                          <Input
                            id="p-key"
                            placeholder="e.g. acme-global"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="h-12 rounded-xl bg-secondary/30 border-none font-mono text-sm px-4 focus:bg-background transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="p-legal" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Statutory Identity</Label>
                          <Input
                            id="p-legal"
                            placeholder="e.g. Acme Corp Ltd."
                            value={newLegal}
                            onChange={(e) => setNewLegal(e.target.value)}
                            className="h-12 rounded-xl bg-secondary/30 border-none font-bold text-sm px-4 focus:bg-background transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="p-display" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Marketing Alias</Label>
                          <Input
                            id="p-display"
                            placeholder="Acme Global Inc."
                            value={newDisplay}
                            onChange={(e) => setNewDisplay(e.target.value)}
                            className="h-12 rounded-xl bg-secondary/30 border-none font-bold text-sm px-4 focus:bg-background transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 ml-1">Provisioning State</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="h-12 rounded-xl bg-secondary/30 border-none font-black text-xs uppercase tracking-widest px-4 shadow-none">
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
                        </div>
                      </div>
                      <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-3">
                        <Button variant="ghost" className="h-12 rounded-xl font-bold uppercase text-xs tracking-widest flex-1 sm:order-1" onClick={() => setCreateOpen(false)}>
                          Abort
                        </Button>
                        <Button
                          className="h-12 rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-xs tracking-widest flex-1 sm:order-2"
                          disabled={createMut.isPending || !newKey.trim() || !newLegal.trim()}
                          onClick={() =>
                            requestStepUp(
                              async () => {
                                await createMut.mutateAsync();
                              },
                              {
                                title: "Authorize Entity Creation",
                                description: "Tier-1 privilege required to commit new tenant records.",
                              }
                            )
                          }
                        >
                          {createMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize"}
                        </Button>
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
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
                                  const requiresReason = status === "suspended" || status === "archived";
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
                                    <SelectItem key={s} value={s} className="font-bold uppercase text-[9px] tracking-widest">
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="p-3 rounded-xl bg-secondary/20 border border-border/10">
                                <p className="text-[10px] text-muted-foreground/80 font-bold leading-tight line-clamp-2 italic" title={t.health?.statusReason || t.statusReason || ""}>
                                  {t.health?.statusReason || t.statusReason || "Systems operational • Integrity verified"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-3 w-3 text-muted-foreground opacity-40" />
                                  <span className="text-[11px] font-bold text-foreground/70">{t.health?.adminCount ?? "—"} Admins</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Activity className="h-3 w-3 text-muted-foreground opacity-40" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 line-clamp-1">{t.billingProvider?.toString() || "None"} • {t.billingCustomerId || "Unlinked"}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex items-center justify-end gap-2">
                                <Link to={`/platform/tenants/${t._id}`}>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary group/ctrl transition-all">
                                    <ExternalLink className="h-4 w-4 opacity-40 group-hover/ctrl:opacity-100" />
                                  </Button>
                                </Link>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive group/del transition-all">
                                  <Trash2 className="h-4 w-4 opacity-40 group-hover/del:opacity-100" />
                                </Button>
                              </div>
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

        <TabsContent value="audit" className="space-y-6">
          {auditQ.isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
          ) : auditQ.isError ? (
            <p className="text-sm text-destructive">Could not load audit log.</p>
          ) : (
            <Card className="border-none shadow-2xl shadow-black/5 bg-card/40 backdrop-blur-xl overflow-hidden rounded-3xl">
              <CardHeader className="pt-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2.5 text-lg font-black tracking-tight text-foreground/80 lowercase italic">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                      platform governance logs
                    </CardTitle>
                    <CardDescription className="font-medium text-[11px] uppercase tracking-widest leading-relaxed">
                      Immutable trail of super-admin mutations and platform-wide configuration shifts.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 rounded-xl bg-background shadow-sm border-none font-bold text-xs uppercase tracking-widest hover:bg-background/90"
                    disabled={auditExporting}
                    onClick={() => void handleAuditExportCsv()}
                  >
                    {auditExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pb-8">
                <div className="grid gap-6 lg:grid-cols-3 bg-secondary/30 p-6 rounded-2xl border border-border/20">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Mutation Type</Label>
                    <Select value={auditAction} onValueChange={setAuditAction}>
                      <SelectTrigger className="w-full h-11 bg-background border-none shadow-inner rounded-xl font-medium">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        <SelectItem value="all" className="font-medium">Universal History</SelectItem>
                        {auditActionOptions.map((a) => (
                          <SelectItem key={a} value={a} className="font-medium capitalize">
                            {a.replace(/\./g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audit-from" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Range Start</Label>
                    <Input
                      id="audit-from"
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      className="h-11 bg-background border-none shadow-inner rounded-xl font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audit-to" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Range End</Label>
                    <Input
                      id="audit-to"
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      className="h-11 bg-background border-none shadow-inner rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  <span>
                    Query Results: <span className="text-foreground/80">{auditTotal}</span>
                    {auditTotal > auditPageSize ? (
                      <>
                        {" "}
                        · Segment <span className="text-foreground/80">{auditPage + 1}</span> of{" "}
                        <span className="text-foreground/80">{auditTotalPages}</span>
                      </>
                     ) : null}
                  </span>
                  {auditTotal > auditPageSize ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 px-4 rounded-xl font-bold bg-background/50 border-none hover:bg-background"
                        disabled={auditPage <= 0}
                        onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1.5" />
                        Backward
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 px-4 rounded-xl font-bold bg-background/50 border-none hover:bg-background"
                        disabled={(auditPage + 1) * auditPageSize >= auditTotal}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        Forward
                        <ChevronRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/20 overflow-hidden shadow-inner bg-background/20">
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
                      {(auditQ.data?.data ?? []).map((row) => {
                        const links = platformAuditLinks(row);
                        const created = new Date(row.createdAt);
                        return (
                          <TableRow key={row._id}>
                            <TableCell className="text-xs whitespace-nowrap align-top">
                              <div>{formatDistanceToNow(created, { addSuffix: true })}</div>
                              <div className="text-muted-foreground">{format(created, "PP p")}</div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline">{row.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              {row.actorName || "—"}
                              <br />
                              <span className="text-muted-foreground">{row.actorEmployeeId || ""}</span>
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              <div className="flex flex-col gap-1">
                                <span>
                                  {row.resourceType || "—"}
                                  {row.resourceId ? (
                                    <code className="ml-1 text-[11px] break-all">{row.resourceId}</code>
                                  ) : null}
                                </span>
                                <div className="flex flex-wrap gap-x-2 gap-y-1">
                                  {links.tenantPath ? (
                                    <Link
                                      to={links.tenantPath}
                                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Company
                                    </Link>
                                  ) : null}
                                  {links.userPath ? (
                                    <Link
                                      to={links.userPath}
                                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      User
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-xs max-w-[220px] truncate align-top"
                              title={row.details ? JSON.stringify(row.details) : undefined}
                            >
                              {row.details ? JSON.stringify(row.details) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update status reason</DialogTitle>
            <DialogDescription>
              Provide a reason for marking <strong>{statusTargetTenant?.displayName || statusTargetTenant?.key}</strong> as <strong>{statusTargetValue}</strong>.
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
              How many days would you like to extend the trial for <strong>{trialTargetTenant?.displayName || trialTargetTenant?.key}</strong>?
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
