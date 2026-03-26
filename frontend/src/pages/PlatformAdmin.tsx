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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Tenants</CardTitle>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{metrics?.tenants.total ?? 0}</div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {Object.entries(metrics?.tenants.byStatus ?? {}).map(([k, v]) => (
                      <Badge 
                        key={k} 
                        variant={statusBadgeVariant(k)} 
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Employees</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{metrics?.employees ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Across all active tenants</p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Environment</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Activity className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">Live</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Production platform backend</p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Inventory</CardTitle>
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Package className="h-4 w-4 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{metrics?.products ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Total registered products</p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Sales Activity</CardTitle>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <ShoppingCart className="h-4 w-4 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{metrics?.orders ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Orders processed to date</p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Financials</CardTitle>
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <FileText className="h-4 w-4 text-indigo-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">{metrics?.invoices ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Invoices generated globally</p>
                </CardContent>
              </Card>
            </div>
            <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                      <Activity className="h-5 w-5 text-primary" />
                      Global Announcement Banner
                    </CardTitle>
                    <CardDescription>
                      Broadcast maintenance or updates to all active tenants on the platform.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 rounded-xl border border-border/40">
                    <Switch
                      checked={globalAnnouncementEnabled}
                      onCheckedChange={setGlobalAnnouncementEnabled}
                      disabled={globalAnnouncementMut.isPending || globalAnnouncementQ.isLoading}
                    />
                    <Label className="font-bold text-xs uppercase tracking-widest cursor-pointer">
                      {globalAnnouncementEnabled ? "Active" : "Disabled"}
                    </Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid gap-6 sm:grid-cols-4">
                  <div className="sm:col-span-1 space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Alert Level</Label>
                    <Select
                      value={globalAnnouncementLevel}
                      onValueChange={(v) =>
                        setGlobalAnnouncementLevel(v as "info" | "warning" | "maintenance")
                      }
                      disabled={globalAnnouncementMut.isPending}
                    >
                      <SelectTrigger className="bg-background/50 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information (Blue)</SelectItem>
                        <SelectItem value="warning">Warning (Yellow)</SelectItem>
                        <SelectItem value="maintenance">Maintenance (Purple)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-2">
                    <Label htmlFor="global-announcement-message" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Banner Message</Label>
                    <Input
                      id="global-announcement-message"
                      value={globalAnnouncementMessage}
                      onChange={(e) => setGlobalAnnouncementMessage(e.target.value)}
                      placeholder="e.g. System maintenance scheduled for tonight at 22:00 UTC."
                      className="bg-background/50 border-border/40 focus:bg-background transition-colors"
                      disabled={globalAnnouncementMut.isPending}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    size="lg"
                    className="px-8 shadow-lg shadow-primary/20"
                    onClick={() =>
                      requestStepUp(
                        async () => {
                          await globalAnnouncementMut.mutateAsync();
                        },
                        {
                          title: "Confirm global announcement update",
                          description: "Re-enter your password to update the global tenant banner.",
                        }
                      )
                    }
                    disabled={globalAnnouncementMut.isPending}
                  >
                    {globalAnnouncementMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Update Global Banner
                  </Button>
                </div>
              </CardContent>
            </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <Card className="border-dashed border-border/80 bg-secondary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full max-w-3xl space-y-4">
                  <div className="space-y-1">
                    <p className="text-lg font-bold tracking-tight">Company Management</p>
                    <p className="text-sm text-muted-foreground">
                      Manage lifecycle, trial windows, and administrative access for all platform tenants.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by key, legal name or display name..."
                        className="pl-9 h-11 bg-background/50 border-border/40 focus:bg-background transition-colors"
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
                        size="lg"
                        className="px-6"
                        onClick={() => setTenantSearchQuery(tenantSearchInput.trim())}
                      >
                        Search
                      </Button>
                      {(tenantSearchQuery || tenantSearchInput) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="lg"
                          onClick={() => {
                            setTenantSearchInput("");
                            setTenantSearchQuery("");
                          }}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="shadow-lg shadow-primary/20">
                          <Plus className="h-5 w-5 mr-2" />
                          New Company
                        </Button>
                    </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create company</DialogTitle>
                  <DialogDescription>
                    Unique key (slug). Legal and display names are shown in the app.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-key">Key (slug)</Label>
                    <Input
                      id="p-key"
                      placeholder=""
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-legal">Legal name</Label>
                    <Input
                      id="p-legal"
                      placeholder=""
                      value={newLegal}
                      onChange={(e) => setNewLegal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-display">Display name (optional)</Label>
                    <Input
                      id="p-display"
                      placeholder=""
                      value={newDisplay}
                      onChange={(e) => setNewDisplay(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Initial status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={createMut.isPending || !newKey.trim() || !newLegal.trim()}
                    onClick={() =>
                      requestStepUp(
                        async () => {
                          await createMut.mutateAsync();
                        },
                        {
                          title: "Confirm company creation",
                          description: "Re-enter your password to create a new company.",
                        }
                      )
                    }
                  >
                    {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {tenantsQ.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>All companies</CardTitle>
                <CardDescription>Change status or create a tenant-scoped admin user.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow className="hover:bg-transparent border-b border-border/40">
                      <TableHead className="font-bold py-4">Key</TableHead>
                      <TableHead className="font-bold py-4">Display Name</TableHead>
                      <TableHead className="font-bold py-4">Status</TableHead>
                      <TableHead className="font-bold py-4">Status Note</TableHead>
                      <TableHead className="font-bold py-4">Activity</TableHead>
                      <TableHead className="font-bold py-4">Health & Scale</TableHead>
                      <TableHead className="font-bold py-4">Trial Status</TableHead>
                      <TableHead className="font-bold py-4">Plan</TableHead>
                      <TableHead className="text-right font-bold py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((t) => (
                      <TableRow key={t._id} className="group transition-colors hover:bg-muted/30 border-b border-border/20">
                        <TableCell className="font-mono text-[11px] py-4">
                          <Link
                            to={`/platform/tenants/${t._id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {t.key}
                          </Link>
                        </TableCell>
                        <TableCell>{t.displayName || t.legalName}</TableCell>
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
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <p className="text-xs text-muted-foreground truncate" title={t.health?.statusReason || t.statusReason || ""}>
                            {t.health?.statusReason || t.statusReason || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeOrDash(t.health?.lastApiActivityAt || t.lastApiActivityAt || null)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                            <span>
                              Admins:{" "}
                              <strong className={t.health?.zeroAdmins ? "text-destructive" : ""}>
                                {t.health?.adminCount ?? "—"}
                              </strong>
                            </span>
                            {t.health?.zeroAdmins ? (
                              <Badge variant="destructive" className="w-fit">Zero admins</Badge>
                            ) : null}
                            <span className="text-muted-foreground">
                              Docs: {t.health?.totalDocuments ?? "—"}
                            </span>
                            <span className="text-muted-foreground">
                              Billing: {(t.billingProvider || "none").toString()}
                              {t.billingCustomerId ? ` · ${t.billingCustomerId}` : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                            <span>{formatDateOrDash(t.health?.trialEndDate || t.trialEndDate)}</span>
                            {t.health?.trialExpired ? (
                              <Badge variant="destructive" className="w-fit">
                                Expired
                              </Badge>
                            ) : t.health?.trialDaysLeft != null ? (
                              <span className="text-muted-foreground">
                                {t.health.trialDaysLeft} day(s) left
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {t.plan || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={trialMut.isPending}
                              onClick={() => {
                                setTrialTargetTenant(t);
                                setTrialDaysInput("7");
                                setTrialDialogOpen(true);
                              }}
                            >
                              <CalendarClock className="h-3.5 w-3.5 mr-1" />
                              Extend trial
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAdminTenant(t)}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Admin
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setActAsTenantId(t._id);
                                toast.success(`Switched context to ${t.displayName || t.key}`);
                                navigate("/");
                              }}
                            >
                              <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
                              Work
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredTenants.length ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                          No companies found for your current search.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
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

        <TabsContent value="audit">
          {auditQ.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : auditQ.isError ? (
            <p className="text-sm text-destructive">Could not load audit log.</p>
          ) : (
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Platform actions
                </CardTitle>
                <CardDescription>
                  Super-admin mutations (create company, status, tenant admins). Filter by action and date, export CSV,
                  or open the related company / user when links are available.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/10 p-4 rounded-xl border border-border/40 flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-0.5">Filter by Action</Label>
                    <Select value={auditAction} onValueChange={setAuditAction}>
                      <SelectTrigger className="w-full bg-background/50 border-border/40">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actions available</SelectItem>
                        {auditActionOptions.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 min-w-[160px]">
                    <Label htmlFor="audit-from" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-0.5">From Date</Label>
                    <Input
                      id="audit-from"
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      className="bg-background/50 border-border/40"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-[160px]">
                    <Label htmlFor="audit-to" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-0.5">To Date</Label>
                    <Input
                      id="audit-to"
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      className="bg-background/50 border-border/40"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-background/50 border-border/40 hover:bg-background transition-colors"
                    disabled={auditExporting}
                    onClick={() => void handleAuditExportCsv()}
                  >
                    {auditExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Logs
                  </Button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <span>
                    Total matching: <strong className="text-foreground">{auditTotal}</strong>
                    {auditTotal > auditPageSize ? (
                      <>
                        {" "}
                        · Page <strong className="text-foreground">{auditPage + 1}</strong> of{" "}
                        <strong className="text-foreground">{auditTotalPages}</strong>
                      </>
                    ) : null}
                  </span>
                  {auditTotal > auditPageSize ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={auditPage <= 0}
                        onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={(auditPage + 1) * auditPageSize >= auditTotal}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border border-border/70 max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow className="hover:bg-transparent border-b border-border/40">
                        <TableHead className="font-bold py-3">Timestamp</TableHead>
                        <TableHead className="font-bold py-3">Operation</TableHead>
                        <TableHead className="font-bold py-3">Actor</TableHead>
                        <TableHead className="font-bold py-3">Resource Target</TableHead>
                        <TableHead className="font-bold py-3">Change Details</TableHead>
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
