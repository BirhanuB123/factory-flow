import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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

type EmploymentStatus = "Active" | "On Leave" | "Offboarded";

type Employee = {
  id: string;
  name: string;
  role: string;
  department: string;
  status: EmploymentStatus;
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
  });
  
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
      const response = await fetch(`${API_BASE_URL}/attendance`);
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
      const response = await fetch(`${API_BASE_URL}/payroll`);
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
      const response = await fetch(`${API_BASE_URL}/employees`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setEmployees(data.map((e: any) => ({
            id: e.employeeId,
            name: e.name,
            role: e.role,
            department: e.department,
            status: e.status
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
    if (!newEmployee.employeeId || !newEmployee.name || !newEmployee.role || !newEmployee.department) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">HR</h1>
          <p className="text-sm text-muted-foreground">
            Manage employees, departments, and staff records
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Enter the details for the new employee here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="id" className="text-right">
                  Employee ID
                </Label>
                <Input
                  id="id"
                  value={newEmployee.employeeId}
                  onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
                  className="col-span-3"
                  placeholder="EMP-XXX"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Input
                  id="role"
                  value={newEmployee.role}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="department" className="text-right">
                  Dept.
                </Label>
                <Input
                  id="department"
                  value={newEmployee.department}
                  onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  value={newEmployee.status}
                  onValueChange={(value: EmploymentStatus) =>
                    setNewEmployee({ ...newEmployee, status: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Offboarded">Offboarded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddEmployee}>
                Save Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{employees.length}</div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {employees.filter((e) => e.status === "Active").length}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Leave</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {employees.filter((e) => e.status === "On Leave").length}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payroll">
            Payroll
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Employee Directory</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Search and review staff records
                  </p>
                </div>
                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search staff…"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pl-6">
                        Employee ID
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        Department
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        Role
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pr-6">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="mt-2 text-sm text-muted-foreground">Loading employees...</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No employees match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-6 font-mono text-sm font-medium">{e.id}</TableCell>
                          <TableCell className="text-sm font-medium">{e.name}</TableCell>
                          <TableCell className="text-sm">{e.department}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.role}</TableCell>
                          <TableCell className="pr-6">
                            <Badge variant={statusVariant[e.status]} className="text-[11px]">
                              {e.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="attendance">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 text-sm font-medium">Daily Attendance Log</CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In/Out</TableHead>
                    <TableHead className="pr-6">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : attendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No attendance records found.</TableCell>
                    </TableRow>
                  ) : (
                    attendance.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell className="pl-6 font-medium text-sm">{a.employee?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{new Date(a.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "Present" ? "success" : "warning"} className="text-[10px]">{a.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{a.checkIn || "--:--"} - {a.checkOut || "--:--"}</TableCell>
                        <TableCell className="pr-6 text-sm italic text-muted-foreground">{a.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 text-sm font-medium">Payroll History</CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Employee</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6">Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : payroll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No payroll records found.</TableCell>
                    </TableRow>
                  ) : (
                    payroll.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="pl-6 font-medium text-sm">{p.employee?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{p.month}</TableCell>
                        <TableCell className="text-sm font-semibold">${p.netSalary?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={p.paymentStatus === "Paid" ? "success" : "warning"} className="text-[10px]">{p.paymentStatus}</Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-sm">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}</TableCell>
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
