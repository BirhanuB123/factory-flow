import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Users,
  Edit2,
  Calendar,
  DollarSign,
  Clock,
  Download,
  FileText,
  Play,
  BookOpen,
  Lock,
  Check,
  X,
} from "lucide-react";
import { LoadingLogo } from "@/components/ui/LoadingLogo";
import {
  hrPayrollApi,
  hrLeaveApi,
  hrAttendanceApi,
  hrAttendanceCorrectionApi,
  hrOrgApi,
  downloadPayrollPensionCsv,
  downloadPayrollIncomeTaxCsv,
  openPayrollPayslipHtml,
  type PayrollPrepareRow,
  type PayrollMonthStatus,
  type HrLeaveRow,
  type AttendanceCorrectionRow,
  type HrDepartmentRow,
  type HrPositionRow,
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import { useMemo, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HrMetrics } from "@/components/HrMetrics";
import { useCurrency } from "@/hooks/use-currency";
import { useLocale } from "@/contexts/LocaleContext";

type EmploymentStatus = "Active" | "On Leave" | "Offboarded";

const APP_ACCESS_ROLES = [
  "employee",
  "hr_head",
  "finance_head",
  "purchasing_head",
  "warehouse_head",
  "Admin",
] as const;

const PAYROLL_FINANCE_ROLES = new Set(["Admin", "hr_head", "finance_head"]);

type Employee = {
  _id?: string;
  id: string;
  name: string;
  /** Job title / position (display) */
  position: string;
  /** App login role (permissions) */
  appRole: string;
  department: string;
  status: EmploymentStatus;
  email?: string;
  phone?: string;
  salary?: number;
  tinNumber?: string;
  pensionMemberId?: string;
  managerId?: string | null;
  managerName?: string;
  departmentId?: string | null;
  positionId?: string | null;
};

const statusVariant: Record<EmploymentStatus, "success" | "warning" | "secondary"> = {
  Active: "success",
  "On Leave": "warning",
  Offboarded: "secondary",
};

const seedEmployees: Employee[] = [
  { id: "EMP-001", name: "Aarav Sharma", position: "CNC Operator", appRole: "employee", department: "Production", status: "Active" },
  { id: "EMP-002", name: "Neha Patel", position: "Quality Inspector", appRole: "employee", department: "QA", status: "On Leave" },
  { id: "EMP-003", name: "Vikram Singh", position: "Maintenance Tech", appRole: "employee", department: "Maintenance", status: "Active" },
];

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "") + "/hr";

export default function Hr() {
  const { t } = useLocale();
  const { format } = useCurrency();
  const { token, user, isLoading: authLoading } = useAuth();
  const [q, setQ] = useState("");
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    employeeId: "",
    name: "",
    position: "",
    accessRole: "employee" as string,
    department: "",
    status: "Active" as EmploymentStatus,
    email: "",
    password: "",
    departmentId: "",
    positionId: "",
    managerId: "",
    salary: 0,
  });
  const [departments, setDepartments] = useState<HrDepartmentRow[]>([]);
  const [positions, setPositions] = useState<HrPositionRow[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [newDepartment, setNewDepartment] = useState({ code: "", name: "", description: "" });
  const [newPosition, setNewPosition] = useState({
    code: "",
    title: "",
    department: "",
    reportsToPosition: "",
  });
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceCorrections, setAttendanceCorrections] = useState<
    Array<AttendanceCorrectionRow & { employee?: { _id: string; name: string; employeeId: string; department?: string } }>
  >([]);
  const [leaves, setLeaves] = useState<HrLeaveRow[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attCorrectionLoading, setAttCorrectionLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveActionLoading, setLeaveActionLoading] = useState(false);
  const [selectedLeaveEmployeeId, setSelectedLeaveEmployeeId] = useState<string>("");
  const [selectedLeaveYear, setSelectedLeaveYear] = useState<number>(new Date().getFullYear());
  const [leaveBalance, setLeaveBalance] = useState<null | {
    employee: { _id: string; employeeId: string; name: string };
    year: number;
    balances: Record<string, { entitlement: number | null; used: number; remaining: number | null }>;
  }>(null);
  const [newLeave, setNewLeave] = useState({
    employee: "",
    leaveType: "annual" as HrLeaveRow["leaveType"],
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [payLoading, setPayLoading] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payRunLoading, setPayRunLoading] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [prepareLoading, setPrepareLoading] = useState(false);
  const [prepareHint, setPrepareHint] = useState<string | null>(null);
  const [runGrid, setRunGrid] = useState<PayrollPrepareRow[]>([]);
  const [payrollMonthStatus, setPayrollMonthStatus] = useState<PayrollMonthStatus | null>(null);
  const [payrollActionLoading, setPayrollActionLoading] = useState(false);

  const { toast } = useToast();
  const canPostOrClosePayroll = !!(user?.role && PAYROLL_FINANCE_ROLES.has(user.role));
  const payrollMonthLocked = !!(payrollMonthStatus?.closed && user?.role !== "Admin");

  useEffect(() => {
    if (authLoading || !token) return;
    fetchEmployees();
    fetchAttendance();
    fetchLeaves();
    fetchOrg();
    fetchAttendanceCorrections();
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading || !token) return;
    fetchPayroll(payrollMonth);
  }, [authLoading, token, payrollMonth]);

  const fetchAttendance = async () => {
    setAttLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    } finally {
      setAttLoading(false);
    }
  };

  const fetchAttendanceCorrections = async () => {
    setAttCorrectionLoading(true);
    try {
      const rows = await hrAttendanceCorrectionApi.list();
      setAttendanceCorrections(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to fetch attendance corrections:", error);
      setAttendanceCorrections([]);
    } finally {
      setAttCorrectionLoading(false);
    }
  };

  const fetchLeaves = async () => {
    setLeaveLoading(true);
    try {
      const data = await hrLeaveApi.list();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch leaves:", error);
      toast({
        title: "Leave load failed",
        description: "Could not load leave requests.",
        variant: "destructive",
      });
      setLeaves([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  const fetchOrg = async () => {
    setOrgLoading(true);
    try {
      const [deps, pos] = await Promise.all([
        hrOrgApi.listDepartments(),
        hrOrgApi.listPositions(),
      ]);
      setDepartments(Array.isArray(deps) ? deps : []);
      setPositions(Array.isArray(pos) ? pos : []);
    } catch (error) {
      console.error("Failed to fetch org data:", error);
      setDepartments([]);
      setPositions([]);
    } finally {
      setOrgLoading(false);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDepartment.code.trim() || !newDepartment.name.trim()) {
      toast({ title: "Department code and name required", variant: "destructive" });
      return;
    }
    try {
      await hrOrgApi.createDepartment({
        code: newDepartment.code.trim(),
        name: newDepartment.name.trim(),
        description: newDepartment.description.trim(),
      });
      toast({ title: "Department created" });
      setNewDepartment({ code: "", name: "", description: "" });
      await fetchOrg();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Create department failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleCreatePosition = async () => {
    if (!newPosition.code.trim() || !newPosition.title.trim()) {
      toast({ title: "Position code and title required", variant: "destructive" });
      return;
    }
    try {
      await hrOrgApi.createPosition({
        code: newPosition.code.trim(),
        title: newPosition.title.trim(),
        department: newPosition.department || null,
        reportsToPosition: newPosition.reportsToPosition || null,
      });
      toast({ title: "Position created" });
      setNewPosition({ code: "", title: "", department: "", reportsToPosition: "" });
      await fetchOrg();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Create position failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const loadLeaveBalance = async (employeeId: string, year = selectedLeaveYear) => {
    if (!employeeId) return;
    try {
      const data = await hrLeaveApi.balance(employeeId, year);
      setLeaveBalance(data);
    } catch {
      setLeaveBalance(null);
      toast({
        title: "Balance load failed",
        variant: "destructive",
      });
    }
  };

  const handleCreateLeave = async () => {
    if (!newLeave.employee || !newLeave.startDate || !newLeave.endDate) {
      toast({
        title: "Missing fields",
        description: "Select employee and leave dates.",
        variant: "destructive",
      });
      return;
    }
    setLeaveActionLoading(true);
    try {
      await hrLeaveApi.create(newLeave);
      toast({ title: "Leave request created" });
      setNewLeave((s) => ({ ...s, startDate: "", endDate: "", reason: "" }));
      await fetchLeaves();
      if (selectedLeaveEmployeeId) {
        await loadLeaveBalance(selectedLeaveEmployeeId);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Create leave failed";
      toast({ title: "Create failed", description: msg, variant: "destructive" });
    } finally {
      setLeaveActionLoading(false);
    }
  };

  const handleReviewLeave = async (
    leaveId: string,
    status: "approved" | "rejected" | "cancelled"
  ) => {
    setLeaveActionLoading(true);
    try {
      await hrLeaveApi.review(leaveId, { status });
      toast({ title: `Leave ${status}` });
      await fetchLeaves();
      if (selectedLeaveEmployeeId) {
        await loadLeaveBalance(selectedLeaveEmployeeId);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Leave review failed";
      toast({ title: "Review failed", description: msg, variant: "destructive" });
    } finally {
      setLeaveActionLoading(false);
    }
  };

  const handleAttendanceOvertimeReview = async (
    attendanceId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      await hrAttendanceApi.reviewOvertime(attendanceId, { status });
      toast({ title: `Overtime ${status}` });
      await fetchAttendance();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Overtime review failed";
      toast({ title: "Overtime review failed", description: msg, variant: "destructive" });
    }
  };

  const handleReviewAttendanceCorrection = async (
    id: string,
    status: "approved" | "rejected" | "cancelled"
  ) => {
    try {
      await hrAttendanceCorrectionApi.review(id, { status });
      toast({ title: `Correction ${status}` });
      await Promise.all([fetchAttendanceCorrections(), fetchAttendance()]);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Correction review failed";
      toast({ title: "Review failed", description: msg, variant: "destructive" });
    }
  };

  const fetchPayroll = async (month: string) => {
    setPayLoading(true);
    try {
      const data = await hrPayrollApi.list(month);
      setPayroll(Array.isArray(data) ? data : []);
      try {
        const st = await hrPayrollApi.monthStatus(month);
        setPayrollMonthStatus(st);
      } catch {
        setPayrollMonthStatus(null);
      }
    } catch (error) {
      console.error("Failed to fetch payroll:", error);
      toast({
        title: "Payroll load failed",
        description: "Log in as Admin, HR, or Finance. Check network.",
        variant: "destructive",
      });
      setPayroll([]);
      setPayrollMonthStatus(null);
    } finally {
      setPayLoading(false);
    }
  };

  async function loadPayrollPrepare() {
    if (!payrollMonth) return;
    setPrepareLoading(true);
    setPrepareHint(null);
    try {
      const d = await hrPayrollApi.prepare(payrollMonth);
      setRunGrid(d.rows);
      setPrepareHint(d.hint);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not load staff list.";
      toast({ title: "Prepare failed", description: msg, variant: "destructive" });
    } finally {
      setPrepareLoading(false);
    }
  }

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const app = new Set(APP_ACCESS_ROLES);
        if (data.length > 0) {
          setEmployees(
            data.map((e: any) => {
              const ar = app.has(e.role) ? e.role : "employee";
              const pos =
                e.jobTitle || (app.has(e.role) ? "" : e.role) || "—";
              return {
                _id: e._id,
                id: e.employeeId,
                name: e.name,
                position: pos,
                appRole: ar,
                department: e.department,
                status: e.status,
                email: e.email,
                phone: e.phone,
                salary: e.salary,
                tinNumber: e.tinNumber,
                pensionMemberId: e.pensionMemberId,
                managerId: e.manager?._id || e.manager || null,
                managerName: e.manager?.name || "",
                departmentId: e.departmentId?._id || e.departmentId || null,
                positionId: e.positionId?._id || e.positionId || null,
              };
            })
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!token) {
      toast({
        title: "Session expired",
        description: "Log in again, then add staff.",
        variant: "destructive",
      });
      return;
    }
    if (!newEmployee.employeeId || !newEmployee.name || !newEmployee.position || !newEmployee.department || !newEmployee.password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields, including a security password.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        employeeId: newEmployee.employeeId,
        name: newEmployee.name,
        department: newEmployee.department,
        status: newEmployee.status,
        email: newEmployee.email || undefined,
        password: newEmployee.password,
        role: newEmployee.position,
        departmentId: newEmployee.departmentId || undefined,
        positionId: newEmployee.positionId || undefined,
        manager: newEmployee.managerId || undefined,
        salary: Number(newEmployee.salary) || 0,
      };
      if (user?.role === "Admin") {
        payload.accessRole = newEmployee.accessRole;
      }

      const response = await fetch(`${API_BASE}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employee added successfully.",
        });
        setIsDialogOpen(false);
        fetchEmployees();
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
      } else {
        const data = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: data.message || data.error || "Failed to add employee.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !editingEmployee._id) return;

    try {
      const body: Record<string, unknown> = {
        name: editingEmployee.name,
        department: editingEmployee.department,
        status: editingEmployee.status,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        salary: editingEmployee.salary,
        jobTitle: editingEmployee.position,
        tinNumber: editingEmployee.tinNumber,
        pensionMemberId: editingEmployee.pensionMemberId,
        departmentId: editingEmployee.departmentId || null,
        positionId: editingEmployee.positionId || null,
        manager: editingEmployee.managerId || null,
      };
      if (user?.role === "Admin") {
        body.accessRole = editingEmployee.appRole;
      }

      const response = await fetch(`${API_BASE}/employees/${editingEmployee._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employee updated successfully.",
        });
        setIsEditDialogOpen(false);
        fetchEmployees();
        setEditingEmployee(null);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to update employee.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during update.",
        variant: "destructive",
      });
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((e) => {
      return (
        e.id.toLowerCase().includes(query) ||
        e.name.toLowerCase().includes(query) ||
        e.position.toLowerCase().includes(query) ||
        e.appRole.toLowerCase().includes(query) ||
        e.department.toLowerCase().includes(query) ||
        e.status.toLowerCase().includes(query)
      );
    });
  }, [q, employees]);

  const totalPayroll = useMemo(() => {
    return employees.reduce((acc, e) => acc + (e.salary || 0), 0);
  }, [employees]);
  const pendingLeaveCount = useMemo(
    () => leaves.filter((l) => l.status === "pending").length,
    [leaves]
  );

  const activeCount = employees.filter(e => e.status === "Active").length;
  const leaveCount = employees.filter(e => e.status === "On Leave").length;
  const attendanceRateVal = attendance.length > 0 
    ? Math.round((attendance.filter(a => a.status === "Present").length / attendance.length) * 100)
    : 94; // fallback mockup value

  return (
    <>
      <div className="space-y-8 pb-8 animate-in fade-in duration-500">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.hr.title")}</h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">{t("pages.hr.subtitle")}</p>
          </div>
          <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Headcount</p>
              <p className="text-sm font-semibold text-foreground">{employees.length}</p>
            </div>
            <div className="h-8 w-px bg-border/70" />
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
              <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">{activeCount}</p>
            </div>
            <div className="h-8 w-px bg-border/70" />
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attendance</p>
              <p className="text-sm font-semibold text-warning">{attendanceRateVal}%</p>
            </div>
            <div className="h-8 w-px bg-border/70" />
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payroll</p>
              <p className="text-sm font-semibold text-primary">{format(totalPayroll)}</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 shrink-0 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Induct personnel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-erp sm:max-w-xl">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-primary to-purple-500" />
              <DialogHeader className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">New Personnel Record</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Authorize new staff initialization</DialogDescription>
                </div>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Employee ID</Label>
                    <Input
                      value={newEmployee.employeeId}
                      onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-mono font-bold"
                      placeholder="EMP-"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Status</Label>
                    <Select
                      value={newEmployee.status}
                      onValueChange={(value: EmploymentStatus) => setNewEmployee({ ...newEmployee, status: value })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                        <SelectItem value="Active" className="text-xs font-bold uppercase italic tracking-wider text-emerald-500">Active</SelectItem>
                        <SelectItem value="On Leave" className="text-xs font-bold uppercase italic tracking-wider text-amber-500">On Leave</SelectItem>
                        <SelectItem value="Offboarded" className="text-xs font-bold uppercase italic tracking-wider text-rose-500">Offboarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Full Identity Name</Label>
                  <Input
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic text-lg"
                    placeholder="Full Legal Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Position / job title</Label>
                    <Input
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                      placeholder="e.g. CNC Operator"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Basic Monthly Salary (ETB)</Label>
                    <Input
                      type="number"
                      value={newEmployee.salary}
                      onChange={(e) => setNewEmployee({ ...newEmployee, salary: parseFloat(e.target.value) || 0 })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-mono font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Department Partition</Label>
                  <Input
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Department (org)</Label>
                    <Select
                      value={newEmployee.departmentId}
                      onValueChange={(v) => setNewEmployee({ ...newEmployee, departmentId: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d._id} value={d._id}>
                            {d.code} - {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Position (org)</Label>
                    <Select
                      value={newEmployee.positionId}
                      onValueChange={(v) => setNewEmployee({ ...newEmployee, positionId: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.code} - {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Manager</Label>
                    <Select
                      value={newEmployee.managerId}
                      onValueChange={(v) => setNewEmployee({ ...newEmployee, managerId: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => !!e._id)
                          .map((e) => (
                            <SelectItem key={e._id} value={String(e._id)}>
                              {e.name} ({e.id})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {user?.role === "Admin" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">App login role</Label>
                    <Select
                      value={newEmployee.accessRole}
                      onValueChange={(v) => setNewEmployee({ ...newEmployee, accessRole: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                        <SelectValue placeholder="employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {APP_ACCESS_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-muted-foreground">
                      Default <strong>employee</strong> for shop-floor accounts. Use higher roles only when needed.
                    </p>
                  </div>
                )}
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-[1px] flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Security & Identity</span>
                    <div className="h-[1px] flex-1 bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Email Access</Label>
                      <Input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                        placeholder="staff@factory.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Security Key</Label>
                      <Input
                        type="password"
                        value={newEmployee.password}
                        onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Department (org)</Label>
                      <Select
                        value={newEmployee.departmentId || ""}
                        onValueChange={(v) =>
                          setNewEmployee({
                            ...newEmployee,
                            departmentId: v || "",
                          })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d._id} value={d._id}>
                              {d.code} - {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Position (org)</Label>
                      <Select
                        value={newEmployee.positionId || ""}
                        onValueChange={(v) =>
                          setNewEmployee({
                            ...newEmployee,
                            positionId: v || "",
                          })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.code} - {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Manager</Label>
                      <Select
                        value={newEmployee.managerId || ""}
                        onValueChange={(v) =>
                          setNewEmployee({
                            ...newEmployee,
                            managerId: v || "",
                          })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((e) => !!e._id)
                            .map((e) => (
                              <SelectItem key={e._id} value={String(e._id)}>
                                {e.name} ({e.id})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4 gap-3">
                <Button variant="ghost" className="h-12 rounded-xl px-8 font-black uppercase italic text-xs tracking-widest" onClick={() => setIsDialogOpen(false)}>Abort</Button>
                <Button 
                  className="h-12 rounded-xl px-12 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 animate-pulse-slow active:scale-95 transition-all"
                  onClick={handleAddEmployee}
                >
                  Authorize Record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Headcount</p>
            <p className="text-sm font-semibold text-foreground">{employees.length}</p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
            <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">{activeCount}</p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attendance</p>
            <p className="text-sm font-semibold text-primary">{attendanceRateVal}%</p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leave queue</p>
            <p
              className={`text-sm font-semibold ${pendingLeaveCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}
            >
              {pendingLeaveCount} pending
            </p>
          </div>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-erp sm:max-w-xl">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 via-primary to-blue-500" />
              <DialogHeader className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                  <Edit2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Modify Personnel Specs</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Update record for {editingEmployee?.id}</DialogDescription>
                </div>
              </DialogHeader>
              {editingEmployee && (
                <div className="grid gap-6 py-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 opacity-50">Personnel ID (Locked)</Label>
                      <Input value={editingEmployee.id} disabled className="h-11 rounded-xl bg-white/5 border-white/5 font-mono font-bold opacity-50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Status</Label>
                      <Select
                        value={editingEmployee.status}
                        onValueChange={(value: EmploymentStatus) => setEditingEmployee({ ...editingEmployee, status: value })}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                          <SelectItem value="Active" className="text-xs font-bold uppercase italic tracking-wider text-emerald-500">Active</SelectItem>
                          <SelectItem value="On Leave" className="text-xs font-bold uppercase italic tracking-wider text-amber-500">On Leave</SelectItem>
                          <SelectItem value="Offboarded" className="text-xs font-bold uppercase italic tracking-wider text-rose-500">Offboarded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Identity Name</Label>
                    <Input
                      value={editingEmployee.name}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-bold italic text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Position</Label>
                      <Input
                        value={editingEmployee.position}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Dept</Label>
                      <Input
                        value={editingEmployee.department}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Monthly basic (ETB)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editingEmployee.salary ?? ""}
                        onChange={(e) =>
                          setEditingEmployee({
                            ...editingEmployee,
                            salary: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Phone</Label>
                      <Input
                        value={editingEmployee.phone ?? ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">TIN (tax)</Label>
                      <Input
                        value={editingEmployee.tinNumber ?? ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, tinNumber: e.target.value })}
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-mono text-sm"
                        placeholder="0000000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Pension member ID</Label>
                      <Input
                        value={editingEmployee.pensionMemberId ?? ""}
                        onChange={(e) =>
                          setEditingEmployee({ ...editingEmployee, pensionMemberId: e.target.value })
                        }
                        className="h-11 rounded-xl bg-white/5 border-white/10 font-mono text-sm"
                      />
                    </div>
                  </div>
                  {user?.role === "Admin" && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">App login role</Label>
                      <Select
                        value={editingEmployee.appRole}
                        onValueChange={(v) => setEditingEmployee({ ...editingEmployee, appRole: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_ACCESS_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter className="mt-4 gap-3">
                <Button variant="ghost" className="h-12 rounded-xl px-8 font-black uppercase italic text-xs tracking-widest" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button 
                  className="h-12 rounded-xl px-12 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                  onClick={handleUpdateEmployee}
                >
                  Commit Specs
                </Button>
              </DialogFooter>
            </DialogContent>
      </Dialog>

      <HrMetrics 
        totalEmployees={employees.length}
        activeEmployees={activeCount}
        onLeaveEmployees={leaveCount}
        attendanceRate={attendanceRateVal}
        totalPayroll={totalPayroll}
      />

      <Tabs defaultValue="employees" className="space-y-6">
        <StickyModuleTabs>
          <TabsList className={moduleTabsListClassName()}>
            <TabsTrigger value="employees" className={moduleTabsTriggerClassName()}>
              <Users className="h-4 w-4 shrink-0" />
              Personnel Ledger
            </TabsTrigger>
            <TabsTrigger value="attendance" className={moduleTabsTriggerClassName()}>
              <Calendar className="h-4 w-4 shrink-0" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leaves" className={moduleTabsTriggerClassName()}>
              <Calendar className="h-4 w-4 shrink-0" />
              Leaves
              {pendingLeaveCount > 0 ? (
                <Badge variant="warning" className="ml-1 h-5 px-1.5 text-[9px] leading-none">
                  {pendingLeaveCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="org" className={moduleTabsTriggerClassName()}>
              <Users className="h-4 w-4 shrink-0" />
              Org
            </TabsTrigger>
            <TabsTrigger value="payroll" className={moduleTabsTriggerClassName()}>
              <DollarSign className="h-4 w-4 shrink-0" />
              Payroll
            </TabsTrigger>
          </TabsList>
        </StickyModuleTabs>

        <TabsContent value="employees">
          <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
            <CardHeader className="space-y-4 border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight text-[#1a2744]">Personnel register</h3>
                  <p className="text-sm text-muted-foreground">Search by name, role, department, or status</p>
                </div>
                <div className="relative w-full md:w-96 group/search">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within/search:text-primary transition-colors" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, role, department…"
                    className="h-10 rounded-full border-0 bg-[#EEF2F7] pl-11 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Emp ID</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Full Name</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Dept</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Operational Role</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</TableHead>
                    <TableHead className="pr-6 h-12 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Protocol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableCell colSpan={6} className="h-32 text-center">
                        <LoadingLogo size={32} className="mx-auto text-primary/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Syncing Ledger...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredEmployees.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableCell colSpan={6} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No records match current query parameters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((e) => (
                      <TableRow key={e.id} className="group/row transition-all hover:bg-muted/30 border-border/50">
                        <TableCell className="pl-6 py-4">
                          <span className="font-mono text-[10px] font-black px-2 py-1 rounded bg-muted/30 text-muted-foreground tracking-tighter uppercase group-hover/row:bg-primary group-hover/row:text-white transition-colors">
                            {e.id}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-black italic text-sm group-hover/row:text-primary transition-colors">{e.name}</div>
                          <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Employee Profile</div>
                        </TableCell>
                        <TableCell className="py-4 font-bold text-xs uppercase tracking-wider">{e.department}</TableCell>
                        <TableCell className="py-4 text-xs font-semibold text-muted-foreground">
                          {e.position}
                          {e.appRole !== "employee" && (
                            <span className="block text-[9px] opacity-50 mt-0.5">({e.appRole})</span>
                          )}
                          {e.managerName ? (
                            <span className="block text-[9px] opacity-50 mt-0.5">Mgr: {e.managerName}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={statusVariant[e.status]} className="text-[9px] font-black uppercase italic tracking-widest px-2.5 py-0.5 rounded-lg">
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group-hover/row:scale-110"
                            onClick={() => {
                              setEditingEmployee({
                                ...e,
                                phone: e.phone ?? "",
                                tinNumber: e.tinNumber ?? "",
                                pensionMemberId: e.pensionMemberId ?? "",
                              });
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl mt-4">
            <CardHeader className="pb-4 border-b border-white/5">
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight uppercase text-sky-500">
                  Attendance Correction Requests
                </h3>
                <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">
                  Employee submitted changes for HR review
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="pl-6">Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attCorrectionLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <LoadingLogo size={24} className="mx-auto text-sky-500/50" />
                      </TableCell>
                    </TableRow>
                  ) : attendanceCorrections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No correction requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceCorrections.map((c) => (
                      <TableRow key={c._id}>
                        <TableCell className="pl-6 text-xs">
                          <div className="font-semibold">{c.employee?.name || "Unknown"}</div>
                          <div className="text-[10px] text-muted-foreground">{c.employee?.employeeId || "-"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(c.attendanceDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.requestedStatus} ({c.requestedCheckIn || "--:--"} -{" "}
                          {c.requestedCheckOut || "--:--"})
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "approved"
                                ? "success"
                                : c.status === "rejected"
                                  ? "secondary"
                                  : c.status === "cancelled"
                                    ? "secondary"
                                    : "warning"
                            }
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          {c.status === "pending" ? (
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => handleReviewAttendanceCorrection(c._id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => handleReviewAttendanceCorrection(c._id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tighter italic uppercase text-amber-500">Attendance Log</h3>
                <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">Real-time presence monitoring</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Personnel</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Date</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Status</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Interval</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">OT</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">OT Review</TableHead>
                    <TableHead className="pr-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attLoading ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={7} className="h-32 text-center">
                        <LoadingLogo size={32} className="mx-auto text-amber-500/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Scanning Biometrics...</p>
                      </TableCell>
                    </TableRow>
                  ) : attendance.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={7} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No presence records detected for current period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendance.map((a) => (
                      <TableRow key={a._id} className="transition-all hover:bg-white/[0.02] border-white/5">
                        <TableCell className="pl-6 py-4">
                          <div className="font-black italic text-sm">{a.employee?.name || "Unknown"}</div>
                          <div className="text-[10px] font-mono opacity-40 uppercase">{a.employee?.employeeId}</div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-bold tracking-wider">{new Date(a.date).toLocaleDateString()}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant={a.status === "Present" ? "success" : "warning"} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg">
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-xs font-black italic group-hover:text-primary transition-colors">
                            <Clock className="h-3 w-3 opacity-40" />
                            {a.checkIn || "--:--"} <span className="opacity-20">-</span> {a.checkOut || "--:--"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono">
                          {(a.overtimeMinutes || 0) > 0 ? `${a.overtimeMinutes} min` : "—"}
                        </TableCell>
                        <TableCell className="py-4">
                          {(a.overtimeMinutes || 0) > 0 ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  a.overtimeApprovalStatus === "approved"
                                    ? "success"
                                    : a.overtimeApprovalStatus === "rejected"
                                      ? "secondary"
                                      : "warning"
                                }
                                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg"
                              >
                                {a.overtimeApprovalStatus || "pending"}
                              </Badge>
                              {(a.overtimeApprovalStatus === "pending" || !a.overtimeApprovalStatus) &&
                                (user?.role === "Admin" || user?.role === "hr_head") && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 text-[10px]"
                                      onClick={() => handleAttendanceOvertimeReview(a._id, "approved")}
                                    >
                                      <Check className="h-3 w-3" /> Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-[10px]"
                                      onClick={() => handleAttendanceOvertimeReview(a._id, "rejected")}
                                    >
                                      <X className="h-3 w-3" /> Reject
                                    </Button>
                                  </>
                                )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-[10px] italic font-medium text-muted-foreground/60">{a.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2 bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
              <CardHeader className="pb-4 border-b border-white/5">
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tighter italic uppercase text-sky-500">Leave Requests</h3>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">
                    Request, approve, and monitor leave
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-[10px] font-black uppercase">Employee</Label>
                    <Select
                      value={newLeave.employee}
                      onValueChange={(v) => setNewLeave((s) => ({ ...s, employee: v }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter((e) => !!e._id).map((e) => (
                          <SelectItem key={e._id || e.id} value={String(e._id)}>
                            {e.name} ({e.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">Type</Label>
                    <Select
                      value={newLeave.leaveType}
                      onValueChange={(v: HrLeaveRow["leaveType"]) =>
                        setNewLeave((s) => ({ ...s, leaveType: v }))
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="sick">Sick</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="maternity">Maternity</SelectItem>
                        <SelectItem value="paternity">Paternity</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">From</Label>
                    <Input
                      type="date"
                      value={newLeave.startDate}
                      onChange={(e) => setNewLeave((s) => ({ ...s, startDate: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">To</Label>
                    <Input
                      type="date"
                      value={newLeave.endDate}
                      onChange={(e) => setNewLeave((s) => ({ ...s, endDate: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-[10px] font-black uppercase">Reason</Label>
                    <Input
                      value={newLeave.reason}
                      onChange={(e) => setNewLeave((s) => ({ ...s, reason: e.target.value }))}
                      placeholder="Optional reason"
                      className="h-10"
                    />
                  </div>
                  <Button
                    className="h-10 font-black uppercase text-xs"
                    disabled={leaveActionLoading}
                    onClick={handleCreateLeave}
                  >
                    {leaveActionLoading ? <LoadingLogo size={16} className="mr-2" /> : null}
                    Request leave
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <LoadingLogo size={24} className="mx-auto text-sky-500/60" />
                        </TableCell>
                      </TableRow>
                    ) : leaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                          No leave requests yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaves.map((l) => (
                        <TableRow key={l._id}>
                          <TableCell className="text-xs font-semibold">
                            {l.employee?.name || "Unknown"}
                          </TableCell>
                          <TableCell className="text-xs uppercase">{l.leaveType}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(l.startDate).toLocaleDateString()} -{" "}
                            {new Date(l.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{l.days}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                l.status === "approved"
                                  ? "success"
                                  : l.status === "rejected"
                                    ? "secondary"
                                    : "warning"
                              }
                            >
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {l.status === "pending" &&
                            (user?.role === "Admin" || user?.role === "hr_head") ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px]"
                                  onClick={() => handleReviewLeave(l._id, "approved")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px]"
                                  onClick={() => handleReviewLeave(l._id, "rejected")}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-base font-black uppercase tracking-wide">Leave Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Employee</Label>
                  <Select
                    value={selectedLeaveEmployeeId}
                    onValueChange={(v) => setSelectedLeaveEmployeeId(v)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter((e) => !!e._id).map((e) => (
                        <SelectItem key={e._id || e.id} value={String(e._id)}>
                          {e.name} ({e.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Year</Label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={selectedLeaveYear}
                    onChange={(e) => setSelectedLeaveYear(parseInt(e.target.value || "0", 10) || new Date().getFullYear())}
                    className="h-10"
                  />
                </div>
                <Button
                  className="h-10 w-full font-black uppercase text-xs"
                  onClick={() => selectedLeaveEmployeeId && loadLeaveBalance(selectedLeaveEmployeeId)}
                >
                  Load balance
                </Button>
                {leaveBalance ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold">
                      {leaveBalance.employee.name} ({leaveBalance.year})
                    </div>
                    {Object.entries(leaveBalance.balances).map(([k, v]) => (
                      <div key={k} className="rounded-md border p-2">
                        <div className="font-semibold uppercase">{k}</div>
                        <div>Used: {v.used}</div>
                        <div>Entitlement: {v.entitlement == null ? "N/A" : v.entitlement}</div>
                        <div>Remaining: {v.remaining == null ? "N/A" : v.remaining}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Select employee and load balance.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="org">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-base font-black uppercase tracking-wide">Departments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Code"
                    value={newDepartment.code}
                    onChange={(e) => setNewDepartment((s) => ({ ...s, code: e.target.value }))}
                  />
                  <Input
                    placeholder="Name"
                    value={newDepartment.name}
                    onChange={(e) => setNewDepartment((s) => ({ ...s, name: e.target.value }))}
                  />
                  <Button className="font-black uppercase text-xs" onClick={handleCreateDepartment}>
                    Add dept
                  </Button>
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment((s) => ({ ...s, description: e.target.value }))}
                />
                <div className="space-y-2 max-h-72 overflow-auto">
                  {orgLoading ? (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  ) : departments.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No departments yet.</div>
                  ) : (
                    departments.map((d) => (
                      <div key={d._id} className="rounded-md border p-2 text-xs">
                        <div className="font-semibold">{d.code} - {d.name}</div>
                        {d.description ? <div className="text-muted-foreground">{d.description}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-base font-black uppercase tracking-wide">Positions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Code"
                    value={newPosition.code}
                    onChange={(e) => setNewPosition((s) => ({ ...s, code: e.target.value }))}
                  />
                  <Input
                    placeholder="Title"
                    value={newPosition.title}
                    onChange={(e) => setNewPosition((s) => ({ ...s, title: e.target.value }))}
                  />
                  <Button className="font-black uppercase text-xs" onClick={handleCreatePosition}>
                    Add pos
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={newPosition.department}
                    onValueChange={(v) => setNewPosition((s) => ({ ...s, department: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d._id} value={d._id}>
                          {d.code} - {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newPosition.reportsToPosition}
                    onValueChange={(v) => setNewPosition((s) => ({ ...s, reportsToPosition: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Reports to (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.code} - {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {orgLoading ? (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  ) : positions.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No positions yet.</div>
                  ) : (
                    positions.map((p) => (
                      <div key={p._id} className="rounded-md border p-2 text-xs">
                        <div className="font-semibold">{p.code} - {p.title}</div>
                        <div className="text-muted-foreground">
                          Dept: {typeof p.department === "object" ? p.department?.name : "-"} | Reports to:{" "}
                          {typeof p.reportsToPosition === "object" ? p.reportsToPosition?.title : "-"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
            <CardHeader className="pb-4 border-b border-border/60 bg-muted/10 space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tighter italic uppercase text-purple-500">Ethiopia payroll</h3>
                <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">
                  Pension 7%/11%, PAYE, overtime (1.25× / 1.5×) — CSV for agencies · payslip print
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase">Month</Label>
                  <Input
                    type="month"
                    className="h-10 w-40 font-mono"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                  />
                </div>
                {(payrollMonthStatus?.posted || payrollMonthStatus?.closed) && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {payrollMonthStatus.posted && (
                      <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wide">
                        Posted to finance
                      </Badge>
                    )}
                    {payrollMonthStatus.closed && (
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wide border-amber-500/50 text-amber-700 dark:text-amber-400">
                        <Lock className="h-3 w-3 mr-1 inline" />
                        Month closed
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  className="h-10 gap-2 font-black uppercase text-xs"
                  disabled={!token || payrollMonthLocked}
                  title={payrollMonthLocked ? "Month is closed — only Admin can change payroll." : undefined}
                  onClick={() => {
                    setRunDialogOpen(true);
                    setTimeout(() => loadPayrollPrepare(), 0);
                  }}
                >
                  <Play className="h-4 w-4" />
                  Run payroll…
                </Button>
                <Button
                  variant="secondary"
                  className="h-10 gap-2 font-black uppercase text-xs"
                  disabled={
                    !token ||
                    !canPostOrClosePayroll ||
                    payrollActionLoading ||
                    payroll.length === 0 ||
                    !!payrollMonthStatus?.posted ||
                    payrollMonthLocked
                  }
                  title={
                    payrollMonthStatus?.posted
                      ? "Already posted for this month."
                      : payrollMonthLocked
                        ? "Month is closed — only Admin can post or change payroll."
                        : "Creates a balanced journal in Finance (idempotent)."
                  }
                  onClick={async () => {
                    setPayrollActionLoading(true);
                    try {
                      const r = await hrPayrollApi.postToFinance(payrollMonth);
                      toast({
                        title: r.idempotent ? "Already posted" : "Posted to finance",
                        description: r.message || "Journal entry created — see Finance ledger.",
                      });
                      await fetchPayroll(payrollMonth);
                    } catch (e: unknown) {
                      const msg =
                        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Could not post payroll.";
                      toast({ title: "Post failed", description: msg, variant: "destructive" });
                    } finally {
                      setPayrollActionLoading(false);
                    }
                  }}
                >
                  {payrollActionLoading ? <LoadingLogo size={16} /> : <BookOpen className="h-4 w-4" />}
                  Post to finance
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 font-black uppercase text-xs border-amber-500/40"
                  disabled={
                    !token ||
                    !canPostOrClosePayroll ||
                    payrollActionLoading ||
                    payroll.length === 0 ||
                    !payrollMonthStatus?.posted ||
                    !!payrollMonthStatus?.closed
                  }
                  title={
                    payrollMonthStatus?.closed
                      ? "This month is already closed."
                      : !payrollMonthStatus?.posted
                        ? "Post payroll to finance first."
                        : "Locks payroll edits for this month (Admin can still change records)."
                  }
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Close this payroll month? HR users will not be able to re-run payroll or mark paid unless an Admin edits records."
                      )
                    ) {
                      return;
                    }
                    setPayrollActionLoading(true);
                    try {
                      const r = await hrPayrollApi.closeMonth(payrollMonth);
                      toast({
                        title: r.idempotent ? "Already closed" : "Month closed",
                        description: r.message || "Payroll is locked for this period.",
                      });
                      await fetchPayroll(payrollMonth);
                    } catch (e: unknown) {
                      const msg =
                        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Could not close month.";
                      toast({ title: "Close failed", description: msg, variant: "destructive" });
                    } finally {
                      setPayrollActionLoading(false);
                    }
                  }}
                >
                  <Lock className="h-4 w-4" />
                  Close month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2"
                  onClick={() => downloadPayrollPensionCsv(payrollMonth).catch(() => toast({ title: "Export failed", variant: "destructive" }))}
                >
                  <Download className="h-4 w-4" /> Pension CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2"
                  onClick={() =>
                    downloadPayrollIncomeTaxCsv(payrollMonth).catch(() =>
                      toast({ title: "Export failed", variant: "destructive" })
                    )
                  }
                >
                  <Download className="h-4 w-4" /> Income tax CSV
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Run uses each <strong>Active</strong> employee&apos;s monthly <strong>basic salary</strong>. Set transport, overtime, and extras via API{" "}
                <code className="text-[9px] bg-muted px-1 rounded">POST /api/hr/payroll/run</code> with{" "}
                <code className="text-[9px] bg-muted px-1 rounded">entries[]</code>. Edit employee TIN / pension ID under personnel.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Personnel</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Gross</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pension 7%</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">PAYE</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Net</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</TableHead>
                    <TableHead className="pr-6 h-12 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payLoading ? (
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableCell colSpan={8} className="h-32 text-center">
                        <LoadingLogo size={32} className="mx-auto text-purple-500/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Loading…</p>
                      </TableCell>
                    </TableRow>
                  ) : payroll.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableCell colSpan={8} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No payroll for {payrollMonth}. Run month or pick another period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map((p) => (
                      <TableRow key={p._id} className="transition-all hover:bg-muted/30 border-border/50">
                        <TableCell className="pl-6 py-4">
                          <div className="font-black italic text-sm">{p.employee?.name || "Unknown"}</div>
                          <div className="text-[10px] font-mono opacity-50">{p.employee?.employeeId}</div>
                        </TableCell>
                        <TableCell className="py-4 font-mono text-sm">
                          {p.grossCash != null && p.grossCash > 0 ? format(p.grossCash) : format(p.basicSalary ?? 0)}
                        </TableCell>
                        <TableCell className="py-4 font-mono text-sm text-amber-600/90">
                          {format(p.pensionEmployee ?? 0)}
                        </TableCell>
                        <TableCell className="py-4 font-mono text-sm text-rose-600/90">{format(p.incomeTax ?? 0)}</TableCell>
                        <TableCell className="py-4 font-mono text-sm font-black text-emerald-600">
                          {format(p.netSalary ?? 0)}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant={p.paymentStatus === "Paid" ? "success" : "warning"}
                            className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg"
                          >
                            {p.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() =>
                              openPayrollPayslipHtml(p._id).catch(() =>
                                toast({ title: "Payslip failed", variant: "destructive" })
                              )
                            }
                          >
                            <FileText className="h-3.5 w-3.5" /> Print
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-[96vw] w-[min(1120px,96vw)] max-h-[92vh] flex flex-col gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Run payroll — {payrollMonth}</DialogTitle>
            <DialogDescription className="text-xs">
              {prepareHint ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold block">{prepareHint}</span>
              ) : (
                "Adjust figures then save. Pension 7%, PAYE, and net pay are calculated automatically."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={prepareLoading} onClick={() => loadPayrollPrepare()}>
              {prepareLoading ? <LoadingLogo size={16} /> : null}
              Reload staff
            </Button>
          </div>
          <ScrollArea className="h-[min(52vh,480px)] w-full rounded-md border">
            {prepareLoading && runGrid.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
            ) : runGrid.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No Active or On Leave employees. Add staff in Personnel.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-3">Inc</TableHead>
                    <TableHead className="min-w-[140px]">Name</TableHead>
                    <TableHead className="w-[88px]">Basic</TableHead>
                    <TableHead className="w-[80px]">Transp.</TableHead>
                    <TableHead className="w-[72px]" title="Weekday OT hours @1.25×">
                      OT×1.25
                    </TableHead>
                    <TableHead className="w-[72px]" title="Rest/holiday OT @1.5×">
                      OT×1.5
                    </TableHead>
                    <TableHead className="w-[72px]">Bonus</TableHead>
                    <TableHead className="w-[72px]">Oth ded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runGrid.map((row, i) => (
                    <TableRow key={row.employee._id} className="hover:bg-muted/30">
                      <TableCell className="pl-3">
                        <Checkbox
                          checked={row.includeInRun}
                          onCheckedChange={(c) =>
                            setRunGrid((g) =>
                              g.map((r, j) => (j === i ? { ...r, includeInRun: Boolean(c) } : r))
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-semibold">{row.employee.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{row.employee.employeeId}</div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs font-mono px-2"
                          value={row.basicSalary || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i ? { ...r, basicSalary: parseFloat(e.target.value) || 0 } : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs font-mono px-2"
                          value={row.transportAllowance || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i
                                  ? { ...r, transportAllowance: parseFloat(e.target.value) || 0 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8 text-xs font-mono px-2"
                          value={row.overtimeNormalHours || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i
                                  ? { ...r, overtimeNormalHours: parseFloat(e.target.value) || 0 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8 text-xs font-mono px-2"
                          value={row.overtimeRestHolidayHours || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i
                                  ? { ...r, overtimeRestHolidayHours: parseFloat(e.target.value) || 0 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs font-mono px-2"
                          value={row.otherTaxableAllowances || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i
                                  ? { ...r, otherTaxableAllowances: parseFloat(e.target.value) || 0 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs font-mono px-2"
                          value={row.otherDeductions || ""}
                          onChange={(e) =>
                            setRunGrid((g) =>
                              g.map((r, j) =>
                                j === i
                                  ? { ...r, otherDeductions: parseFloat(e.target.value) || 0 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={payRunLoading || runGrid.length === 0 || payrollMonthLocked}
              className="font-black uppercase text-xs"
              onClick={async () => {
                const entries = runGrid
                  .filter((r) => r.includeInRun)
                  .map((r) => ({
                    employee: r.employee._id,
                    basicSalary: r.basicSalary,
                    transportAllowance: r.transportAllowance,
                    overtimeNormalHours: r.overtimeNormalHours,
                    overtimeRestHolidayHours: r.overtimeRestHolidayHours,
                    otherTaxableAllowances: r.otherTaxableAllowances,
                    otherDeductions: r.otherDeductions,
                    includeInRun: true,
                  }));
                if (entries.length === 0) {
                  toast({
                    title: "No one selected",
                    description: "Check at least one employee with basic salary greater than 0.",
                    variant: "destructive",
                  });
                  return;
                }
                setPayRunLoading(true);
                try {
                  const r = await hrPayrollApi.runMonth({ month: payrollMonth, entries });
                  const skipMsg =
                    r.skipped && r.skipped.length > 0
                      ? ` Skipped ${r.skipped.length} (no basic).`
                      : "";
                  toast({
                    title: "Payroll saved",
                    description: `${r.count} employees.${skipMsg}`,
                    variant: r.count === 0 ? "destructive" : "default",
                  });
                  if (r.count > 0) {
                    setRunDialogOpen(false);
                    await fetchPayroll(payrollMonth);
                  }
                } catch (err: unknown) {
                  const msg =
                    (err as { response?: { data?: { message?: string; hint?: string } } })?.response?.data
                      ?.message || "Run failed";
                  const hint =
                    (err as { response?: { data?: { hint?: string } } })?.response?.data?.hint || "";
                  toast({
                    title: "Run failed",
                    description: hint ? `${msg} — ${hint}` : msg,
                    variant: "destructive",
                  });
                } finally {
                  setPayRunLoading(false);
                }
              }}
            >
              {payRunLoading ? <LoadingLogo size={16} className="mr-2" /> : null}
              Calculate &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
