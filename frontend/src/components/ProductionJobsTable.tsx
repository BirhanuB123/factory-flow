import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productionApi } from "@/lib/api";
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

type JobStatus = "Scheduled" | "In Progress" | "On Hold" | "Completed" | "Cancelled";

const statusVariant: Record<JobStatus, "success" | "info" | "destructive" | "warning" | "secondary"> = {
  "In Progress": "success",
  Scheduled: "info",
  "On Hold": "warning",
  Cancelled: "destructive",
  Completed: "secondary",
};

export function ProductionJobsTable() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["production-jobs"],
    queryFn: productionApi.getAll,
  });

  const displayJobs = (jobs as { _id: string; jobId: string; bom?: { name: string }; status: JobStatus; progress?: number }[])
    .filter((j) => j.status !== "Cancelled" && j.status !== "Completed")
    .slice(0, 8);

  return (
    <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Live Factory Operations
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight h-5">
          {displayJobs.length} Running
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pl-6">Job ID</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Part Name</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pr-6">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : displayJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No active jobs.
                  </TableCell>
                </TableRow>
              ) : (
                displayJobs.map((job) => (
                  <TableRow
                    key={job._id}
                    className="cursor-pointer"
                    onClick={() => navigate("/jobs")}
                  >
                    <TableCell className="pl-6 font-mono text-sm font-medium">{job.jobId}</TableCell>
                    <TableCell className="text-sm">{job.bom?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[job.status] ?? "secondary"} className="text-[11px]">
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center gap-2.5 min-w-[120px]">
                        <Progress value={job.progress ?? 0} className="h-2 flex-1" />
                        <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                          {job.progress ?? 0}%
                        </span>
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
  );
}
