import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Wrench,
  User,
  Package,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

type JobStatus = "In Production" | "Queued" | "Delayed" | "QC Review" | "Completed";
type Priority = "High" | "Medium" | "Low";

const statusVariant: Record<JobStatus, "success" | "info" | "destructive" | "warning" | "secondary"> = {
  "In Production": "success",
  Queued: "info",
  Delayed: "destructive",
  "QC Review": "warning",
  Completed: "secondary",
};

const priorityVariant: Record<Priority, "destructive" | "warning" | "info"> = {
  High: "destructive",
  Medium: "warning",
  Low: "info",
};

interface Job {
  id: string;
  client: string;
  part: string;
  machine: string;
  status: JobStatus;
  progress: number;
  priority: Priority;
  quantity: number;
  dueDate: string;
  operator: string;
  startDate: string;
}

const allJobs: Job[] = [
  {
    id: "JOB-1042",
    client: "Apex Aerostructures",
    part: "Turbine Bracket T-7",
    machine: "CNC Mill #3",
    status: "In Production",
    progress: 72,
    priority: "High",
    quantity: 24,
    dueDate: "2026-03-14",
    operator: "Mike Torres",
    startDate: "2026-03-08",
  },
  {
    id: "JOB-1043",
    client: "Pacific Auto Group",
    part: "Drive Shaft Coupling",
    machine: "Lathe #1",
    status: "In Production",
    progress: 45,
    priority: "Medium",
    quantity: 50,
    dueDate: "2026-03-18",
    operator: "Sarah Chen",
    startDate: "2026-03-09",
  },
  {
    id: "JOB-1044",
    client: "NovaMed Devices",
    part: "Implant Housing MK-II",
    machine: "5-Axis #2",
    status: "Delayed",
    progress: 18,
    priority: "High",
    quantity: 12,
    dueDate: "2026-03-12",
    operator: "James Park",
    startDate: "2026-03-06",
  },
  {
    id: "JOB-1045",
    client: "Summit Construction",
    part: "Steel Plate Weldment",
    machine: "Welding Bay",
    status: "Queued",
    progress: 0,
    priority: "Low",
    quantity: 8,
    dueDate: "2026-03-22",
    operator: "Unassigned",
    startDate: "—",
  },
  {
    id: "JOB-1046",
    client: "Apex Aerostructures",
    part: "Wing Rib Section 4A",
    machine: "CNC Mill #1",
    status: "QC Review",
    progress: 95,
    priority: "High",
    quantity: 6,
    dueDate: "2026-03-13",
    operator: "Mike Torres",
    startDate: "2026-03-07",
  },
  {
    id: "JOB-1047",
    client: "Delta Marine",
    part: "Propeller Hub Assembly",
    machine: "CNC Mill #2",
    status: "In Production",
    progress: 60,
    priority: "Medium",
    quantity: 4,
    dueDate: "2026-03-16",
    operator: "Lisa Nguyen",
    startDate: "2026-03-10",
  },
  {
    id: "JOB-1048",
    client: "Pacific Auto Group",
    part: "Transmission Case",
    machine: "5-Axis #1",
    status: "Queued",
    progress: 0,
    priority: "Medium",
    quantity: 20,
    dueDate: "2026-03-25",
    operator: "Unassigned",
    startDate: "—",
  },
  {
    id: "JOB-1049",
    client: "NovaMed Devices",
    part: "Surgical Guide Rail",
    machine: "Lathe #2",
    status: "Completed",
    progress: 100,
    priority: "High",
    quantity: 30,
    dueDate: "2026-03-10",
    operator: "Sarah Chen",
    startDate: "2026-03-03",
  },
  {
    id: "JOB-1050",
    client: "Summit Construction",
    part: "Anchor Bolt Plate",
    machine: "Press Brake",
    status: "In Production",
    progress: 33,
    priority: "Low",
    quantity: 100,
    dueDate: "2026-03-20",
    operator: "James Park",
    startDate: "2026-03-11",
  },
  {
    id: "JOB-1051",
    client: "Apex Aerostructures",
    part: "Fuselage Frame F-12",
    machine: "5-Axis #2",
    status: "Delayed",
    progress: 10,
    priority: "High",
    quantity: 2,
    dueDate: "2026-03-11",
    operator: "Mike Torres",
    startDate: "2026-03-05",
  },
];

const ITEMS_PER_PAGE = 8;

const ProductionJobs = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filtered = allJobs.filter((job) => {
    const matchesSearch =
      search === "" ||
      job.id.toLowerCase().includes(search.toLowerCase()) ||
      job.client.toLowerCase().includes(search.toLowerCase()) ||
      job.part.toLowerCase().includes(search.toLowerCase()) ||
      job.operator.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || job.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusCounts = allJobs.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Production Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all shop floor production orders
          </p>
        </div>
        <Button className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          New Job
        </Button>
      </div>

      {/* Status Summary Pills */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(statusCounts) as [JobStatus, number][]).map(([status, count]) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(statusFilter === status ? "all" : status);
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === status
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {status}
            <span className="font-mono">{count}</span>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, clients, parts…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="In Production">In Production</SelectItem>
              <SelectItem value="Queued">Queued</SelectItem>
              <SelectItem value="Delayed">Delayed</SelectItem>
              <SelectItem value="QC Review">QC Review</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(v) => {
              setPriorityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jobs Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pl-6">
                    Job ID
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Client
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Part Name
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Machine
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Qty
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Due Date
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Progress
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No jobs match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((job) => (
                    <TableRow key={job.id} className="cursor-pointer" onClick={() => setSelectedJob(job)}>
                      <TableCell className="pl-6 font-mono text-sm font-medium">
                        {job.id}
                      </TableCell>
                      <TableCell className="text-sm">{job.client}</TableCell>
                      <TableCell className="text-sm">{job.part}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.machine}</TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant[job.priority]} className="text-[11px]">
                          {job.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{job.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[job.status]} className="text-[11px]">
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={job.progress} className="h-2 flex-1" />
                          <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                            {job.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length} jobs
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">{selectedJob.id}</span>
                  <Badge variant={statusVariant[selectedJob.status]} className="text-[11px]">
                    {selectedJob.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedJob.part}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Client
                  </p>
                  <p className="text-sm font-medium">{selectedJob.client}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" /> Machine
                  </p>
                  <p className="text-sm font-medium">{selectedJob.machine}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Operator
                  </p>
                  <p className="text-sm font-medium">{selectedJob.operator}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Quantity
                  </p>
                  <p className="text-sm font-medium">{selectedJob.quantity} pcs</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Start Date
                  </p>
                  <p className="text-sm font-medium">{selectedJob.startDate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Due Date
                  </p>
                  <p className="text-sm font-medium">{selectedJob.dueDate}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-medium">{selectedJob.progress}%</span>
                </div>
                <Progress value={selectedJob.progress} className="h-2.5" />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
                <Button>Update Status</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductionJobs;
