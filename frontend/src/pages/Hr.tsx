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
  Loader2,
  Edit2,
  Calendar,
  DollarSign,
  Clock,
  UserCog,
  Download,
  FileText,
  Play,
} from "lucide-react";
import {
  hrPayrollApi,
  downloadPayrollPensionCsv,
  downloadPayrollIncomeTaxCsv,
  openPayrollPayslipHtml,
  type PayrollPrepareRow,
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ModuleDashboardLayout,
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

type EmploymentStatus = "Active" | "On Leave" | "Offboarded";

const APP_ACCESS_ROLES = [
  "employee",
  "hr_head",
  "finance_head",
  "purchasing_head",
  "warehouse_head",
  "Admin",
] as const;

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
  });
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(false);
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

  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !token) return;
    fetchEmployees();
    fetchAttendance();
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

  const fetchPayroll = async (month: string) => {
    setPayLoading(true);
    try {
      const data = await hrPayrollApi.list(month);
      setPayroll(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch payroll:", error);
      toast({
        title: "Payroll load failed",
        description: "Log in as Admin, HR, or Finance. Check network.",
        variant: "destructive",
      });
      setPayroll([]);
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

  const activeCount = employees.filter(e => e.status === "Active").length;
  const leaveCount = employees.filter(e => e.status === "On Leave").length;
  const attendanceRateVal = attendance.length > 0 
    ? Math.round((attendance.filter(a => a.status === "Present").length / attendance.length) * 100)
    : 94; // fallback mockup value

  return (
    <ModuleDashboardLayout
      title="Talent Operations"
      description="Ethiopia-aligned payroll: pension 7%/11%, PAYE, overtime, payslips & government CSV exports."
      icon={UserCog}
      healthStats={[
        { label: "Headcount", value: String(employees.length) },
        { label: "Active", value: String(activeCount), accent: "text-success" },
        { label: "Attendance", value: `${attendanceRateVal}%`, accent: "text-primary" },
      ]}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 rounded-2xl bg-primary px-8 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2">
                <Plus className="h-4 w-4" />
                Induct Personnel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-3xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-purple-500" />
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
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Department Partition</Label>
                    <Input
                      value={newEmployee.department}
                      onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
                    />
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
      }
    >
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-2xl border-white/10 shadow-3xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary to-blue-500" />
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
            <TabsTrigger value="payroll" className={moduleTabsTriggerClassName()}>
              <DollarSign className="h-4 w-4 shrink-0" />
              Payroll
            </TabsTrigger>
          </TabsList>
        </StickyModuleTabs>

        <TabsContent value="employees">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl group shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tighter italic">ACTIVE DIRECTORY</h3>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">Authorized personnel database</p>
                </div>
                <div className="relative w-full md:w-96 group/search">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within/search:text-primary transition-colors" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="SCAN LEDGER FOR NAME, ROLE, DEPT..."
                    className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10 focus-visible:ring-primary/20 font-bold italic text-xs tracking-wider placeholder:opacity-30"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Emp ID</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Full Name</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Dept</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Operational Role</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Status</TableHead>
                    <TableHead className="pr-6 h-12 text-right text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Protocol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Syncing Ledger...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredEmployees.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={6} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No records match current query parameters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((e) => (
                      <TableRow key={e.id} className="group/row transition-all hover:bg-white/[0.02] border-white/5">
                        <TableCell className="pl-6 py-4">
                          <span className="font-mono text-[10px] font-black px-2 py-1 rounded bg-white/5 text-muted-foreground tracking-tighter uppercase group-hover/row:bg-primary group-hover/row:text-white transition-colors">
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
                    <TableHead className="pr-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attLoading ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={5} className="h-32 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Scanning Biometrics...</p>
                      </TableCell>
                    </TableRow>
                  ) : attendance.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={5} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
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
                        <TableCell className="pr-6 py-4 text-[10px] italic font-medium text-muted-foreground/60">{a.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden rounded-3xl shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5 space-y-4">
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
                <Button
                  className="h-10 gap-2 font-black uppercase text-xs"
                  disabled={!token}
                  onClick={() => {
                    setRunDialogOpen(true);
                    setTimeout(() => loadPayrollPrepare(), 0);
                  }}
                >
                  <Play className="h-4 w-4" />
                  Run payroll…
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
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Personnel</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Gross</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Pension 7%</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">PAYE</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Net</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Status</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Paid</TableHead>
                    <TableHead className="pr-6 h-12 text-right text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payLoading ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={8} className="h-32 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Loading…</p>
                      </TableCell>
                    </TableRow>
                  ) : payroll.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={8} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No payroll for {payrollMonth}. Run month or pick another period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map((p) => (
                      <TableRow key={p._id} className="transition-all hover:bg-white/[0.02] border-white/5">
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
                        <TableCell className="py-4">
                          {p.paymentStatus !== "Paid" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] uppercase font-bold"
                              onClick={async () => {
                                try {
                                  await hrPayrollApi.updateRecord(p._id, {
                                    paymentStatus: "Paid",
                                    paymentDate: new Date().toISOString(),
                                  });
                                  toast({ title: "Marked paid" });
                                  fetchPayroll(payrollMonth);
                                } catch {
                                  toast({ title: "Update failed", variant: "destructive" });
                                }
                              }}
                            >
                              Mark paid
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
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
              {prepareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
              disabled={payRunLoading || runGrid.length === 0}
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
              {payRunLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Calculate &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleDashboardLayout>
  );
}
