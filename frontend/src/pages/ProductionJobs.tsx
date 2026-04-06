import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi, bomApi, inventoryApi, downloadReportCsv } from "@/lib/api";
import { SavedViewsBar } from "@/components/SavedViewsBar";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";

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

interface JobOp {
  sequence: number;
  code: string;
  name: string;
  workCenterCode: string;
  status: string;
  plannedSetupMin?: number;
  plannedRunMin?: number;
  actualLaborMin?: number;
  scrapQty?: number;
  reworkQty?: number;
}

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
  /** Inventory consume/output posted when job completed */
  inventoryPosted?: boolean;
  materialsReserved?: boolean;
  operations?: JobOp[];
  travelerToken?: string;
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
  Download,
  ExternalLink,
  RefreshCw,
  Play,
  CheckCircle2,
  Timer,
  Layers,
} from "lucide-react";

const ITEMS_PER_PAGE = 8;

import { ProductionMetrics } from "@/components/ProductionMetrics";

const ProductionJobs = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [opMinutes, setOpMinutes] = useState("15");
  const [opNote, setOpNote] = useState("");
  const [scrapIn, setScrapIn] = useState("0");
  const [reworkIn, setReworkIn] = useState("0");
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

  const [issueProductId, setIssueProductId] = useState("");
  const [issueQty, setIssueQty] = useState(1);
  const [issueLot, setIssueLot] = useState("");
  const [issueSerial, setIssueSerial] = useState("");
  const [outputLot, setOutputLot] = useState("");
  const [outputExpiry, setOutputExpiry] = useState("");

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
  });

  const { data: boms = [] } = useQuery({
    queryKey: ['boms'],
    queryFn: bomApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.getAll,
  });

  useEffect(() => {
    const action = searchParams.get("action");
    const jobParam = searchParams.get("job");
    const statusParam = searchParams.get("status");
    const validStatuses: JobStatus[] = [
      "Scheduled",
      "In Progress",
      "On Hold",
      "Completed",
      "Cancelled",
    ];

    const syncKeys: string[] = [];
    if (action === "new") {
      setNewJobOpen(true);
      syncKeys.push("action");
    }
    if (statusParam && validStatuses.includes(statusParam as JobStatus)) {
      setStatusFilter(statusParam);
      setPage(1);
      syncKeys.push("status");
    }
    if (syncKeys.length > 0) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          syncKeys.forEach((k) => n.delete(k));
          return n;
        },
        { replace: true },
      );
    }

    /* Wait until URL-only deep links (e.g. job) run alone, so we don't double-fetch after stripping status/action */
    if (!jobParam || syncKeys.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const full = await productionApi.getOne(jobParam);
        if (!cancelled) setSelectedJob(full as Job);
      } catch {
        if (!cancelled) toast.error("Could not open that job. It may have been removed.");
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("job");
              return n;
            },
            { replace: true },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  const createJobMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => productionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
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
    onError: (err: { response?: { data?: { message?: string; error?: string } } }) => {
      toast.error(
        err?.response?.data?.message || err?.response?.data?.error || "Failed to create job"
      );
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      productionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success("Status updated");
      setUpdateStatusJob(null);
      setSelectedJob(null);
    },
    onError: (err: { response?: { data?: { message?: string; error?: string } } }) => {
      toast.error(
        err?.response?.data?.message || err?.response?.data?.error || "Failed to update job"
      );
    },
  });

  const reserveMaterialsMutation = useMutation({
    mutationFn: (jobId: string) => productionApi.reserveMaterials(jobId),
    onSuccess: async (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["mrp"] });
      toast.success("Materials reserved for this job");
      try {
        const fresh = await productionApi.getOne(jobId);
        setSelectedJob(fresh as Job);
      } catch {
        /* keep dialog */
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not reserve materials");
    },
  });

  const refreshJob = async (id: string) => {
    const fresh = await productionApi.getOne(id);
    setSelectedJob(fresh as Job);
  };

  const syncOpsMut = useMutation({
    mutationFn: (id: string) => productionApi.syncOperations(id),
    onSuccess: async (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Operations synced from BOM routing");
      await refreshJob(id);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Sync failed"),
  });

  const shopFloorMut = useMutation({
    mutationFn: async ({
      action,
      jobId,
      opIndex,
    }: {
      action: "start" | "complete" | "time" | "scrap";
      jobId: string;
      opIndex: number;
    }) => {
      if (action === "start") return productionApi.startOperation(jobId, opIndex);
      if (action === "complete") return productionApi.completeOperation(jobId, opIndex);
      if (action === "time") {
        const m = parseFloat(opMinutes);
        if (!m || m <= 0) throw new Error("Minutes required");
        return productionApi.logOperationTime(jobId, opIndex, { minutes: m, note: opNote });
      }
      return productionApi.scrapReworkOperation(jobId, opIndex, {
        scrapQty: parseFloat(scrapIn) || 0,
        reworkQty: parseFloat(reworkIn) || 0,
      });
    },
    onSuccess: async (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Updated");
      await refreshJob(v.jobId);
      setOpNote("");
    },
    onError: (e: Error | { message?: string }) =>
      toast.error((e as Error).message || "Action failed"),
  });

  const issueMaterialMut = useMutation({
    mutationFn: (data: { jobId: string; productId: string; quantity: number; lotNumber?: string; serialNumber?: string }) =>
      productionApi.issueMaterial(data.jobId, data),
    onSuccess: async (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Material issued to job");
      await refreshJob(vars.jobId);
      setIssueProductId("");
      setIssueQty(1);
      setIssueLot("");
      setIssueSerial("");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message || "Issue failed"),
  });

  const travelerBase =
    (import.meta.env.VITE_API_BASE_URL as string)?.replace(/\/api\/?$/i, "") ||
    "http://localhost:5000";

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

  const jobStats = useMemo(() => {
    const list = allJobs as Job[];
    const now = Date.now();
    const weekEnd = now + 7 * 86400000;
    return {
      total: list.length,
      inProgress: list.filter((j) => j.status === "In Progress").length,
      scheduled: list.filter((j) => j.status === "Scheduled").length,
      completed: list.filter((j) => j.status === "Completed").length,
      openPipeline: list.filter((j) => j.status !== "Completed" && j.status !== "Cancelled").length,
      dueWithinWeek: list.filter((j) => {
        if (j.status === "Completed" || j.status === "Cancelled") return false;
        const t = new Date(j.dueDate).getTime();
        return t >= now && t <= weekEnd;
      }).length,
    };
  }, [allJobs]);

  return (
    <div
      className={`${embedded ? "space-y-6" : "space-y-6 pb-8"} animate-in fade-in duration-500 slide-in-from-bottom-4`}
    >
      {!embedded && (
        <>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.jobs.title")}</h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{t("pages.jobs.subtitle")}</p>
            </div>
            <div className="hidden items-center gap-6 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Open pipeline</p>
                <p className="text-sm font-semibold text-foreground">{jobStats.openPipeline}</p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">In progress</p>
                <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">{jobStats.inProgress}</p>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Due ≤ 7 days</p>
                <p className="text-sm font-semibold text-foreground">{jobStats.dueWithinWeek}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total jobs",
                value: jobStats.total,
                icon: Layers,
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                label: "In progress",
                value: jobStats.inProgress,
                icon: Wrench,
                color: "text-[hsl(152,69%,36%)]",
                bg: "bg-[hsl(152,69%,42%)]/10",
              },
              {
                label: "Scheduled",
                value: jobStats.scheduled,
                icon: Clock,
                color: "text-[hsl(221,83%,53%)]",
                bg: "bg-primary/10",
              },
              {
                label: "Completed",
                value: jobStats.completed,
                icon: CheckCircle2,
                color: "text-muted-foreground",
                bg: "bg-muted",
              },
            ].map((stat, idx) => (
              <Card
                key={idx}
                className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
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
        </>
      )}

      {/* Ring metrics — Production hub only (avoid duplicating KPI rows on full jobs page) */}
      {embedded ? <ProductionMetrics /> : null}

      {/* Control Bar */}
      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardContent className="space-y-4 p-4 sm:p-5">
          {!embedded ? (
            <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#1a2744]">Search & filters</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Status chips, saved views, and export</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-full border-primary/20 shadow-erp-sm"
                  onClick={() =>
                    downloadReportCsv("/reports/export/production", `production-${Date.now()}.csv`).catch(() =>
                      toast.error("Export failed")
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={() => setNewJobOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  New production job
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Open jobs, filters, and floor actions
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-full border-primary/20 shadow-erp-sm"
                  onClick={() =>
                    downloadReportCsv("/reports/export/production", `production-${Date.now()}.csv`).catch(() =>
                      toast.error("Export failed")
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={() => setNewJobOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  New production job
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50"
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50"
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
                className="h-10 rounded-full border-0 bg-[#EEF2F7] pl-9 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
              />
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <SavedViewsBar
                module="production"
                filters={{ search, statusFilter, priorityFilter }}
                onApply={(f) => {
                  if (f.search != null) setSearch(String(f.search));
                  if (f.statusFilter != null) setStatusFilter(String(f.statusFilter));
                  if (f.priorityFilter != null) setPriorityFilter(String(f.priorityFilter));
                  setPage(1);
                }}
              />
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[160px] rounded-full border-border/60 bg-muted/40">
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
                <SelectTrigger className="h-10 w-[140px] rounded-full border-border/60 bg-muted/40">
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
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 pt-5">
          <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Job register</CardTitle>
          <p className="text-sm font-medium text-muted-foreground">Open a row for shop-floor operations and materials</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/25">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="h-12 pl-6 text-xs font-bold text-foreground">
                    Job ID
                  </TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Client</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Part Name</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Machine</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Priority</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Qty</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Due Date</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Status</TableHead>
                  <TableHead className="h-12 text-xs font-bold text-foreground">Progress</TableHead>
                  <TableHead className="h-12 pr-6 text-xs font-bold text-foreground">Actions</TableHead>
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
                    <TableCell colSpan={10} className="py-20 text-center font-medium text-muted-foreground">
                      No jobs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((job) => (
                    <TableRow
                      key={job._id}
                      className="cursor-pointer transition-colors hover:bg-muted/40 border-border/40 group"
                      onClick={async () => {
                        try {
                          const full = await productionApi.getOne(job._id);
                          setSelectedJob(full as Job);
                        } catch {
                          setSelectedJob(job);
                        }
                      }}
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
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={statusVariant[job.status]} className="text-[10px] font-black uppercase tracking-tight py-0 px-2 rounded-md w-fit">
                            {job.status}
                          </Badge>
                          {job.status === "Completed" && job.inventoryPosted && (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">
                              Stock posted
                            </span>
                          )}
                        </div>
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
            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border/50 bg-muted/10 px-6 py-4 sm:flex-row sm:items-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length} jobs
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-border/60 bg-card shadow-erp-sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 font-mono text-xs font-bold shadow-erp-sm">
                  {page} <span className="text-muted-foreground">/</span> {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-border/60 bg-card shadow-erp-sm"
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 shadow-erp sm:max-w-3xl">
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

              <div className="flex flex-wrap gap-2 border-b py-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1 rounded-full border-primary/20"
                  disabled={syncOpsMut.isPending}
                  onClick={() => syncOpsMut.mutate(selectedJob._id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync ops from BOM
                </Button>
                {selectedJob.travelerToken && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 gap-1 rounded-full"
                    onClick={() =>
                      window.open(
                        `${travelerBase}/api/production/traveler/${selectedJob.travelerToken}.html`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Traveler (print)
                  </Button>
                )}
              </div>

              <div className="space-y-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop floor — operations</p>
                {!selectedJob.operations?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No operations yet. Add routing to the BOM, then <strong>Sync ops from BOM</strong>.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Op</th>
                          <th className="text-left p-2">WC</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-right p-2">Labor</th>
                          <th className="text-right p-2">S/R</th>
                          <th className="text-right p-2 w-[200px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJob.operations.map((op, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2 font-mono">{i + 1}</td>
                            <td className="p-2">
                              <span className="font-bold">{op.code}</span> {op.name}
                            </td>
                            <td className="p-2">{op.workCenterCode || "—"}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px]">
                                {op.status}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">{op.actualLaborMin ?? 0} min</td>
                            <td className="p-2 text-right text-muted-foreground">
                              {op.scrapQty || 0}/{op.reworkQty || 0}
                            </td>
                            <td className="p-2 text-right space-x-1">
                              {op.status !== "done" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    disabled={shopFloorMut.isPending}
                                    onClick={() =>
                                      shopFloorMut.mutate({
                                        action: "start",
                                        jobId: selectedJob._id,
                                        opIndex: i,
                                      })
                                    }
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    disabled={shopFloorMut.isPending}
                                    onClick={() =>
                                      shopFloorMut.mutate({
                                        action: "complete",
                                        jobId: selectedJob._id,
                                        opIndex: i,
                                      })
                                    }
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    title="Log time"
                                    disabled={shopFloorMut.isPending}
                                    onClick={() =>
                                      shopFloorMut.mutate({
                                        action: "time",
                                        jobId: selectedJob._id,
                                        opIndex: i,
                                      })
                                    }
                                  >
                                    <Timer className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                disabled={shopFloorMut.isPending}
                                onClick={() =>
                                  shopFloorMut.mutate({
                                    action: "scrap",
                                    jobId: selectedJob._id,
                                    opIndex: i,
                                  })
                                }
                              >
                                +S/R
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-end text-xs">
                  <div>
                    <Label className="text-[10px]">Log time (min)</Label>
                    <Input
                      className="h-8 w-20 mt-0.5"
                      value={opMinutes}
                      onChange={(e) => setOpMinutes(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <Label className="text-[10px]">Note</Label>
                    <Input
                      className="h-8 mt-0.5"
                      value={opNote}
                      onChange={(e) => setOpNote(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Scrap qty</Label>
                    <Input
                      className="h-8 w-16 mt-0.5"
                      value={scrapIn}
                      onChange={(e) => setScrapIn(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Rework</Label>
                    <Input
                      className="h-8 w-16 mt-0.5"
                      value={reworkIn}
                      onChange={(e) => setReworkIn(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                       <Package className="h-3.5 w-3.5" />
                       Shop floor — materials
                    </p>
                  </div>
                  
                  {/* Issued Transactions List */}
                  {((selectedJob as any).materialTransactions?.length || 0) > 0 ? (
                    <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-2 font-bold uppercase tracking-tighter opacity-70">Material SKU</th>
                            <th className="text-right p-2 font-bold uppercase tracking-tighter opacity-70">Qty</th>
                            <th className="text-left p-2 font-bold uppercase tracking-tighter opacity-70">Lot/Serial Tracking</th>
                            <th className="text-right p-2 font-bold uppercase tracking-tighter opacity-70">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((selectedJob as any).materialTransactions || []).map((tx: any, txi: number) => {
                            const pObj = products.find((p: any) => p._id === (tx.product?._id || tx.product));
                            return (
                              <tr key={txi} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="p-2">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-primary">{pObj?.sku || "Resource"}</span>
                                    <span className="text-[9px] opacity-60 truncate max-w-[150px]">{pObj?.name || ""}</span>
                                  </div>
                                </td>
                                <td className="p-2 text-right font-mono font-bold">{tx.quantity}</td>
                                <td className="p-2">
                                  <div className="flex flex-wrap gap-1">
                                    {tx.lotNumber && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 lowercase font-mono">lot:{tx.lotNumber}</Badge>
                                    )}
                                    {tx.serialNumber && (
                                      <Badge variant="secondary" className="text-[9px] h-4 px-1 lowercase font-mono">sn:{tx.serialNumber}</Badge>
                                    )}
                                    {!tx.lotNumber && !tx.serialNumber && (
                                      <span className="text-[10px] text-muted-foreground opacity-50">Bulk (untracked)</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-right text-muted-foreground whitespace-nowrap opacity-70">
                                  {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
                      <Package className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No materials issued to this job yet.</p>
                    </div>
                  )}

                  {/* Issuance Form */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Issue Resource from Stock</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold ml-1">Select SKUs</Label>
                        <Select value={issueProductId} onValueChange={v => {
                          setIssueProductId(v);
                          setIssueLot("");
                          setIssueSerial("");
                        }}>
                          <SelectTrigger className="h-9 rounded-lg bg-card border-border/60">
                            <SelectValue placeholder="Resource to issue..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {products.length === 0 && <SelectItem value="loading" disabled>Loading resources...</SelectItem>}
                            {products.map((p: any) => (
                              <SelectItem key={p._id} value={p._id}>
                                <div className="flex flex-col items-start gap-0">
                                  <span className="text-xs font-bold">{p.sku}</span>
                                  <span className="text-[9px] opacity-60">{p.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold ml-1">Issuance Quantity</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="h-9 rounded-lg bg-card border-border/60 font-mono" 
                            value={issueQty} 
                            onChange={(e) => setIssueQty(parseFloat(e.target.value) || 0)} 
                          />
                          <span className="text-[10px] font-bold opacity-50">units</span>
                        </div>
                      </div>
                    </div>

                    {issueProductId && (() => {
                      const pObj = products.find((p: any) => p._id === issueProductId);
                      if (!pObj) return null;
                      
                      const showBatch = pObj.trackingMethod === 'batch';
                      const showSerial = pObj.trackingMethod === 'serial';

                      if (!showBatch && !showSerial) return null;

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/40 p-3 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-2">
                          {showBatch && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold ml-1">Identify Lot / Batch</Label>
                              <Input 
                                className="h-9 rounded-lg font-mono text-xs uppercase" 
                                placeholder="BATCH-ID" 
                                value={issueLot} 
                                onChange={(e) => setIssueLot(e.target.value)} 
                              />
                            </div>
                          )}
                          {showSerial && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold ml-1">Identify Individual Serial</Label>
                              <Input 
                                className="h-9 rounded-lg font-mono text-xs uppercase" 
                                placeholder="SERIAL-ID" 
                                value={issueSerial} 
                                onChange={(e) => setIssueSerial(e.target.value)} 
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <Button 
                      className="w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
                      disabled={!issueProductId || issueQty <= 0 || issueMaterialMut.isPending}
                      onClick={() => {
                        const pObj = products.find((p: any) => p._id === issueProductId);
                        if (pObj?.trackingMethod === 'batch' && !issueLot) {
                          toast.error("Lot/Batch number is required for this resource");
                          return;
                        }
                        if (pObj?.trackingMethod === 'serial' && !issueSerial) {
                          toast.error("Serial number is required for this resource");
                          return;
                        }

                        issueMaterialMut.mutate({
                          jobId: selectedJob._id,
                          productId: issueProductId,
                          quantity: issueQty,
                          lotNumber: issueLot,
                          serialNumber: issueSerial,
                        });
                      }}
                    >
                      {issueMaterialMut.isPending ? "Posting to ledger..." : (
                        <><Play className="h-3 w-3" /> Execute Material Issue</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

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

              {["Scheduled", "In Progress", "On Hold"].includes(selectedJob.status) && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground border-t">
                  {selectedJob.materialsReserved ? (
                    <Badge variant="secondary" className="text-[10px]">Materials reserved</Badge>
                  ) : (
                    <span>Allocate BOM components so other orders see lower ATP.</span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto h-8"
                    disabled={reserveMaterialsMutation.isPending}
                    onClick={() => reserveMaterialsMutation.mutate(selectedJob._id)}
                  >
                    Reserve BOM materials
                  </Button>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" className="rounded-full" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
                <Button className="rounded-full" onClick={() => setUpdateStatusJob(selectedJob)}>
                  Update status
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Job Dialog */}
      <Dialog open={newJobOpen} onOpenChange={setNewJobOpen}>
        <DialogContent className="rounded-2xl border border-border/60 shadow-erp sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1a2744]">New production job</DialogTitle>
            <DialogDescription>Create a work order from an active BOM.</DialogDescription>
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
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setNewJobOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
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
        <DialogContent className="rounded-2xl border border-border/60 shadow-erp sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold text-[#1a2744]">Update job status</DialogTitle>
            <DialogDescription>{updateStatusJob?.jobId}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold ml-1">New Status</Label>
              <Select
                value={updateStatusJob?.status ?? ""}
                onValueChange={(value) => {
                  if (!updateStatusJob) return;
                  setUpdateStatusJob({ ...updateStatusJob, status: value as JobStatus });
                }}
              >
                <SelectTrigger className="h-10 rounded-xl border-border/60 bg-muted/20">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {(["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"] as const).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {updateStatusJob?.status === "Completed" && (
              <div className="space-y-4 p-3 rounded-xl bg-primary/5 border border-primary/10 animate-in zoom-in-95 duration-200">
                 <div className="flex items-center gap-2 mb-1">
                   <div className="h-1 w-3 rounded-full bg-primary" />
                   <p className="text-[9px] font-black uppercase text-primary tracking-widest">Output Inventory Tracking</p>
                 </div>
                 
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold ml-1">Output Lot/Batch #</Label>
                   <Input 
                     className="h-9 rounded-lg bg-card font-mono text-xs uppercase" 
                     placeholder="B-2024-XXXX" 
                     value={outputLot} 
                     onChange={(e) => setOutputLot(e.target.value)} 
                   />
                 </div>

                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold ml-1">Expiration Date (optional)</Label>
                   <Input 
                     type="date"
                     className="h-9 rounded-lg bg-card" 
                     value={outputExpiry} 
                     onChange={(e) => setOutputExpiry(e.target.value)} 
                   />
                 </div>
              </div>
            )}

            <Button 
              className="w-full h-10 rounded-xl font-bold uppercase text-[10px] tracking-wider"
              onClick={() => {
                if (!updateStatusJob) return;
                updateJobMutation.mutate({
                  id: updateStatusJob._id,
                  data: { 
                    status: updateStatusJob.status,
                    outputLotNumber: updateStatusJob.status === 'Completed' ? outputLot : undefined,
                    outputExpirationDate: updateStatusJob.status === 'Completed' ? (outputExpiry || undefined) : undefined
                  },
                });
              }}
              disabled={updateJobMutation.isPending}
            >
              {updateJobMutation.isPending ? "Updating..." : "Confirm & Save Status"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductionJobs;
