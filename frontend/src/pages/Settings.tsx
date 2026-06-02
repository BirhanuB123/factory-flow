import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  auditApi,
  billingApi,
  ethiopiaTaxApi,
  hrOrgApi,
  hrEmployeesApi,
  type EthiopiaTaxSettings,
} from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  FileText,
  Copy,
  Search,
  Mail,
  Key,
  Edit2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import { useLocale } from "@/contexts/LocaleContext";
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

import { AuditLogPanel } from "@/components/AuditLogPanel";

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
  const { t } = useLocale();
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

  type HrEmployee = {
    _id?: string;
    employeeId?: string;
    name?: string;
    email?: string;
    role?: string;
    jobTitle?: string;
    department?: string;
    status?: "Active" | "On Leave" | "Offboarded" | string;
    accessRole?: string;
    position?: string;
    phone?: string;
    salary?: number;
    tinNumber?: string;
    pensionMemberId?: string;
    departmentId?: string | { _id?: string };
    positionId?: string | { _id?: string };
    managerId?: string;
    manager?: string | { _id?: string };
    [key: string]: unknown;
  };

  // Access tab queries and mutations
  const isAdmin = user?.role === "Admin" || user?.platformRole === "super_admin";

  const { data: employees = [], refetch: refetchEmployees, isLoading: employeesLoading } = useQuery<HrEmployee[]>({
    queryKey: ["settings-employees"],
    queryFn: async () => {
      const response = await api.get("/hr/employees");
      return response.data as HrEmployee[];
    },
    enabled: isAdmin,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["settings-departments"],
    queryFn: hrOrgApi.listDepartments,
    enabled: isAdmin,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["settings-positions"],
    queryFn: async () => hrOrgApi.listPositions(),
    enabled: isAdmin,
  });

  // State variables for user/role provisioning console
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isInviteDetailsOpen, setIsInviteDetailsOpen] = useState(false);

  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
    emailError?: string;
    employeeName: string;
  } | null>(null);

  const [newEmployee, setNewEmployee] = useState({
    employeeId: "",
    name: "",
    position: "", // maps to jobTitle
    accessRole: "employee",
    department: "",
    status: "Active" as "Active" | "On Leave" | "Offboarded",
    email: "",
    password: "",
    departmentId: "",
    positionId: "",
    managerId: "",
    salary: 0,
  });

  const [editingEmployee, setEditingEmployee] = useState<HrEmployee | null>(null);

  const handleAddEmployee = async () => {
    if (!newEmployee.employeeId || !newEmployee.name || !newEmployee.position || !newEmployee.department || !newEmployee.password) {
      toast.error("Please fill in all required fields, including employee ID, name, position, department, and password.");
      return;
    }

    try {
      const payload: Record<string, string | number | undefined> = {
        employeeId: newEmployee.employeeId,
        name: newEmployee.name,
        department: newEmployee.department,
        status: newEmployee.status,
        email: newEmployee.email || undefined,
        password: newEmployee.password,
        role: newEmployee.position, // position is sent as "role"
        departmentId: newEmployee.departmentId || undefined,
        positionId: newEmployee.positionId || undefined,
        manager: newEmployee.managerId || undefined,
        salary: Number(newEmployee.salary) || 0,
        accessRole: newEmployee.accessRole,
      };

      await api.post("/hr/employees", payload);
      toast.success("Personnel record initialized successfully.");
      setIsAddUserOpen(false);
      refetchEmployees();
      setNewEmployee({
        employeeId: "",
        name: "",
        position: "",
        accessRole: "employee",
        department: "",
        status: "Active",
        email: "",
        password: "",
        departmentId: "",
        positionId: "",
        managerId: "",
        salary: 0,
      });
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to add employee record.";
      toast.error(msg);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !editingEmployee._id) return;

    try {
      const payload = {
        name: editingEmployee.name,
        department: editingEmployee.department,
        status: editingEmployee.status,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        salary: editingEmployee.salary,
        jobTitle: editingEmployee.jobTitle,
        tinNumber: editingEmployee.tinNumber,
        pensionMemberId: editingEmployee.pensionMemberId,
        departmentId: editingEmployee.departmentId || null,
        positionId: editingEmployee.positionId || null,
        manager: editingEmployee.manager || null,
        accessRole: editingEmployee.role, // role maps to accessRole in the update endpoint
      };

      await api.put(`/hr/employees/${editingEmployee._id}`, payload);
      toast.success("Employee record updated successfully.");
      setIsEditUserOpen(false);
      refetchEmployees();
      setEditingEmployee(null);
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to update employee record.";
      toast.error(msg);
    }
  };

  const handleInviteEmployee = async (employeeId: string, employeeName: string) => {
    try {
      const response = await api.post(`/hr/employees/${employeeId}/invite`);
      const { inviteUrl, emailSent, emailError } = response.data;
      setInviteResult({
        inviteUrl,
        emailSent,
        emailError,
        employeeName,
      });
      setIsInviteDetailsOpen(true);
      if (emailSent) {
        toast.success("Invitation email sent successfully.");
      } else if (emailError) {
        toast.error(`Invitation generated, but email failed: ${emailError}`);
      } else {
        toast.success("One-time invite token generated successfully.");
      }
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to generate invite token.";
      toast.error(msg);
    }
  };

  const filteredEmployees = (employees || []).filter((emp: Record<string, unknown>) => {
    const q = employeeSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = String(emp.name || "").toLowerCase();
    const email = String(emp.email || "").toLowerCase();
    const employeeId = String(emp.employeeId || "").toLowerCase();
    const role = String(emp.role || "").toLowerCase();
    const jobTitle = String(emp.jobTitle || "").toLowerCase();
    return name.includes(q) || email.includes(q) || employeeId.includes(q) || role.includes(q) || jobTitle.includes(q);
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

  useEffect(() => {
    const syncDarkFromStorage = () => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { darkMode?: unknown };
        if (typeof saved.darkMode === "boolean") setDarkMode(saved.darkMode);
      } catch {
        // ignore
      }
    };
    window.addEventListener("erp-settings-updated", syncDarkFromStorage);
    return () => window.removeEventListener("erp-settings-updated", syncDarkFromStorage);
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

  const regionalLabel = timezone.split("/").pop() ?? timezone;
  const settingsHeroStats = [
    { label: "Core build", value: "1.2.0", icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
    { label: "Regional", value: regionalLabel, icon: Globe, color: "text-info", bg: "bg-info/10" },
    { label: "Currency", value: currency, icon: Percent, color: "text-success", bg: "bg-success/10" },
  ] as const;

  return (
    <>
      <div className="mx-auto max-w-[1600px] space-y-8 pb-8 animate-in fade-in duration-500">
        <section className="relative overflow-hidden rounded-[20px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.24),transparent_32%)]" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-7">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/80">
                <Sliders className="h-3.5 w-3.5" />
                Platform settings
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("pages.settings.title")}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/65">{t("pages.settings.subtitle")}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Core build", value: "1.2.0", tone: "text-sky-200" },
                  { label: "Regional", value: regionalLabel, tone: "text-amber-200" },
                  { label: "Currency", value: currency, tone: "text-emerald-200" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{item.label}</p>
                    <p className={`mt-1 truncate text-xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Configuration state</p>
                  <p className="mt-2 text-3xl font-black tracking-tight">Ready</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-white/55">
                    Local preferences, tenant controls, access, audit, tax, and document settings.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-emerald-400/15 text-emerald-200">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="h-10 gap-2 rounded-[12px] border-white/20 bg-white/10 px-5 font-semibold text-white shadow-none hover:bg-white hover:text-slate-950"
                >
                  <Globe className="h-4 w-4" />
                  Export data
                </Button>
                <Button onClick={handleSave} className="h-10 gap-2 rounded-[12px] bg-white px-5 font-semibold text-slate-950 shadow-sm hover:bg-white/90">
                  <Save className="h-4 w-4" />
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsHeroStats.map((stat, idx) => (
            <Card
              key={idx}
              className="group relative overflow-hidden rounded-[18px] border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-400" />
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${stat.bg} transition-transform duration-300 group-hover:scale-105`}
                >
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="shop" className="space-y-8">
          <Card className="group overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
            <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-1.5 w-10 rounded-full bg-primary/40" />
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-muted-foreground">
                  Data Sovereignty & Persistence
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="group/card flex gap-5 rounded-[16px] border border-border/60 bg-muted/20 p-6 transition-all hover:border-primary/30 hover:bg-primary/[0.03]">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-border/60 bg-card text-muted-foreground transition-all group-hover/card:border-primary/30 group-hover/card:text-primary">
                    <Globe className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {DEVICE_ONLY_LABEL}
                    </Badge>
                    <p className="pr-4 text-[13px] font-medium leading-relaxed text-muted-foreground">
                      Identity, notifications, and local preferences are stored in this browser's secure cache.
                    </p>
                  </div>
                </div>
                <div className="group/card flex gap-5 rounded-[16px] border border-primary/20 bg-primary/5 p-6 transition-all hover:bg-primary/10">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10 text-primary">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Badge variant="default" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {TENANT_WIDE_LABEL}
                    </Badge>
                    <p className="pr-4 text-[13px] font-medium leading-relaxed text-muted-foreground">
                      Access roles, compliance logs, and tax profiles are synchronized across all company nodes.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <StickyModuleTabs>
            <TabsList className={moduleTabsListClassName()}>
              <TabsTrigger value="shop" className={moduleTabsTriggerClassName()}>
                <Factory className="mr-2 h-4 w-4" />
                Company
              </TabsTrigger>
              <TabsTrigger value="user" className={moduleTabsTriggerClassName()}>
                <User className="mr-2 h-4 w-4" />
                Identity
              </TabsTrigger>
              <TabsTrigger value="notifications" className={moduleTabsTriggerClassName()}>
                <Bell className="mr-2 h-4 w-4" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="system" className={moduleTabsTriggerClassName()}>
                <Sliders className="mr-2 h-4 w-4" />
                System
              </TabsTrigger>
              <TabsTrigger value="access" className={moduleTabsTriggerClassName()}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Access
              </TabsTrigger>
              {canAudit && (
                <TabsTrigger value="audit" className={moduleTabsTriggerClassName()}>
                  <ListTree className="mr-2 h-4 w-4" />
                  Audit Log
                </TabsTrigger>
              )}
              {canFinance && (
                <TabsTrigger value="ethiopia-tax" className={moduleTabsTriggerClassName()}>
                  <Scale className="mr-2 h-4 w-4" />
                  Tax Profile
                </TabsTrigger>
              )}
              <TabsTrigger value="documents" className={moduleTabsTriggerClassName()}>
                <FileText className="mr-2 h-4 w-4" />
                Documents
              </TabsTrigger>
            </TabsList>
          </StickyModuleTabs>

          {/* Shop Configuration */}
          <TabsContent value="shop" className="space-y-8">
            {tenantSubscription && user?.platformRole !== "super_admin" && (
              <Card className="group overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
                <CardContent className="p-8">
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                          <div className="rounded-[14px] border border-primary/20 bg-primary/10 p-3">
                          <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                            Subscription Infrastructure
                          </p>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={subscriptionBadgeVariant(tenantSubscription.status)}
                              className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                            >
                              {subscriptionStatusLabel(tenantSubscription.status)}
                            </Badge>
                            <span className="text-xl font-black tracking-tight text-foreground">{tenantSubscription.displayName || shopName}</span>
                          </div>
                        </div>
                      </div>
                      {isSuspendedOrArchived && tenantSubscription.statusReason ? (
                        <div className="flex items-center gap-3 rounded-[14px] border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                          <Ban className="h-5 w-5" />
                          <p className="text-xs font-bold uppercase tracking-wider">{tenantSubscription.statusReason}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex min-w-[140px] flex-col gap-2 rounded-[14px] border border-border/60 bg-muted/20 px-6 py-4">
                          <span className="text-[10px] uppercase font-black text-muted-foreground/40 tracking-widest">Plan Tier</span>
                          <span className="text-base font-black uppercase tracking-wider text-foreground">
                            {tenantSubscription.plan || "starter"}
                          </span>
                        </div>
                        <div className="flex min-w-[160px] flex-col gap-2 rounded-[14px] border border-border/60 bg-muted/20 px-6 py-4">
                          <span className="text-[10px] uppercase font-black text-muted-foreground/40 tracking-widest">Cycle Reset</span>
                          <span className="font-bold text-foreground text-sm">
                            {trialDate ? trialDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 rounded-[14px] border border-border/60 bg-muted/25 px-4 py-2">
                          {tenantSubscription.status === "active" ? (
                            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                          <span className="font-black uppercase text-[10px] tracking-widest text-foreground/60">
                            {tenantSubscription.status === "trial" && trialDaysLeft != null ? (
                              isTrialExpired ? "Protocol Expired" : `${Math.max(0, trialDaysLeft)} Solar Days Remaining`
                            ) : tenantSubscription.status === "active" ? (
                              "Systems Nominal"
                            ) : (
                              "Action Required"
                            )}
                          </span>
                        </div>

                        {canSelfPaySubscription ? (
                          <Button
                            onClick={handlePayWithChapa}
                            disabled={startChapaCheckout.isPending || verifyChapaCheckout.isPending}
                            className="h-11 rounded-[12px] bg-primary px-6 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
                          >
                            {startChapaCheckout.isPending || verifyChapaCheckout.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              "Pay with Chapa"
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <Card className="xl:col-span-2 overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
                <CardHeader className="border-b border-border/50 bg-muted/25 p-8 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10 text-primary">
                        <Factory className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight">Company Profile</CardTitle>
                        <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Identity and contact ledger</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {DEVICE_ONLY_LABEL}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                  <div className="grid gap-8">
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Entity Nomenclature</Label>
                      <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold transition-all focus:bg-background" />
                    </div>
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Statutory Communication Endpoint</Label>
                      <Input type="email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold transition-all focus:bg-background" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Voice Frequency</Label>
                        <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold transition-all focus:bg-background" />
                      </div>
                      <div className="space-y-3">
                        <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Geographic Coordinates</Label>
                        <Input value={shopCity} onChange={(e) => setShopCity(e.target.value)} className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold transition-all focus:bg-background" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-8 xl:col-span-1">
                <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-sky-500 via-primary to-emerald-500" />
                  <CardHeader className="border-b border-border/50 bg-muted/25 p-8 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-blue-500/20 bg-blue-500/10 text-blue-500">
                          <Globe className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-black tracking-tight">Regional</CardTitle>
                          <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Localization preferences</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                        {DEVICE_ONLY_LABEL}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8 pt-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Temporal Alignment</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold shadow-none transition-all focus:bg-background">
                            <Clock className="h-4 w-4 mr-3 text-primary" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[14px] border-border/60 bg-card">
                            <SelectItem value="America/New_York" className="font-bold">Eastern (ET)</SelectItem>
                            <SelectItem value="America/Chicago" className="font-bold">Central (CT)</SelectItem>
                            <SelectItem value="America/Denver" className="font-bold">Mountain (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles" className="font-bold">Pacific (PT)</SelectItem>
                            <SelectItem value="America/Detroit" className="font-bold">Detroit (ET)</SelectItem>
                            <SelectItem value="Africa/Addis Ababa" className="font-bold">East Africa (EAT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Financial Vector</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold shadow-none transition-all focus:bg-background">
                            <Globe className="h-4 w-4 mr-3 text-primary" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[14px] border-border/60 bg-card">
                            <SelectItem value="ETB" className="font-bold">ETB (ETB) — default</SelectItem>
                            <SelectItem value="USD" className="font-bold">USD ($)</SelectItem>
                            <SelectItem value="EUR" className="font-bold">EUR (€)</SelectItem>
                            <SelectItem value="GBP" className="font-bold">GBP (£)</SelectItem>
                            <SelectItem value="CAD" className="font-bold">CAD (C$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Core Lexicon</Label>
                        <Select
                          value={uiLanguage}
                          onValueChange={(v) => setUiLanguage(v as "en" | "am" | "om")}
                        >
                          <SelectTrigger className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold shadow-none transition-all focus:bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[14px] border-border/60 bg-card">
                            <SelectItem value="en" className="font-bold">English</SelectItem>
                            <SelectItem value="am" className="font-bold">አማርኛ (Amharic)</SelectItem>
                            <SelectItem value="om" className="font-bold">Afaan Oromo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="group/item flex items-center justify-between rounded-[16px] border border-border/60 bg-muted/20 p-6 transition-all hover:bg-primary/[0.03]">
                        <div className="space-y-1">
                          <p className="text-[13px] font-black uppercase tracking-widest text-foreground">Ethiopian Era</p>
                          <p className="text-[11px] font-bold uppercase leading-relaxed text-muted-foreground">
                            Parallel Calendar Synthesis
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
              </div>
              <div className="space-y-8 xl:col-span-1">
                <Card className="group overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-emerald-500 via-primary to-sky-500" />
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between gap-6">
                      <div className="space-y-1.5">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground">Sync Protocol</p>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">
                          Local-to-Cloud Synchronization
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-[10px] bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                        Synchronized
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* User Preferences */}
          <TabsContent value="user" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
                <CardHeader className="border-b border-border/50 bg-muted/25 p-8 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10 text-primary">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight">Identity Profile</CardTitle>
                        <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Personal access ledger</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {DEVICE_ONLY_LABEL}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-10 space-y-8 pt-8">
                  <div className="grid gap-8">
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Personnel Nomenclature</Label>
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold transition-all focus:bg-background" />
                    </div>
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Authorization Tier</Label>
                      <Input value={role} disabled className="h-12 cursor-not-allowed rounded-[12px] border-border/40 bg-muted/20 px-5 text-[11px] font-black uppercase tracking-widest opacity-70" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                <div className="h-1 bg-gradient-to-r from-sky-500 via-primary to-emerald-500" />
                <CardHeader className="border-b border-border/50 bg-muted/25 p-8 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-blue-500/20 bg-blue-500/10 text-blue-500">
                        <Palette className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight">Interface</CardTitle>
                        <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Display and density preferences</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {DEVICE_ONLY_LABEL}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8 pt-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Temporal Format</Label>
                      <Select value={dateFormat} onValueChange={setDateFormat}>
                        <SelectTrigger className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold shadow-none transition-all focus:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[14px] border-border/60 bg-card">
                          <SelectItem value="YYYY-MM-DD" className="font-bold">2026-03-12</SelectItem>
                          <SelectItem value="MM/DD/YYYY" className="font-bold">03/12/2026</SelectItem>
                          <SelectItem value="DD/MM/YYYY" className="font-bold">12/03/2026</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="ml-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Default Viewmode</Label>
                      <Select value={defaultJobView} onValueChange={setDefaultJobView}>
                        <SelectTrigger className="h-12 rounded-[12px] border-border/60 bg-muted/20 px-5 text-sm font-bold shadow-none transition-all focus:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[14px] border-border/60 bg-card">
                          <SelectItem value="table" className="font-bold">Ledger Table</SelectItem>
                          <SelectItem value="kanban" className="font-bold">Kanban Grid</SelectItem>
                          <SelectItem value="calendar" className="font-bold">Temporal Grid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="group/item flex items-center justify-between rounded-[16px] border border-border/60 bg-muted/20 p-6 transition-all hover:bg-primary/[0.03]">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground">Compact Density</p>
                        <p className="text-[11px] font-bold uppercase leading-relaxed text-muted-foreground">
                          Optimize data-to-pixel ratio
                        </p>
                      </div>
                      <Switch checked={compactView} onCheckedChange={setCompactView} className="data-[state=checked]:bg-primary" />
                    </div>
                    <div className="group/item flex items-center justify-between rounded-[16px] border border-border/60 bg-muted/20 p-6 transition-all hover:bg-primary/[0.03]">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground">Dark Mode</p>
                        <p className="text-[11px] font-bold uppercase leading-relaxed text-muted-foreground">
                          Low-light environment optimization
                        </p>
                      </div>
                      <Switch checked={darkMode} onCheckedChange={setDarkMode} className="data-[state=checked]:bg-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-inner">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-black tracking-tight uppercase italic">Channels</CardTitle>
                      <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Alert delivery hubs</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6 pt-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-6 rounded-3xl border border-border/10 bg-secondary/10 group/item transition-all hover:bg-secondary/20 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground/80 italic">Email Ingress</p>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">
                          Asynchronous notification pipeline
                        </p>
                      </div>
                      <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} className="data-[state=checked]:bg-amber-500" />
                    </div>
                    <div className="flex items-center justify-between p-6 rounded-3xl border border-border/10 bg-secondary/10 group/item transition-all hover:bg-secondary/20 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground/80 italic">SMS Protocol</p>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">
                          Urgent cellular transmission
                        </p>
                      </div>
                      <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} className="data-[state=checked]:bg-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <Sliders className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-black tracking-tight uppercase italic">Operational Alerts</CardTitle>
                      <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Criticality triggers</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6 pt-8">
                  <div className="space-y-4">
                    {[
                      { label: "Inventory Criticality", sub: "Low stock/reorder point alerts", checked: lowStockAlerts, setter: setLowStockAlerts },
                      { label: "Job Lifecycle Update", sub: "Real-time production stage changes", checked: jobStatusAlerts, setter: setJobStatusAlerts },
                      { label: "Throughput Latency", sub: "Production delay & risk warnings", checked: delayAlerts, setter: setDelayAlerts },
                    ].map((alert, i) => (
                      <div key={i} className="flex items-center justify-between p-6 rounded-3xl border border-border/10 bg-secondary/10 group/item transition-all hover:bg-secondary/20 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-[13px] font-black uppercase tracking-widest text-foreground/80 italic">{alert.label}</p>
                          <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">{alert.sub}</p>
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
          <TabsContent value="system" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-black tracking-tight uppercase italic">Security & Backups</CardTitle>
                      <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Local data integrity controls</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6 pt-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-6 rounded-3xl border border-border/10 bg-secondary/10 group/item transition-all hover:bg-secondary/20 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground/80 italic">Auto Backup</p>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">
                          Periodic local state snapshots
                        </p>
                      </div>
                      <Switch checked={autoBackup} onCheckedChange={setAutoBackup} className="data-[state=checked]:bg-primary" />
                    </div>
                    <div className="flex items-center justify-between p-6 rounded-3xl border border-border/10 bg-secondary/10 group/item transition-all hover:bg-secondary/20 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[13px] font-black uppercase tracking-widest text-foreground/80 italic">Export Metadata</p>
                        <p className="text-[11px] font-bold text-muted-foreground/50 leading-relaxed uppercase tracking-tighter">
                          Download configuration vector (JSON)
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="h-10 rounded-2xl px-6 font-black uppercase text-[10px] tracking-widest border-border/40 bg-background/40 backdrop-blur-sm hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                      >
                        Initialize Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-8">
                <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                  <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight uppercase italic">Environment</CardTitle>
                        <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">System and runtime metadata</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6 pt-8">
                    <div className="grid grid-cols-2 gap-y-4 text-xs">
                      <p className="font-black uppercase tracking-widest text-muted-foreground/40">Core Revision</p>
                      <p className="text-primary text-right font-black uppercase tracking-widest italic">1.2.0-F_FLOW</p>
                      <p className="font-black uppercase tracking-widest text-muted-foreground/40">System Mode</p>
                      <p className="text-emerald-500 text-right font-black uppercase tracking-widest italic">Optimized Production</p>
                      <p className="font-black uppercase tracking-widest text-muted-foreground/40">Temporal Sync</p>
                      <p className="text-right font-bold text-foreground/70">March 16, 2026</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="group overflow-hidden rounded-2xl border-0 border-l-4 border-l-rose-500/70 bg-card shadow-erp">
                  <CardHeader className="p-8 pb-4 border-b border-rose-500/10 bg-rose-500/5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 shadow-inner">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight uppercase italic text-rose-600 dark:text-rose-400">Danger Zone</CardTitle>
                        <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-rose-700/60 dark:text-rose-300/60">Destructive actions</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-8">
                    <p className="text-xs font-bold text-rose-700/70 dark:text-rose-300/70 leading-relaxed uppercase tracking-tight max-w-[320px]">
                      Purge device-only local state and synchronize with fallback defaults.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReset}
                      className="w-full sm:w-auto h-12 rounded-2xl px-10 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-rose-500/20 hover:scale-[1.02] active:scale-95 transition-all bg-rose-600"
                    >
                      Reset Local State
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="access" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAdmin && (
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="p-10 pb-6 border-b border-border/10 bg-secondary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                        <User className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight uppercase italic text-foreground">Team User & Role Provisioning</CardTitle>
                        <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Manage administrative permissions, invite members, and edit credentials</CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => setIsAddUserOpen(true)}
                      className="rounded-2xl px-6 font-black uppercase tracking-widest text-[11px] bg-primary hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 h-12 bg-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Induct Personnel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-10 space-y-6">
                  {/* Search and stats bar */}
                  <div className="flex items-center gap-4 bg-background/20 rounded-2xl p-4 border border-border/5">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        type="text"
                        placeholder="Search team members by name, email, role, or ID..."
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        className="pl-11 h-12 bg-background/50 border-border/10 rounded-xl text-sm focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  {employeesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Personnel Registry...</p>
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-border/10 rounded-3xl bg-background/5">
                      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">No matching team members found</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[2rem] border border-border/10 bg-background/20 shadow-inner">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-secondary/40 border-b border-border/10 hover:bg-secondary/40">
                            <TableHead className="py-5 px-6 font-black uppercase tracking-[0.2em] text-[10px] text-foreground/75">Member Profile</TableHead>
                            <TableHead className="py-5 px-6 font-black uppercase tracking-[0.2em] text-[10px] text-foreground/75">Job Position</TableHead>
                            <TableHead className="py-5 px-6 font-black uppercase tracking-[0.2em] text-[10px] text-foreground/75">Permissions Role</TableHead>
                            <TableHead className="py-5 px-6 font-black uppercase tracking-[0.2em] text-[10px] text-foreground/75">System Status</TableHead>
                            <TableHead className="py-5 px-6 font-black uppercase tracking-[0.2em] text-[10px] text-foreground/75 text-right">Access Controls</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/5">
                          {filteredEmployees.map((emp: HrEmployee) => {
                            const showRole = emp.role || "employee";
                            const statusColor =
                              emp.status === "Active"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : emp.status === "On Leave"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-500 border-rose-500/20";

                            return (
                              <TableRow key={emp._id} className="group hover:bg-primary/5 transition-all">
                                <TableCell className="py-5 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-sm text-primary border border-primary/10">
                                      {(emp.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground group-hover:text-primary transition-all text-sm">{emp.name}</p>
                                      <p className="text-[11px] text-muted-foreground/60 font-semibold">{emp.email || "No email assigned"}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 px-6">
                                  <div>
                                    <p className="font-semibold text-xs text-foreground/80">{emp.jobTitle || emp.role || "Standard Staff"}</p>
                                    <p className="text-[9px] text-muted-foreground/50 font-black uppercase tracking-wider">{emp.department || "No Department"}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 px-6">
                                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-secondary/50 px-3 py-1 rounded-lg border-border/10">
                                    {showRole.replace("_", " ")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-5 px-6">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColor}`}>
                                    {emp.status}
                                  </span>
                                </TableCell>
                                <TableCell className="py-5 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingEmployee({
                                          _id: emp._id,
                                          employeeId: emp.employeeId,
                                          name: emp.name,
                                          department: emp.department,
                                          departmentId: typeof emp.departmentId === "string" ? emp.departmentId : emp.departmentId?._id || "",
                                          positionId: typeof emp.positionId === "string" ? emp.positionId : emp.positionId?._id || "",
                                          manager: typeof emp.manager === "string" ? emp.manager : emp.manager?._id || "",
                                          status: emp.status,
                                          email: emp.email || "",
                                          phone: emp.phone || "",
                                          salary: emp.salary || 0,
                                          jobTitle: emp.jobTitle || "",
                                          role: emp.role || "employee",
                                          tinNumber: emp.tinNumber || "",
                                          pensionMemberId: emp.pensionMemberId || "",
                                        });
                                        setIsEditUserOpen(true);
                                      }}
                                      className="h-8 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wider border-border/10 bg-secondary/20 hover:bg-secondary/40 text-foreground"
                                    >
                                      <Edit2 className="h-3 w-3 mr-1.5" />
                                      Edit Role
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleInviteEmployee(emp._id, emp.name)}
                                      className="h-8 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
                                    >
                                      <Key className="h-3 w-3 mr-1.5" />
                                      Invite / Reset
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
              <CardHeader className="p-10 pb-6 border-b border-border/10 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black tracking-tight uppercase italic text-foreground">Access Matrix</CardTitle>
                      <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Enterprise Role-Based Authorization Logic</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-lg border-none bg-primary/5 text-primary">
                    {TENANT_WIDE_LABEL}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-12">
                {permDoc && (
                  <div className="space-y-12">
                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="rounded-[2rem] border border-border/10 bg-background/30 p-8 space-y-4 group/item transition-all hover:bg-background/50 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1 italic">Active Authorization Node</p>
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl border border-primary/20 shadow-inner italic">
                            {permDoc.role.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-black uppercase tracking-tight italic text-foreground">{permDoc.role.replace('_', ' ')}</p>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1 opacity-60">Verified Credentials</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-[2rem] border border-border/10 bg-background/30 p-8 space-y-4 group/item transition-all hover:bg-background/50 shadow-sm overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1 italic">Scoped Capability Vectors</p>
                        <div className="flex flex-wrap gap-2">
                          {(permDoc.permissions || []).length > 0 ? (permDoc.permissions || []).slice(0, 10).map((p, idx) => (
                            <Badge key={idx} variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-secondary/30 border-border/10">
                              {p}
                            </Badge>
                          )) : <span className="text-xs font-bold text-muted-foreground/40 italic">No global scopes assigned</span>}
                          {(permDoc.permissions || []).length > 10 && <span className="text-[9px] font-black text-primary/40 ml-1">+{permDoc.permissions.length - 10} MORE</span>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-10 bg-primary/40 rounded-full" />
                          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Governance Topology</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-md border-primary/20 text-primary italic">Read Only Protocol</Badge>
                      </div>
                      <div className="overflow-hidden rounded-[2.5rem] border border-border/10 bg-background/20 shadow-inner">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-secondary/40 border-b border-border/10">
                              <th className="text-left py-6 px-10 font-black uppercase tracking-[0.3em] text-[10px] text-foreground/70">Structural Role</th>
                              <th className="text-left py-6 px-10 font-black uppercase tracking-[0.3em] text-[10px] text-foreground/70">Actionable Grants</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/5">
                            {(permDoc.matrix?.roles || []).map((r) => (
                              <tr key={r.role} className="group transition-all hover:bg-primary/5">
                                <td className="py-6 px-10 font-black uppercase tracking-tight italic text-base text-foreground/80 align-top whitespace-nowrap">{r.role.replace('_', ' ')}</td>
                                <td className="py-6 px-10">
                                  <div className="flex flex-wrap gap-2">
                                    {r.grants.map((grant, idx) => (
                                      <span key={idx} className="bg-background/40 border border-border/10 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm group-hover:border-primary/20 group-hover:text-foreground transition-all">
                                        {grant}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Employee Dialog */}
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogContent className="max-w-2xl bg-card border border-border/10 rounded-3xl overflow-hidden p-0 shadow-erp">
                <DialogHeader className="p-8 pb-4 bg-secondary/20 border-b border-border/5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-foreground">Induct Team User</DialogTitle>
                      <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-50">Create a new corporate account and assign system permissions</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Employee ID *</Label>
                    <Input
                      type="text"
                      placeholder="EMP-100"
                      value={newEmployee.employeeId}
                      onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
                      className="bg-background/50 border-border/10 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Full Name *</Label>
                    <Input
                      type="text"
                      placeholder="Abebe Bikila"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="bg-background/50 border-border/10 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email Address *</Label>
                    <Input
                      type="email"
                      placeholder="abebe@company.com"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      className="bg-background/50 border-border/10 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Temporary Password *</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newEmployee.password}
                      onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                      className="bg-background/50 border-border/10 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Permissions Role *</Label>
                    <Select
                      value={newEmployee.accessRole}
                      onValueChange={(val) => setNewEmployee({ ...newEmployee, accessRole: val })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                        <SelectValue placeholder="Select Access Role" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/10">
                        <SelectItem value="employee">Standard Employee</SelectItem>
                        <SelectItem value="hr_head">HR Head</SelectItem>
                        <SelectItem value="finance_head">Finance Head</SelectItem>
                        <SelectItem value="finance_viewer">Finance Viewer</SelectItem>
                        <SelectItem value="purchasing_head">Purchasing Head</SelectItem>
                        <SelectItem value="warehouse_head">Warehouse Head</SelectItem>
                        <SelectItem value="Admin">Company Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">System Status *</Label>
                    <Select
                      value={newEmployee.status}
                      onValueChange={(val: "Active" | "On Leave" | "Offboarded") => setNewEmployee({ ...newEmployee, status: val })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/10">
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Offboarded">Offboarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Org Department *</Label>
                    <Select
                      value={newEmployee.departmentId}
                      onValueChange={(val) => {
                        const d = (departments as Array<{ _id: string; name: string; code?: string }>).find(
                          (dept) => dept._id === val
                        );
                        setNewEmployee({
                          ...newEmployee,
                          departmentId: val,
                          department: d ? d.name : "",
                        });
                      }}
                    >
                      <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/10">
                        {(departments as Array<{ _id: string; name: string; code?: string }>).map((d) => (
                          <SelectItem key={d._id} value={d._id}>
                            {d.name} ({d.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Job Position / Title *</Label>
                    <Select
                      value={newEmployee.positionId}
                      onValueChange={(val) => {
                        const p = (positions as Array<{ _id: string; title: string; code?: string }>).find(
                          (pos) => pos._id === val
                        );
                        setNewEmployee({
                          ...newEmployee,
                          positionId: val,
                          position: p ? p.title : "",
                        });
                      }}
                    >
                      <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                        <SelectValue placeholder="Select Position" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/10">
                        {(positions as Array<{ _id: string; title: string; code?: string }>).map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.title} ({p.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Salary (ETB)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newEmployee.salary || ""}
                      onChange={(e) => setNewEmployee({ ...newEmployee, salary: Number(e.target.value) })}
                      className="bg-background/50 border-border/10 rounded-xl h-11"
                    />
                  </div>
                </div>
                <DialogFooter className="p-8 bg-secondary/10 border-t border-border/5 flex items-center justify-end gap-3 col-span-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddUserOpen(false)}
                    className="rounded-xl border-border/10 bg-background/55 text-[11px] font-black uppercase tracking-widest h-11 px-6 text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddEmployee}
                    className="rounded-xl bg-primary text-[11px] font-black uppercase tracking-widest h-11 px-8 hover:scale-[1.02] active:scale-95 transition-all text-white"
                  >
                    Induct User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Employee Dialog */}
            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
              <DialogContent className="max-w-2xl bg-card border border-border/10 rounded-3xl overflow-hidden p-0 shadow-erp">
                <DialogHeader className="p-8 pb-4 bg-secondary/20 border-b border-border/5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Edit2 className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-foreground">Edit User settings & Role</DialogTitle>
                      <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-50">Modify details, salary structures, status, and permissions</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                {editingEmployee && (
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Full Name *</Label>
                      <Input
                        type="text"
                        value={editingEmployee.name}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email Address *</Label>
                      <Input
                        type="email"
                        value={editingEmployee.email || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Phone Number</Label>
                      <Input
                        type="text"
                        value={editingEmployee.phone || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Permissions Role *</Label>
                      <Select
                        value={editingEmployee.role}
                        onValueChange={(val) => setEditingEmployee({ ...editingEmployee, role: val })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                          <SelectValue placeholder="Select Access Role" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/10">
                          <SelectItem value="employee">Standard Employee</SelectItem>
                          <SelectItem value="hr_head">HR Head</SelectItem>
                          <SelectItem value="finance_head">Finance Head</SelectItem>
                          <SelectItem value="finance_viewer">Finance Viewer</SelectItem>
                          <SelectItem value="purchasing_head">Purchasing Head</SelectItem>
                          <SelectItem value="warehouse_head">Warehouse Head</SelectItem>
                          <SelectItem value="Admin">Company Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">System Status *</Label>
                      <Select
                        value={editingEmployee.status}
                        onValueChange={(val: string) => setEditingEmployee({ ...editingEmployee, status: val })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/10">
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="On Leave">On Leave</SelectItem>
                          <SelectItem value="Offboarded">Offboarded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Org Department *</Label>
                      <Select
                        value={typeof editingEmployee.departmentId === "string" ? editingEmployee.departmentId : (editingEmployee.departmentId as { _id?: string } | undefined)?._id || ""}
                        onValueChange={(val) => {
                          const d = departments.find((dept: { _id?: string; name?: string; code?: string }) => dept._id === val);
                          setEditingEmployee({
                            ...editingEmployee,
                            departmentId: val,
                            department: d ? d.name : "",
                          });
                        }}
                      >
                        <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/10">
                          {departments.map((d: { _id?: string; name?: string; code?: string }) => (
                            <SelectItem key={d._id} value={d._id || ""}>
                              {d.name} ({d.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Job Position / Title *</Label>
                      <Select
                        value={typeof editingEmployee.positionId === "string" ? editingEmployee.positionId : (editingEmployee.positionId as { _id?: string } | undefined)?._id || ""}
                        onValueChange={(val) => {
                          const p = positions.find((pos: { _id?: string; title?: string; code?: string }) => pos._id === val);
                          setEditingEmployee({
                            ...editingEmployee,
                            positionId: val,
                            jobTitle: p ? p.title : "",
                          });
                        }}
                      >
                        <SelectTrigger className="bg-background/50 border-border/10 rounded-xl h-11">
                          <SelectValue placeholder="Select Position" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/10">
                          {positions.map((p: { _id?: string; title?: string; code?: string }) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.title} ({p.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Salary (ETB)</Label>
                      <Input
                        type="number"
                        value={editingEmployee.salary || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: Number(e.target.value) })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">TIN Number</Label>
                      <Input
                        type="text"
                        value={editingEmployee.tinNumber || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, tinNumber: e.target.value })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pension Member ID</Label>
                      <Input
                        type="text"
                        value={editingEmployee.pensionMemberId || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, pensionMemberId: e.target.value })}
                        className="bg-background/50 border-border/10 rounded-xl h-11"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter className="p-8 bg-secondary/10 border-t border-border/5 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditUserOpen(false);
                      setEditingEmployee(null);
                    }}
                    className="rounded-xl border-border/10 bg-background/55 text-[11px] font-black uppercase tracking-widest h-11 px-6 text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateEmployee}
                    className="rounded-xl bg-primary text-[11px] font-black uppercase tracking-widest h-11 px-8 hover:scale-[1.02] active:scale-95 transition-all text-white"
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Invite Details Dialog */}
            <Dialog open={isInviteDetailsOpen} onOpenChange={setIsInviteDetailsOpen}>
              <DialogContent className="max-w-md bg-card border border-border/10 rounded-3xl overflow-hidden p-0 shadow-erp">
                <DialogHeader className="p-8 pb-4 bg-secondary/20 border-b border-border/5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Key className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-foreground">Invite / Reset Link</DialogTitle>
                      <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-50">One-time security credentials generated for the member</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                {inviteResult && (
                  <div className="p-8 space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        A one-time invitation link has been successfully generated for <strong className="text-foreground">{inviteResult.employeeName}</strong>. 
                        This link expires in 7 days.
                      </p>
                      {inviteResult.emailSent ? (
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 mt-2 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                          <Mail className="h-4 w-4" />
                          Emailed successfully to user!
                        </p>
                      ) : inviteResult.emailError ? (
                        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5 mt-2 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                          <Mail className="h-4 w-4" />
                          Mail dispatch failed: {inviteResult.emailError}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5 mt-2 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                          <Mail className="h-4 w-4" />
                          SMTP not configured. Please copy the link below.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Invitation URL</Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          readOnly
                          value={inviteResult.inviteUrl}
                          className="bg-background border-border/10 rounded-xl h-11 text-xs select-all flex-1"
                        />
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(inviteResult.inviteUrl);
                            toast.success("Link copied to clipboard!");
                          }}
                          className="h-11 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground px-4 flex items-center justify-center border border-border/10"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter className="p-8 bg-secondary/10 border-t border-border/5 flex items-center justify-end">
                  <Button
                    onClick={() => {
                      setIsInviteDetailsOpen(false);
                      setInviteResult(null);
                    }}
                    className="rounded-xl bg-primary text-[11px] font-black uppercase tracking-widest h-11 px-8 hover:scale-[1.02] active:scale-95 transition-all text-white"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {canAudit && (
            <TabsContent value="audit" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <CardHeader className="p-10 pb-6 border-b border-border/10 bg-secondary/20">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner">
                      <ListTree className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black tracking-tight uppercase italic text-foreground">Audit Trail</CardTitle>
                      <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Compliance-Ready Immutable Activity Stream</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-10 pt-10">
                  <AuditLogPanel />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canFinance && (
            <TabsContent value="ethiopia-tax" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500/50 via-primary/50 to-emerald-500/50" />
                <CardHeader className="p-10 pb-6 border-b border-border/10 bg-secondary/20 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,hsl(var(--primary)/0.05),transparent)] pointer-events-none" />
                  <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-inner">
                        <Scale className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-2xl font-black tracking-tight uppercase italic text-foreground text-amber-600 dark:text-amber-500">Tax Profile</CardTitle>
                          <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-md border-none bg-amber-500/10 text-amber-600">
                            {TENANT_WIDE_LABEL}
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Legal Sovereignty & Statutory Compliance</CardDescription>
                      </div>
                    </div>
                    {canEditEthTax && (
                      <Button
                        onClick={() => saveEthTax.mutate()}
                        disabled={saveEthTax.isPending || ethTaxLoading}
                        className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 bg-primary hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        {saveEthTax.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Commit Statutory Preferences
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-10 space-y-12">
                  {ethTaxLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20">
                      <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Synchronizing with Revenue Authority…</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                        <div className="xl:col-span-2 space-y-10">
                          <section className="space-y-6">
                            <div className="flex items-center gap-3 ml-1">
                              <div className="h-1.5 w-10 bg-amber-500/40 rounded-full" />
                              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Legal Entity Architecture</p>
                            </div>
                            <div className="rounded-[2rem] border border-border/10 bg-background/30 p-8 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-sm">
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Statutory Nomenclature</Label>
                                <Input
                                  disabled={!canEditEthTax}
                                  value={ethForm.companyLegalName ?? ""}
                                  onChange={(e) => setEthForm((p) => ({ ...p, companyLegalName: e.target.value }))}
                                  className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-5"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Company TIN</Label>
                                <Input
                                  disabled={!canEditEthTax}
                                  value={ethForm.companyTIN ?? ""}
                                  onChange={(e) => setEthForm((p) => ({ ...p, companyTIN: e.target.value }))}
                                  className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-sm px-5 font-bold tracking-widest"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Registered Physical Node</Label>
                                <Textarea
                                  disabled={!canEditEthTax}
                                  value={ethForm.companyAddress ?? ""}
                                  onChange={(e) => setEthForm((p) => ({ ...p, companyAddress: e.target.value }))}
                                  className="rounded-[1.5rem] min-h-[100px] bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm p-6 resize-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Voice Endpoint</Label>
                                <Input
                                  disabled={!canEditEthTax}
                                  value={ethForm.companyPhone ?? ""}
                                  onChange={(e) => setEthForm((p) => ({ ...p, companyPhone: e.target.value }))}
                                  className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm px-5"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Economic Vector</Label>
                                <Input
                                  disabled={!canEditEthTax}
                                  value={ethForm.currency ?? "ETB"}
                                  onChange={(e) => setEthForm((p) => ({ ...p, currency: e.target.value }))}
                                  className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-sm px-5 font-bold"
                                />
                              </div>
                            </div>
                          </section>

                          <section className="space-y-6">
                            <div className="flex items-center gap-3 ml-1">
                              <div className="h-1.5 w-10 bg-primary/40 rounded-full" />
                              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Sequential Ledger Protocols</p>
                            </div>
                            <div className="rounded-[2rem] border border-border/10 bg-background/30 p-10 space-y-8 shadow-sm">
                              <div className="flex items-center gap-5 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                                <div className="h-12 w-12 rounded-xl bg-background/50 flex items-center justify-center text-primary shadow-inner">
                                  <Hash className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Successive Cycle Identification</p>
                                  <p className="text-sm font-bold text-foreground italic uppercase">
                                    Vector State: <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded ml-2">
                                      {(ethForm.invoiceSeriesPrefix ?? "INV").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20) || "INV"}
                                      -{String((ethForm.nextInvoiceSequence ?? 0) + 1).padStart(6, "0")}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                  <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Series Taxonomy</Label>
                                  <Input
                                    disabled={!canEditEthTax}
                                    value={ethForm.invoiceSeriesPrefix ?? "INV"}
                                    onChange={(e) =>
                                      setEthForm((p) => ({ ...p, invoiceSeriesPrefix: e.target.value }))
                                    }
                                    placeholder="INV"
                                    className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-sm px-5 font-bold uppercase"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/40 ml-1 italic">Entropy Index (Last Committed)</Label>
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
                                    className="h-12 rounded-2xl bg-secondary/30 border-border/10 focus:bg-background transition-all font-mono text-sm px-5 font-bold tabular-nums"
                                  />
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>

                        <div className="xl:col-span-1 space-y-10">
                          <section className="space-y-6">
                            <div className="flex items-center gap-3 ml-1">
                              <div className="h-1.5 w-10 bg-emerald-500/40 rounded-full" />
                              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Ratio Coefficients</p>
                            </div>
                            <div className="rounded-[2.5rem] border border-border/10 bg-background/30 p-10 space-y-8 shadow-sm relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                                <Percent className="h-40 w-40" />
                              </div>
                              <div className="relative space-y-8">
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1 italic">Value-Added Tax (%)</Label>
                                  <Input
                                    type="number"
                                    disabled={!canEditEthTax}
                                    value={ethForm.defaultVatRatePercent ?? 15}
                                    onChange={(e) =>
                                      setEthForm((p) => ({ ...p, defaultVatRatePercent: parseFloat(e.target.value) || 0 }))
                                    }
                                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 transition-all font-black text-xl px-6 shadow-inner text-primary"
                                  />
                                </div>
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1 italic">Sales Withholding (%)</Label>
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
                                    className="h-14 rounded-2xl bg-secondary/30 border-border/10 transition-all font-black text-xl px-6 shadow-inner text-primary"
                                  />
                                </div>
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1 italic">Withholding Basis</Label>
                                  <Select
                                    disabled={!canEditEthTax}
                                    value={ethForm.salesWhtBase ?? "taxable_excl_vat"}
                                    onValueChange={(v) => setEthForm((p) => ({ ...p, salesWhtBase: v }))}
                                  >
                                    <SelectTrigger className="h-12 rounded-2xl bg-secondary/30 border-border/10 font-bold text-[11px] uppercase tracking-widest px-5 shadow-none">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/20 backdrop-blur-2xl bg-card/90">
                                      <SelectItem value="taxable_excl_vat" className="font-bold">Taxable (Excl. VAT)</SelectItem>
                                      <SelectItem value="total_incl_vat" className="font-bold">Total (Incl. VAT)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </section>

                          <section className="rounded-[2.5rem] border border-amber-500/20 bg-amber-500/5 p-8 space-y-6">
                            <div className="flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <p className="text-[13px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 italic">VAT Registry</p>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter leading-tight">Statutory Registration Status</p>
                              </div>
                              <Switch
                                disabled={!canEditEthTax}
                                checked={ethForm.sellerVatRegistered !== false}
                                onCheckedChange={(c) => setEthForm((p) => ({ ...p, sellerVatRegistered: c }))}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80">
                              REGISTRATION STATUS DETERMINES OUTPUT VAT CALCULATION LOGIC ACROSS THE FISCAL DOMAIN.
                            </p>
                          </section>
                        </div>
                      </div>

                      <section className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 ml-1">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-10 bg-indigo-500/40 rounded-full" />
                            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Categorical WHT Calibration</p>
                          </div>
                          {canEditEthTax && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 px-6 rounded-xl border border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all font-bold"
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
                              <Plus className="h-3.5 w-3.5 mr-2 stroke-[3]" />
                              Inject Category Node
                            </Button>
                          )}
                        </div>
                        <div className="rounded-[2.5rem] border border-border/10 overflow-hidden shadow-inner bg-background/20">
                          <Table>
                            <TableHeader className="bg-secondary/40 border-b border-border/10">
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-6 px-10 text-foreground/60">Category Key</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-6 px-10 text-foreground/60">Nomenclature</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-6 px-10 text-foreground/60">Sales Coefficient (%)</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] py-6 px-10 text-foreground/60">Purchase Coefficient (%)</TableHead>
                                {canEditEthTax && (
                                  <TableHead className="w-20 px-10 text-right font-black uppercase text-[10px] tracking-widest text-foreground/60">Logic</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(ethForm.whtCategoryRates ?? []).length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={canEditEthTax ? 5 : 4} className="py-20 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                                      <Tags className="h-12 w-12" />
                                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">No categorical overrides detected</p>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                (ethForm.whtCategoryRates ?? []).map((row, i) => (
                                  <TableRow key={i} className="group transition-all hover:bg-primary/5 border-b border-border/5 last:border-0">
                                    <TableCell className="py-5 px-10">
                                      <Input
                                        disabled={!canEditEthTax}
                                        className="h-10 rounded-xl bg-secondary/30 border-border/10 font-mono text-[11px] px-4 font-bold uppercase transition-all focus:bg-background"
                                        value={row.key}
                                        onChange={(e) =>
                                          setEthForm((p) => {
                                            const next = [...(p.whtCategoryRates ?? [])];
                                            next[i] = { ...next[i], key: e.target.value };
                                            return { ...p, whtCategoryRates: next };
                                          })
                                        }
                                        placeholder="NODE_KEY"
                                      />
                                    </TableCell>
                                    <TableCell className="py-5 px-10">
                                      <Input
                                        disabled={!canEditEthTax}
                                        className="h-10 rounded-xl bg-secondary/30 border-border/10 font-bold text-[11px] px-4 italic transition-all focus:bg-background"
                                        value={row.label ?? ""}
                                        onChange={(e) =>
                                          setEthForm((p) => {
                                            const next = [...(p.whtCategoryRates ?? [])];
                                            next[i] = { ...next[i], label: e.target.value };
                                            return { ...p, whtCategoryRates: next };
                                          })
                                        }
                                        placeholder="Display Label"
                                      />
                                    </TableCell>
                                    <TableCell className="py-5 px-10">
                                      <Input
                                        type="number"
                                        disabled={!canEditEthTax}
                                        className="h-10 rounded-xl bg-secondary/30 border-border/10 font-black text-base px-4 text-primary transition-all focus:bg-background"
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
                                    <TableCell className="py-5 px-10">
                                      <Input
                                        type="number"
                                        disabled={!canEditEthTax}
                                        className="h-10 rounded-xl bg-secondary/30 border-border/10 font-black text-base px-4 text-primary transition-all focus:bg-background"
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
                                      <TableCell className="py-5 px-10 text-right">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-10 w-10 rounded-xl text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
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

                      <section className="space-y-4">
                        <div className="flex items-center gap-3 ml-1">
                          <div className="h-1.5 w-10 bg-muted-foreground/20 rounded-full" />
                          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground/50 italic">Statutory Reporting Constraints</p>
                        </div>
                        <Textarea
                          disabled={!canEditEthTax}
                          value={ethForm.eInvoicingNotes ?? ""}
                          onChange={(e) => setEthForm((p) => ({ ...p, eInvoicingNotes: e.target.value }))}
                          placeholder="Internal reminders for digital reporting, EFD integration, or accountant handoff…"
                          className="rounded-[2rem] min-h-[120px] bg-secondary/30 border-border/10 focus:bg-background transition-all font-bold text-sm p-6 resize-none"
                        />
                      </section>

                      {canEditEthTax && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-10 border-t border-border/10">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight max-w-sm leading-relaxed">
                              CHANGES TO FISCAL PARAMETERS WILL INFLUENCE ALL SUBSEQUENT LEDGER ENTRIES. PLEASE ENSURE ACCURACY.
                            </p>
                          </div>
                          <Button
                            onClick={() => saveEthTax.mutate()}
                            disabled={saveEthTax.isPending}
                            className="h-14 px-12 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-primary/20 bg-primary hover:scale-[1.02] active:scale-95 transition-all"
                          >
                            {saveEthTax.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-5 w-5 mr-3" />
                                Synchronize Fiscal State
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

          <TabsContent value="documents" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
              <CardHeader className="p-8 pb-4 border-b border-border/10 bg-secondary/20">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500 shadow-inner">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight uppercase italic">Document Branding</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">Visual identity for Invoices & POs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-10">
                <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
                  <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20">
                    <Palette className="h-10 w-10 text-primary/40" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-bold">Custom Template Engine</h3>
                    <p className="text-sm text-muted-foreground italic">
                      Adjust your company logo, primary theme colors, and custom headers for all generated business documents.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/document-templates')}
                    className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                  >
                    Open Template Editor
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
