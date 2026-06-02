import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { useLocale } from "@/contexts/LocaleContext";
import {
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import {
  Building2,
  Loader2,
  Plus,
  Users,
  UserPlus,
  Download,
  ChevronLeft,
  ChevronRight,
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
  X,
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

interface AuditRow {
  _id: string;
  createdAt: string;
  action: string;
  actorName?: string;
  actorEmployeeId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown> | string;
}

function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="mt-2 overflow-hidden rounded-[14px] border border-border/60 bg-background">
      <Table>
        <TableHeader className="bg-secondary/40 border-b border-border/20">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Time</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Action</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Actor</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5">Resource</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-48 text-center bg-background/20">
                <p className="text-sm font-medium text-muted-foreground/30 italic">No events match the selected filters</p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const links = platformAuditLinks({
                resourceType: row.resourceType,
                resourceId: row.resourceId,
                details: typeof row.details === "object" ? (row.details ?? undefined) : undefined,
              });
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
                          <span className="text-xs font-bold text-primary group-hover/link:underline">{row.resourceType || "—"}</span>
                          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">{row.resourceId?.substring(row.resourceId.length - 8) || "Global"}</span>
                        </Link>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{row.resourceId || "Global"}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[400px] px-6">
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic line-clamp-2" title={row.details ? JSON.stringify(row.details) : undefined}>
                      {row.details ? (typeof row.details === "string" ? row.details : JSON.stringify(row.details)) : "—"}
                    </p>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: PlatformTenant | null;
  targetStatus: string;
  reason: string;
  onReasonChange: (v: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

function StatusChangeDialog({ open, onOpenChange, tenant, targetStatus, reason, onReasonChange, isPending, onConfirm }: StatusChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none bg-background/80 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500/50 via-primary/50 to-indigo-500/50" />
        <DialogHeader className="pt-10 px-10">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
            Change Status
          </DialogTitle>
          <DialogDescription className="text-sm font-medium pt-2">
            Provide a reason for marking{" "}
            <span className="font-black text-foreground italic">{tenant?.displayName || tenant?.key}</span>{" "}
            as{" "}
            <Badge variant="secondary" className="px-2 py-0.5 rounded-md font-black uppercase text-[9px] tracking-widest bg-primary/10 text-primary border-none inline-flex align-middle ml-1">
              {targetStatus}
            </Badge>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-10 py-8 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="status-reason-input" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Reason</Label>
            <Input
              id="status-reason-input"
              placeholder="e.g. Non-payment, user requested archiving..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
        <div className="p-8 pt-0 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-6">
            Cancel
          </Button>
          <Button
            className="rounded-xl font-bold text-[11px] uppercase tracking-wider h-11 px-8 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TrialExtensionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: PlatformTenant | null;
  days: string;
  onDaysChange: (v: string) => void;
  onConfirm: (days: number) => void;
}

function TrialExtensionDialog({ open, onOpenChange, tenant, days, onDaysChange, onConfirm }: TrialExtensionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none bg-background/80 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500/50 via-amber-500/50 to-yellow-500/50" />
        <DialogHeader className="pt-10 px-10">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <CalendarClock className="h-5 w-5" />
            </div>
            Extend Trial
          </DialogTitle>
          <DialogDescription className="text-sm font-medium pt-2">
            Extend the trial window for{" "}
            <span className="font-black text-foreground italic">{tenant?.displayName || tenant?.key}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-10 py-8 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="trial-days-input" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">Days to add</Label>
            <div className="relative">
              <Input
                id="trial-days-input"
                type="number"
                min="1"
                max="3650"
                value={days}
                onChange={(e) => onDaysChange(e.target.value)}
                className="h-14 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-black text-xl px-12 shadow-inner text-center"
              />
              <Zap className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 opacity-20 text-orange-500" />
            </div>
          </div>
        </div>
        <DialogFooter className="bg-secondary/20 p-8 flex gap-3 sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-background h-12 px-8">
            Cancel
          </Button>
          <Button
            className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-orange-500 text-white shadow-xl shadow-orange-500/20 h-12 px-8 hover:scale-[1.05] transition-all border-none"
            onClick={() => onConfirm(Math.min(Math.max(parseInt(days, 10) || 0, 1), 3650))}
          >
            Extend Trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getApiError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  if (typeof data === "string" && data) return data;
  return (e as { message?: string })?.message || fallback;
}

export default function PlatformAdmin() {
  const { t } = useLocale();
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
      toast.error(getApiError(e, "Could not create company"));
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
      toast.error(getApiError(e, "Update failed"));
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
      toast.error(getApiError(e, "Could not extend trial"));
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
      toast.error(getApiError(e, "Could not update announcement"));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => platformApi.deleteTenant(id),
    onSuccess: (data) => {
      toast.success(data.message || "Company deleted permanently");
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-metrics"] });
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
    },
    onError: (e: unknown) => {
      toast.error(getApiError(e, "Deletion failed"));
    },
  });

  const metrics = metricsQ.data?.data;
  const byStatus = metrics?.tenants.byStatus ?? {};
  const activeTenantCount =
    (typeof byStatus.active === "number" ? byStatus.active : undefined) ??
    (typeof (byStatus as Record<string, number>).Active === "number"
      ? (byStatus as Record<string, number>).Active
      : 0);
  const filteredTenants = useMemo(() => {
    const allTenants = tenantsQ.data?.data ?? [];
    const q = tenantSearchQuery.trim().toLowerCase();
    if (!q) return allTenants;
    return allTenants.filter((tenant) => {
      const key = String(tenant.key || "").toLowerCase();
      const legalName = String(tenant.legalName || "").toLowerCase();
      const displayName = String(tenant.displayName || "").toLowerCase();
      return key.includes(q) || legalName.includes(q) || displayName.includes(q);
    });
  }, [tenantsQ.data, tenantSearchQuery]);

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
      <div className="mx-auto max-w-[1600px] space-y-8 pb-8 animate-in fade-in duration-500">
        <section className="relative overflow-hidden rounded-[20px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.24),transparent_32%)]" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-7">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Platform control center
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("pages.platform.title")}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/65">{t("pages.platform.subtitle")}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Companies", value: metrics?.tenants.total ?? 0, tone: "text-sky-200" },
                  { label: "Active", value: activeTenantCount, tone: "text-emerald-200" },
                  { label: "Employees", value: metrics?.employees ?? 0, tone: "text-amber-200" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{item.label}</p>
                    <p className={`mt-1 text-xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Platform health</p>
                  <p className={`mt-2 text-3xl font-black tracking-tight ${metricsQ.isError ? "text-red-300" : ""}`}>
                    {metricsQ.isLoading ? "Checking..." : metricsQ.isError ? "Degraded" : "Healthy"}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-white/55">
                    {metricsQ.isError ? "Could not reach metrics API." : "Tenant operations and platform audit visibility are available."}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${metricsQ.isError ? "bg-red-400/15 text-red-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                  <CloudCog className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-white/10 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Audit events</p>
                  <p className="mt-1 text-xl font-black">{auditTotal}</p>
                </div>
                <div className="rounded-[12px] border border-white/10 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/45">API status</p>
                  <p className="mt-1 text-xl font-black">{metricsQ.isError ? "Offline" : "Online"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-6">
          <StickyModuleTabs>
            <TabsList className={moduleTabsListClassName()}>
              <TabsTrigger value="overview" className={moduleTabsTriggerClassName()}>
                <Activity className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="tenants" className={moduleTabsTriggerClassName()}>
                <Building2 className="h-4 w-4" />
                Companies
              </TabsTrigger>
              <TabsTrigger value="audit" className={moduleTabsTriggerClassName()}>
                <ClipboardList className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>
          </StickyModuleTabs>

          <TabsContent value="overview" className="space-y-8">
            {metricsQ.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
                <p className="text-sm font-medium text-muted-foreground/50">Loading metrics...</p>
              </div>
            ) : metricsQ.isError ? (
              <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
                <p className="font-bold text-sm">Error: Could not sync metrics.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="group relative overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-emerald-500" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-6 pt-6">
                      <CardTitle className="text-xs font-bold tracking-wider text-blue-500 uppercase">Companies</CardTitle>
                      <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-blue-500/20 bg-blue-500/10 text-blue-500">
                        <Building2 className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-2">
                      <div className="text-4xl font-bold tracking-tight text-foreground mb-4">{metrics?.tenants.total ?? 0}</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(metrics?.tenants.byStatus ?? {}).map(([k, v]) => (
                          <Badge
                            key={k}
                            variant={statusBadgeVariant(k)}
                            className="rounded-[8px] px-2 py-0.5 text-[10px] font-bold uppercase"
                          >
                            {k}: {v}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="group relative overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-primary to-sky-500" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-6 pt-6">
                      <CardTitle className="text-xs font-bold tracking-wider text-indigo-500 uppercase">Total Employees</CardTitle>
                      <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">
                        <Users className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-2">
                      <div className="text-4xl font-bold tracking-tight text-foreground mb-4">{metrics?.employees ?? 0}</div>
                      <p className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active across all companies
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="group relative overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-6 pt-6">
                      <CardTitle className="text-xs font-bold tracking-wider text-emerald-500 uppercase">System Status</CardTitle>
                      <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                        <Activity className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-2">
                      <div className={`text-3xl font-bold tracking-tight mb-4 ${metricsQ.isError ? "text-destructive" : "text-foreground"}`}>
                        {metricsQ.isLoading ? "Checking..." : metricsQ.isError ? "Degraded" : "Healthy"}
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${metricsQ.isError ? "bg-destructive" : "bg-emerald-500 animate-pulse"}`} />
                        {metricsQ.isError ? "Metrics API unreachable" : "All services operational"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-emerald-500" />
                  <CardHeader className="p-8 pb-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-primary/20 bg-primary/10 text-primary">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                          <CardTitle className="text-lg font-black tracking-tight text-foreground">Global announcement</CardTitle>
                          <CardDescription className="text-xs">Broadcast a message to all users across the platform.</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[12px] border border-border/60 bg-muted/25 px-4 py-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 cursor-pointer">
                          {globalAnnouncementEnabled ? "Active" : "Disabled"}
                        </Label>
                        <Switch
                          checked={globalAnnouncementEnabled}
                          onCheckedChange={setGlobalAnnouncementEnabled}
                          disabled={globalAnnouncementMut.isPending || globalAnnouncementQ.isLoading}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="grid gap-6 sm:grid-cols-4 items-end">
                      <div className="sm:col-span-1 space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Priority</Label>
                        <Select
                          value={globalAnnouncementLevel}
                          onValueChange={(v) =>
                            setGlobalAnnouncementLevel(v as "info" | "warning" | "maintenance")
                          }
                          disabled={globalAnnouncementMut.isPending}
                        >
                          <SelectTrigger className="h-10 rounded-[12px] border-border/60 bg-muted/20 px-4 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[12px]">
                            <SelectItem value="info">Information</SelectItem>
                            <SelectItem value="warning" className="text-amber-500">Warning</SelectItem>
                            <SelectItem value="maintenance" className="text-primary">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3 space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Message Content</Label>
                        <Input
                          id="global-announcement-message"
                          value={globalAnnouncementMessage}
                          onChange={(e) => setGlobalAnnouncementMessage(e.target.value)}
                          placeholder="Type your announcement here..."
                          className="h-10 rounded-[12px] border-border/60 bg-muted/20 px-4 text-sm"
                          disabled={globalAnnouncementMut.isPending}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="h-10 rounded-[12px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                        onClick={() =>
                          requestStepUp(
                            async () => {
                              await globalAnnouncementMut.mutateAsync();
                            },
                            {
                              title: "Authorize Announcement",
                              description: "This message will be visible to all users.",
                            }
                          )
                        }
                        disabled={globalAnnouncementMut.isPending}
                      >
                        {globalAnnouncementMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ArrowRightCircle className="h-4 w-4 mr-2" />
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
            <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
              <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-foreground">Company directory</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">Search, create, and manage registered companies</p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="group relative max-w-2xl flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        </div>
                        <Input
                          placeholder="Search companies by name or key..."
                          className="h-11 rounded-[12px] border border-border/60 bg-card pl-11 pr-11 text-sm font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-primary/25"
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
                          className="h-11 rounded-[12px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                          onClick={() => setTenantSearchQuery(tenantSearchInput.trim())}
                        >
                          Search
                        </Button>
                        {(tenantSearchQuery || tenantSearchInput) && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="flex h-11 w-11 items-center justify-center rounded-[12px] border-border/60 p-0 shadow-sm"
                            onClick={() => {
                              setTenantSearchInput("");
                              setTenantSearchQuery("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" className="group h-12 rounded-[12px] bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-all active:scale-95 hover:bg-primary/90">
                          <Plus className="h-5 w-5 mr-3 stroke-[3]" />
                          Create Company
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl border border-border/60 bg-card px-8 py-10 shadow-erp sm:max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
                        <DialogHeader className="space-y-2 text-center sm:text-left">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                              <LayoutGrid className="h-6 w-6" />
                            </div>
                            <div className="space-y-0.5">
                              <DialogTitle className="text-2xl font-bold">New Company</DialogTitle>
                              <DialogDescription className="text-sm">Provision a new company account.</DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="grid gap-6 py-8 relative z-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Domain Key (Slug)</Label>
                              <Input
                                placeholder="ACME-MFG"
                                value={newKey}
                                onChange={(e) =>
                                  setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                                }
                                className="h-10 rounded-xl bg-secondary/30 border-border/10 font-bold text-sm px-4 focus:bg-background transition-all uppercase tracking-wider"
                              />
                              <p className="text-[10px] text-muted-foreground/50 ml-1">Letters, numbers, hyphens, underscores only</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Initial Status</Label>
                              <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-border/10 font-bold text-sm px-4">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s} className="font-bold text-sm">
                                      {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Legal Name</Label>
                            <Input
                              placeholder="Acme Global Manufacturing Ltd."
                              value={newLegal}
                              onChange={(e) => setNewLegal(e.target.value)}
                              className="h-10 rounded-xl bg-secondary/30 border-border/10 font-medium text-sm px-4 focus:bg-background transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/60 ml-1">Display Name</Label>
                            <Input
                              placeholder="Acme Hub"
                              value={newDisplay}
                              onChange={(e) => setNewDisplay(e.target.value)}
                              className="h-10 rounded-xl bg-secondary/30 border-border/10 font-medium text-sm px-4 focus:bg-background transition-all"
                            />
                          </div>
                        </div>
                        <DialogFooter className="pt-4">
                          <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <Button type="button" variant="ghost" className="h-11 rounded-xl font-bold text-sm flex-1" onClick={() => setCreateOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="h-11 rounded-xl bg-primary shadow-lg font-bold text-sm flex-1"
                              disabled={createMut.isPending || !newKey.trim() || !newLegal.trim()}
                              onClick={() =>
                                requestStepUp(
                                  async () => {
                                    await createMut.mutateAsync();
                                  },
                                  {
                                    title: "Authorize Creation",
                                    description: "Credentials required to create a new company account.",
                                  }
                                )
                              }
                            >
                              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
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
              <div className="flex flex-col items-center justify-center py-48 bg-secondary/5 rounded-2xl border border-dashed border-border/20">
                <Loader2 className="h-10 w-10 animate-spin text-primary/40 mb-3" />
                <p className="font-medium text-sm text-muted-foreground/40">Loading directory...</p>
              </div>
            ) : (
              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
                <CardHeader className="border-b border-border/50 bg-muted/25 px-8 pb-4 pt-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground">
                        <LayoutGrid className="h-5 w-5 text-primary" />
                        Company ledger
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Inventory of global companies, health metrics, and status.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 rounded-[10px] border border-border/60 bg-muted/25 px-3 py-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        {filteredTenants.length} {tenantSearchQuery ? "results" : "companies"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 px-8 pb-8">
                  <div className="overflow-hidden rounded-[14px] border border-border/60 bg-background">
                    <Table>
                      <TableHeader className="bg-secondary/40 border-b border-border/20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4 px-6">Domain Identifier</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Company Name</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Quick Status</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Current State</TableHead>
                          <TableHead className="font-bold text-[11px] uppercase tracking-wider py-4">Created & Logs</TableHead>
                          <TableHead className="text-right font-bold text-[11px] uppercase tracking-wider py-4 px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-48 text-center">
                              <p className="text-sm font-medium text-muted-foreground/30 italic">No companies matching search</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTenants.map((t) => (
                            <TableRow key={t._id} className="group transition-all hover:bg-primary/5 border-b border-border/10 last:border-0">
                              <TableCell className="py-5 px-6">
                                <Link
                                  to={`/platform/tenants/${t._id}`}
                                  className="group/link inline-flex items-center gap-3"
                                >
                                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-muted font-bold text-xs shadow-sm transition-all group-hover/link:bg-primary group-hover/link:text-primary-foreground">
                                    {t.key.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-tight text-foreground/80 group-hover/link:text-primary transition-colors underline-offset-4 hover:underline">{t.key}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">ID: {t._id.substring(t._id.length - 8)}</span>
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
                                          title: "Confirm status change",
                                          description: `Update "${t.displayName || t.key}" to ${status}.`,
                                        }
                                      );
                                    }
                                  }}
                                  disabled={statusMut.isPending && statusMut.variables?.id === t._id}
                                >
                                  <SelectTrigger className="w-[120px] h-8 rounded-lg bg-secondary/10 border-border/10 font-bold text-[10px] uppercase tracking-wider px-3 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {STATUS_OPTIONS.map((s) => (
                                      <SelectItem key={s} value={s} className="font-bold text-[11px]">
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(t.status)} className="px-2 py-0.5 font-bold uppercase text-[9px] tracking-wider rounded-md border-none bg-muted/20">
                                  {t.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-3 w-3 text-muted-foreground/40" />
                                  <span className="text-[10px] font-bold text-foreground/60">{t.createdAt ? format(new Date(t.createdAt), "MMM dd, yyyy") : "N/A"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <div className="flex items-center justify-end gap-2">
                                  {t.status === "trial" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Extend trial"
                                      className="h-9 w-9 rounded-lg hover:bg-orange-500/10 hover:text-orange-500 transition-all"
                                      disabled={trialMut.isPending && trialMut.variables?.tenantId === t._id}
                                      onClick={() => {
                                        setTrialTargetTenant(t);
                                        setTrialDaysInput("7");
                                        setTrialDialogOpen(true);
                                      }}
                                    >
                                      {trialMut.isPending && trialMut.variables?.tenantId === t._id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Timer className="h-4 w-4 text-orange-500/70" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Add admin user"
                                    className="h-9 w-9 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-500 transition-all"
                                    onClick={() => setAdminTenant(t)}
                                  >
                                    <UserPlus className="h-4 w-4 text-indigo-500/70" />
                                  </Button>
                                  {t.status === "archived" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Permanently delete"
                                      className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
                                      onClick={() =>
                                        requestStepUp(
                                          async () => {
                                            await deleteMut.mutateAsync(t._id);
                                          },
                                          {
                                            title: "Permanently Delete Company",
                                            description: `All data for "${t.displayName || t.key}" will be wiped. This cannot be undone.`,
                                          }
                                        )
                                      }
                                      disabled={deleteMut.isPending && deleteMut.variables === t._id}
                                    >
                                      {deleteMut.isPending && deleteMut.variables === t._id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4 text-destructive/70" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="View details"
                                    className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                                    asChild
                                  >
                                    <Link to={`/platform/tenants/${t._id}`}>
                                      <ArrowRight className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
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

          <TabsContent value="audit" className="space-y-8">
            <div className="mb-6 flex flex-col gap-6 rounded-[18px] border border-border/70 bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-emerald-500 p-3.5 shadow-sm">
                  <ClipboardList className="h-6 w-6 stroke-[2.5] text-white" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-foreground">Audit stream</h2>
                  <p className="text-xs font-medium text-muted-foreground">Global activity monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-6 rounded-[14px] border border-border/60 bg-muted/25 px-6 py-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Total Events</span>
                  <span className="text-xl font-bold text-foreground">{auditTotal}</span>
                </div>
                <div className="h-8 w-px bg-border/20" />
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">Active</span>
                </div>
              </div>
            </div>

            <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-primary to-sky-500" />
              <CardHeader className="border-b border-border/50 bg-muted/25 px-8 pb-4 pt-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Activity log
                    </CardTitle>
                    <CardDescription className="text-xs font-medium opacity-60">Persistent record of administrative actions</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 px-4 rounded-xl bg-background/50 border border-border/10 font-bold text-[11px] uppercase tracking-wider hover:bg-background transition-all group"
                    disabled={auditExporting}
                    onClick={() => void handleAuditExportCsv()}
                  >
                    {auditExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 text-primary" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-2 text-primary group-hover:scale-110 transition-transform" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pb-8">
                <div className="grid gap-6 rounded-[14px] border border-border/60 bg-muted/20 p-6 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">Event Type</Label>
                    <Select value={auditAction} onValueChange={setAuditAction}>
                      <SelectTrigger className="w-full h-10 bg-background border-border/10 shadow-none rounded-xl font-bold text-[11px] px-4">
                        <SelectValue placeholder="All Activities" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="font-bold text-[11px]">All Activities</SelectItem>
                        {auditActionOptions.map((a) => (
                          <SelectItem key={a} value={a} className="font-bold text-[11px]">
                            {a.replace(/\./g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">From</Label>
                    <Input
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      className="h-10 bg-background border-border/10 shadow-none rounded-xl font-bold text-sm px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground/60 ml-1">To</Label>
                    <Input
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      className="h-10 bg-background border-border/10 shadow-none rounded-xl font-bold text-sm px-4"
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

                <AuditLogTable rows={auditQ.data?.data ?? []} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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

      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        tenant={statusTargetTenant}
        targetStatus={statusTargetValue}
        reason={statusReasonInput}
        onReasonChange={setStatusReasonInput}
        isPending={statusMut.isPending}
        onConfirm={() => {
          if (statusTargetTenant && statusTargetValue) {
            requestStepUp(
              async () => {
                await statusMut.mutateAsync({
                  id: statusTargetTenant._id,
                  status: statusTargetValue,
                  statusReason: statusReasonInput,
                });
                setStatusDialogOpen(false);
              },
              {
                title: "Confirm status override",
                description: `Transition "${statusTargetTenant.displayName || statusTargetTenant.key}" to ${statusTargetValue}.`,
              }
            );
          }
        }}
      />

      <TrialExtensionDialog
        open={trialDialogOpen}
        onOpenChange={setTrialDialogOpen}
        tenant={trialTargetTenant}
        days={trialDaysInput}
        onDaysChange={setTrialDaysInput}
        onConfirm={(days) => {
          setTrialDialogOpen(false);
          if (!trialTargetTenant) return;
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
      />
    </>
  );
}
