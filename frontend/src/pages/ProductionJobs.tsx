import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi, bomApi } from "@/lib/api";
import { toast } from "sonner";

type JobStatus = "Scheduled" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
type Priority = "Low" | "Medium" | "High" | "Urgent";

const statusVariant: Record<JobStatus, "success" | "info" | "destructive" | "warning" | "secondary"> = {
  "In Progress": "success",
  "Scheduled": "info",
  "On Hold": "warning",
  "Cancelled": "destructive",
  "Completed": "secondary",
};

const priorityVariant: Record<Priority, "destructive" | "warning" | "info" | "secondary"> = {
  High: "destructive",
  Urgent: "destructive",
  Medium: "warning",
  Low: "info",
};

interface Job {
  _id: string;
  jobId: string;
  bom: {
    _id: string;
    name: string;
    partNumber: string;
  };
  quantity: number;
  status: JobStatus;
  priority: Priority;
  dueDate: string;
  assignedTo: string;
  notes: string;
  progress?: number;
}

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
import { Label } from "@/components/ui/label";
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

const ITEMS_PER_PAGE = 8;

import { ProductionMetrics } from "@/components/ProductionMetrics";

const ProductionJobs = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [updateStatusJob, setUpdateStatusJob] = useState<Job | null>(null);
  const [newJobForm, setNewJobForm] = useState({
    jobId: "",
    bom: "",
    quantity: 1,
    status: "Scheduled" as JobStatus,
    priority: "Medium" as Priority,
    dueDate: new Date().toISOString().slice(0, 10),
    assignedTo: "",
    notes: "",
  });

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['production-jobs'],
    queryFn: productionApi.getAll,
  });

  const { data: boms = [] } = useQuery({
    queryKey: ['boms'],
    queryFn: bomApi.getAll,
  });

  const createJobMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => productionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-jobs'] });
      toast.success("Job created");
      setNewJobOpen(false);
      setNewJobForm({
        jobId: "",
        bom: "",
        quantity: 1,
        status: "Scheduled",
        priority: "Medium",
        dueDate: new Date().toISOString().slice(0, 10),
        assignedTo: "",
        notes: "",
      });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to create job");
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      productionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-jobs'] });
      toast.success("Status updated");
      setUpdateStatusJob(null);
      setSelectedJob(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Failed to update job");
    },
  });

  const filtered = allJobs.filter((job: Job) => {
    const matchesSearch =
      search === "" ||
      job.jobId.toLowerCase().includes(search.toLowerCase()) ||
      job.bom?.name.toLowerCase().includes(search.toLowerCase()) ||
      job.assignedTo?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || job.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusCounts = allJobs.reduce(
    (acc: Record<string, number>, job: Job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Metrics Section */}
      <ProductionMetrics />

      {/* Control Bar */}
      <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold tracking-tight">Active Processes</h2>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Shop Floor Control</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl h-10" 
                onClick={() => setNewJobOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="font-bold">New Production Job</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              All Jobs
            </button>
            {(Object.entries(statusCounts) as [JobStatus, number][]).map(([status, count]) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(statusFilter === status ? "all" : status);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "bg-background text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {status}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === status ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/50">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs, clients, parts…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-background/50 border-border/80 focus-visible:ring-primary/20 h-10 rounded-xl"
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
                <SelectTrigger className="w-[160px] bg-background/50 border-border/80 h-10 rounded-xl">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={priorityFilter}
                onValueChange={(v) => {
                  setPriorityFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px] bg-background/50 border-border/80 h-10 rounded-xl">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card className="border-none shadow-md bg-card/60 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground pl-6 h-12">
                    Job ID
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Client
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Part Name
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Machine
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Priority
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Qty
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Due Date
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground h-12">
                    Progress
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-foreground pr-6 h-12">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-medium">
                      Loading production floor data...
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-medium">
                      Critical: No active jobs found matching filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((job) => (
                    <TableRow 
                      key={job._id} 
                      className="cursor-pointer transition-colors hover:bg-muted/40 border-border/40 group" 
                      onClick={() => setSelectedJob(job)}
                    >
                      <TableCell className="pl-6 font-mono text-xs font-bold text-primary">
                        {job.jobId}
                      </TableCell>
                      <TableCell className="text-[13px] font-semibold opacity-90">Internal Production</TableCell>
                      <TableCell className="text-[13px] font-bold">{job.bom?.name}</TableCell>
                      <TableCell className="text-[13px] font-medium text-muted-foreground">Standard Op</TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant[job.priority]} className="text-[10px] font-black uppercase tracking-tight py-0 px-2 rounded-md">
                          {job.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] font-mono font-bold">{job.quantity}</TableCell>
                      <TableCell className="text-[13px] font-medium text-muted-foreground">{new Date(job.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[job.status]} className="text-[10px] font-black uppercase tracking-tight py-0 px-2 rounded-md">
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <Progress value={job.progress || 0} className="h-1.5 flex-1 bg-muted" />
                          <span className="text-[11px] font-mono font-bold text-muted-foreground w-8 text-right">
                            {job.progress || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                        >
                          <Eye className="h-4 w-4 text-primary" />
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length} active jobs
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-border/50 bg-background/50 rounded-xl"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 px-3 py-1 bg-background/50 border border-border/50 rounded-xl font-mono text-xs font-bold">
                  {page} <span className="text-muted-foreground">/</span> {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-border/50 bg-background/50 rounded-xl"
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
                  <span className="font-mono">{selectedJob.jobId}</span>
                  <Badge variant={statusVariant[selectedJob.status]} className="text-[11px]">
                    {selectedJob.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedJob.bom?.name} · {selectedJob.bom?.partNumber}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Assigned To
                  </p>
                  <p className="text-sm font-medium">{selectedJob.assignedTo || "Unassigned"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Quantity
                  </p>
                  <p className="text-sm font-medium">{selectedJob.quantity} pcs</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Due Date
                  </p>
                  <p className="text-sm font-medium">{new Date(selectedJob.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedJob.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedJob.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-medium">{selectedJob.progress || 0}%</span>
                </div>
                <Progress value={selectedJob.progress || 0} className="h-2.5" />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
                <Button onClick={() => setUpdateStatusJob(selectedJob)}>Update Status</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Job Dialog */}
      <Dialog open={newJobOpen} onOpenChange={setNewJobOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Production Job</DialogTitle>
            <DialogDescription>Create a new production order from a BOM.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Job ID</Label>
              <Input
                value={newJobForm.jobId}
                onChange={(e) => setNewJobForm((p) => ({ ...p, jobId: e.target.value }))}
                placeholder="e.g. JOB-1050"
              />
            </div>
            <div className="space-y-2">
              <Label>BOM</Label>
              <Select
                value={newJobForm.bom}
                onValueChange={(v) => setNewJobForm((p) => ({ ...p, bom: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select BOM" /></SelectTrigger>
                <SelectContent>
                  {(boms as { _id: string; name: string; partNumber: string }[]).map((b) => (
                    <SelectItem key={b._id} value={b._id}>{b.name} ({b.partNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={newJobForm.quantity}
                  onChange={(e) => setNewJobForm((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newJobForm.dueDate}
                  onChange={(e) => setNewJobForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newJobForm.status}
                  onValueChange={(v) => setNewJobForm((p) => ({ ...p, status: v as JobStatus }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newJobForm.priority}
                  onValueChange={(v) => setNewJobForm((p) => ({ ...p, priority: v as Priority }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Low", "Medium", "High", "Urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input
                value={newJobForm.assignedTo}
                onChange={(e) => setNewJobForm((p) => ({ ...p, assignedTo: e.target.value }))}
                placeholder="Operator name"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={newJobForm.notes}
                onChange={(e) => setNewJobForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewJobOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newJobForm.jobId || !newJobForm.bom || !newJobForm.dueDate) {
                  toast.error("Job ID, BOM, and Due Date are required");
                  return;
                }
                createJobMutation.mutate({
                  jobId: newJobForm.jobId,
                  bom: newJobForm.bom,
                  quantity: newJobForm.quantity,
                  status: newJobForm.status,
                  priority: newJobForm.priority,
                  dueDate: newJobForm.dueDate,
                  assignedTo: newJobForm.assignedTo || undefined,
                  notes: newJobForm.notes || undefined,
                });
              }}
              disabled={createJobMutation.isPending}
            >
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!updateStatusJob} onOpenChange={(open) => !open && setUpdateStatusJob(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Job Status</DialogTitle>
            <DialogDescription>{updateStatusJob?.jobId}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm">Status</Label>
            <Select
              value={updateStatusJob?.status ?? ""}
              onValueChange={(value) => {
                if (!updateStatusJob) return;
                updateJobMutation.mutate({
                  id: updateStatusJob._id,
                  data: { status: value },
                });
              }}
            >
              <SelectTrigger className="mt-2"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {(["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductionJobs;
