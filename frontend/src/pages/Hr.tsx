import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Loader2, Edit2, Sparkles, TrendingUp, Calendar, DollarSign, Clock } from "lucide-react";
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

type EmploymentStatus = "Active" | "On Leave" | "Offboarded";

type Employee = {
  _id?: string;
  id: string; // employeeId
  name: string;
  role: string;
  department: string;
  status: EmploymentStatus;
  email?: string;
  phone?: string;
  salary?: number;
};

const statusVariant: Record<EmploymentStatus, "success" | "warning" | "secondary"> = {
  Active: "success",
  "On Leave": "warning",
  Offboarded: "secondary",
};

const seedEmployees: Employee[] = [
  { id: "EMP-001", name: "Aarav Sharma", role: "CNC Operator", department: "Production", status: "Active" },
  { id: "EMP-002", name: "Neha Patel", role: "Quality Inspector", department: "QA", status: "On Leave" },
  { id: "EMP-003", name: "Vikram Singh", role: "Maintenance Tech", department: "Maintenance", status: "Active" },
];

const API_BASE_URL = "http://localhost:5000/api/hr";

export default function Hr() {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    employeeId: "",
    name: "",
    role: "",
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

  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchAttendance();
    fetchPayroll();
  }, []);

  const fetchAttendance = async () => {
    setAttLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/attendance`, {
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

  const fetchPayroll = async () => {
    setPayLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payroll`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPayroll(data);
      }
    } catch (error) {
      console.error("Failed to fetch payroll:", error);
    } finally {
      setPayLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setEmployees(data.map((e: any) => ({
            _id: e._id,
            id: e.employeeId,
            name: e.name,
            role: e.role,
            department: e.department,
            status: e.status,
            email: e.email,
            phone: e.phone,
            salary: e.salary,
          })));
        }
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.employeeId || !newEmployee.name || !newEmployee.role || !newEmployee.department || !newEmployee.password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields, including a security password.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEmployee),
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
          role: "",
          department: "",
          status: "Active",
          email: "",
          password: "",
        });
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to add employee.",
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
      const response = await fetch(`${API_BASE_URL}/employees/${editingEmployee._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingEmployee.name,
          role: editingEmployee.role,
          department: editingEmployee.department,
          status: editingEmployee.status,
          email: editingEmployee.email,
          phone: editingEmployee.phone,
          salary: editingEmployee.salary,
        }),
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
        e.role.toLowerCase().includes(query) ||
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
            <Sparkles className="h-3 w-3" />
            Human Resources Ledger
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
            TALENT OPS
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Staff Records & Intelligence Partition
          </p>
        </div>
        <div className="flex items-center gap-3">
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
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Operational Role</Label>
                    <Input
                      value={newEmployee.role}
                      onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                      className="h-11 rounded-xl bg-white/5 border-white/10 font-bold"
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
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Role</Label>
                      <Input
                        value={editingEmployee.role}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
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
        </div>
      </div>

      <HrMetrics 
        totalEmployees={employees.length}
        activeEmployees={activeCount}
        onLeaveEmployees={leaveCount}
        attendanceRate={attendanceRateVal}
        totalPayroll={totalPayroll}
      />

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="h-14 bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl">
          <TabsTrigger value="employees" className="h-full rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all gap-2">
            <Users className="h-3.5 w-3.5" />
            Personnel Ledger
          </TabsTrigger>
          <TabsTrigger value="attendance" className="h-full rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Attendance Flux
          </TabsTrigger>
          <TabsTrigger value="payroll" className="h-full rounded-xl px-8 font-black uppercase italic text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all gap-2">
            <DollarSign className="h-3.5 w-3.5" />
            Payroll History
          </TabsTrigger>
        </TabsList>

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
                        <TableCell className="py-4 text-xs font-semibold text-muted-foreground">{e.role}</TableCell>
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
                              setEditingEmployee(e);
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
            <CardHeader className="pb-4 border-b border-white/5">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tighter italic uppercase text-purple-500">Payroll History</h3>
                <p className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">Financial disbursement ledger</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="pl-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Personnel</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Cycle</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Disbursement</TableHead>
                    <TableHead className="h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Status</TableHead>
                    <TableHead className="pr-6 h-12 text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Auth Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payLoading ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={5} className="h-32 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Calculating Ledgers...</p>
                      </TableCell>
                    </TableRow>
                  ) : payroll.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableCell colSpan={5} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                        No financial records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map((p) => (
                      <TableRow key={p._id} className="transition-all hover:bg-white/[0.02] border-white/5">
                        <TableCell className="pl-6 py-4">
                          <div className="font-black italic text-sm group-hover:text-purple-500 transition-colors">{p.employee?.name || "Unknown"}</div>
                          <div className="text-[10px] font-mono opacity-40 uppercase tracking-tighter">{p.employee?.employeeId}</div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-black uppercase tracking-widest opacity-60 italic">{p.month}</TableCell>
                        <TableCell className="py-4">
                          <div className="text-sm font-black italic tracking-tighter text-emerald-500">
                            ${p.netSalary?.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={p.paymentStatus === "Paid" ? "success" : "warning"} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg">
                            {p.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-xs font-bold text-muted-foreground/60">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div >
  );
}
