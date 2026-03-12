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

type JobStatus = "In Production" | "Queued" | "Delayed" | "QC Review";

const statusVariant: Record<JobStatus, "success" | "info" | "destructive" | "warning"> = {
  "In Production": "success",
  Queued: "info",
  Delayed: "destructive",
  "QC Review": "warning",
};

const jobs = [
  {
    id: "JOB-1042",
    client: "Apex Aerostructures",
    part: "Turbine Bracket T-7",
    machine: "CNC Mill #3",
    status: "In Production" as JobStatus,
    progress: 72,
  },
  {
    id: "JOB-1043",
    client: "Pacific Auto Group",
    part: "Drive Shaft Coupling",
    machine: "Lathe #1",
    status: "In Production" as JobStatus,
    progress: 45,
  },
  {
    id: "JOB-1044",
    client: "NovaMed Devices",
    part: "Implant Housing MK-II",
    machine: "5-Axis #2",
    status: "Delayed" as JobStatus,
    progress: 18,
  },
  {
    id: "JOB-1045",
    client: "Summit Construction",
    part: "Steel Plate Weldment",
    machine: "Welding Bay",
    status: "Queued" as JobStatus,
    progress: 0,
  },
  {
    id: "JOB-1046",
    client: "Apex Aerostructures",
    part: "Wing Rib Section 4A",
    machine: "CNC Mill #1",
    status: "QC Review" as JobStatus,
    progress: 95,
  },
];

export function ProductionJobsTable() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Active Production Jobs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pl-6">Job ID</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Client</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Part Name</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Machine</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground pr-6">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="cursor-pointer">
                  <TableCell className="pl-6 font-mono text-sm font-medium">{job.id}</TableCell>
                  <TableCell className="text-sm">{job.client}</TableCell>
                  <TableCell className="text-sm">{job.part}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{job.machine}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[job.status]} className="text-[11px]">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center gap-2.5 min-w-[120px]">
                      <Progress value={job.progress} className="h-2 flex-1" />
                      <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                        {job.progress}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
