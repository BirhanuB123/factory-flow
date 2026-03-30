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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-8 text-muted-foreground" asChild>
            <Link to="/platform">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Platform
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Building2 className="h-7 w-7 text-primary shrink-0" />
            <span>{t.displayName || t.legalName}</span>
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {t.key}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.legalName}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="secondary"
            onClick={() => {
              setActAsTenantId(t._id);
              toast.success("Company context set for ERP API");
              navigate("/");
            }}
          >
            Work in this company
          </Button>
          <Button variant="outline" onClick={() => setAdminOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create admin
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Company settings
          </CardTitle>
          <CardDescription>
            Display name, plan, locale, industry, and module toggles. Wire{" "}
            <code className="text-xs">requireTenantModule</code> on API routes to enforce flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label className="w-40 shrink-0 text-muted-foreground">Lifecycle status</Label>
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
              <SelectTrigger className="max-w-[200px]">
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
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Last API activity:{" "}
              <strong className="text-foreground">
                {t.lastApiActivityAt ? formatDistanceToNow(new Date(t.lastApiActivityAt), { addSuffix: true }) : "—"}
              </strong>
            </p>
            <p>
              Suspended/archived reason:{" "}
              <span className="text-foreground">{t.statusReason?.trim() ? t.statusReason : "—"}</span>
            </p>
            <p>
              Trial end:{" "}
              <span className="text-foreground">
                {t.trialEndDate ? format(new Date(t.trialEndDate), "yyyy-MM-dd") : "—"}
              </span>
            </p>
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={trialMut.isPending}
                onClick={() => {
                  setTrialDaysInput("7");
                  setTrialDialogOpen(true);
                }}
              >
                <CalendarClock className="h-3.5 w-3.5 mr-1" />
                Extend trial
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="disp">Display name</Label>
              <Input
                id="disp"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal">Legal name</Label>
              <Input
                id="legal"
                value={editLegalName}
                onChange={(e) => setEditLegalName(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Input
                id="plan"
                placeholder="starter, pro, enterprise…"
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={editIndustry} onValueChange={setEditIndustry} disabled={patchMut.isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <SelectItem key={ind} value={ind} className="capitalize">
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                placeholder="Africa/Addis_Ababa"
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccy">Currency code</Label>
              <Input
                id="ccy"
                placeholder="ETB"
                maxLength={8}
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing provider</Label>
              <Select
                value={editBillingProvider}
                onValueChange={setEditBillingProvider}
                disabled={patchMut.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_PROVIDER_OPTIONS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-customer-id">Billing customer ID</Label>
              <Input
                id="billing-customer-id"
                placeholder="cus_... or external customer id"
                value={editBillingCustomerId}
                onChange={(e) => setEditBillingCustomerId(e.target.value)}
                disabled={patchMut.isPending}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/80 p-4">
            <Label className="text-base">Tenant announcement banner</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tenantAnnouncementEnabled}
                  onCheckedChange={setTenantAnnouncementEnabled}
                  disabled={patchMut.isPending}
                />
                <Label>Enabled</Label>
              </div>
              <div className="w-full sm:w-[220px]">
                <Select
                  value={tenantAnnouncementLevel}
                  onValueChange={(v) =>
                    setTenantAnnouncementLevel(v as "info" | "warning" | "maintenance")
                  }
                  disabled={patchMut.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">info</SelectItem>
                    <SelectItem value="warning">warning</SelectItem>
                    <SelectItem value="maintenance">maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-announcement-message">Message</Label>
              <Input
                id="tenant-announcement-message"
                value={tenantAnnouncementMessage}
                onChange={(e) => setTenantAnnouncementMessage(e.target.value)}
                placeholder="This tenant has planned downtime Sunday 02:00-03:00."
                disabled={patchMut.isPending}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-base">Modules enabled</Label>
            <p className="text-xs text-muted-foreground mb-4 mt-1">
              When gated in the API, disabled modules return 403 for that tenant.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {TENANT_MODULE_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/80 px-3 py-2"
                >
                  <span className="text-sm">{MODULE_LABELS[key]}</span>
                  <Switch
                    checked={editModules[key]}
                    onCheckedChange={(checked) =>
                      setEditModules((prev) => ({ ...prev, [key]: checked }))
                    }
                    disabled={patchMut.isPending}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                requestStepUp(
                  async () => {
                    await patchMut.mutateAsync();
                  },
                  {
                    title: "Confirm company settings update",
                    description: "Re-enter your password to save platform company settings.",
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save settings
                </>
              )}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Employees</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.employees}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Active staff members</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Products</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Package className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.products}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Inventory items logged</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Orders</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ShoppingCart className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.orders}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Sales orders processed</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Clients</CardTitle>
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <UserCircle className="h-4 w-4 text-pink-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.clients}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Customer accounts</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Invoices</CardTitle>
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="h-4 w-4 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.invoices}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Financial documents</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Purchase orders</CardTitle>
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <Truck className="h-4 w-4 text-teal-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{counts.purchaseOrders}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Procurement cycle count</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Users in this company
          </CardTitle>
          <CardDescription>
            Up to 150 employees (alphabetical). Use your HR module for full lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found for this tenant.</p>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead className="font-bold py-3">Staff Name</TableHead>
                  <TableHead className="font-bold py-3">Employee ID</TableHead>
                  <TableHead className="font-bold py-3">System Role</TableHead>
                  <TableHead className="font-bold py-3">Department</TableHead>
                  <TableHead className="font-bold py-3">Status</TableHead>
                  <TableHead className="font-bold py-3 text-right">Email Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow
                    key={u._id || `${u.employeeId}-${i}`}
                    ref={(el) => {
                      if (u._id) userRowRefs.current[String(u._id)] = el;
                    }}
                    className={`group transition-colors hover:bg-muted/30 border-b border-border/20 ${
                      highlightUserId && u._id && String(u._id) === highlightUserId
                        ? "bg-primary/5 ring-1 ring-primary/20"
                        : ""
                    }`}
                  >
                    <TableCell className="font-medium py-4">{u.name}</TableCell>
                    <TableCell className="font-mono text-[11px]">{u.employeeId}</TableCell>
                    <TableCell className="text-sm">{u.role}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.department || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold uppercase text-[10px] tracking-wider px-2 py-0.5">{u.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-right">{u.email || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
