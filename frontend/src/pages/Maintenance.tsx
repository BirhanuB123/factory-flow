import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { manufacturingApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StickyModuleTabs, moduleTabsListClassName, moduleTabsTriggerClassName } from "@/components/ModuleDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast, differenceInMinutes } from "date-fns";
import {
  Wrench, Building2, CalendarClock, AlertTriangle, Plus, Loader2,
  CheckCircle2, Timer, XCircle, Cpu,
} from "lucide-react";

const DOWNTIME_REASONS = [
  { value: "breakdown",    label: "Breakdown / Failure" },
  { value: "maintenance",  label: "Scheduled Maintenance" },
  { value: "changeover",   label: "Changeover / Setup" },
  { value: "material",     label: "Material Shortage" },
  { value: "operator",     label: "Operator Absence" },
  { value: "other",        label: "Other" },
] as const;

function getApiError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  if (typeof data === "string" && data) return data;
  return (e as { message?: string })?.message || fallback;
}

function formatDuration(startedAt: string, endedAt?: string | null): string {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const mins = differenceInMinutes(end, start);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Work Centers Tab ────────────────────────────────────────────────────────

function WorkCentersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [notes, setNotes] = useState("");

  const wcQ = useQuery({
    queryKey: ["manufacturing-work-centers"],
    queryFn: manufacturingApi.getWorkCenters,
  });

  const createMut = useMutation({
    mutationFn: manufacturingApi.createWorkCenter,
    onSuccess: () => {
      toast.success("Work center created");
      setOpen(false);
      setCode(""); setName(""); setHoursPerDay("8"); setNotes("");
      qc.invalidateQueries({ queryKey: ["manufacturing-work-centers"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not create work center")),
  });

  const list = wcQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Work Centers</h2>
          <p className="text-sm text-muted-foreground">Physical production cells and their daily capacity.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Add Work Center
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Code</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Name</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Hrs / Day</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wcQ.isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground/50 italic">No work centers yet</TableCell></TableRow>
              ) : list.map((wc: { _id: string; code: string; name: string; hoursPerDay: number; notes?: string }) => (
                <TableRow key={wc._id} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                  <TableCell className="py-4 px-6 font-bold text-sm font-mono">{wc.code}</TableCell>
                  <TableCell className="py-4 font-medium text-sm">{wc.name}</TableCell>
                  <TableCell className="py-4 text-sm">{wc.hoursPerDay}h</TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground max-w-[300px] truncate">{wc.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> New Work Center
            </DialogTitle>
            <DialogDescription>Define a production cell and its daily capacity.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Code</Label>
                <Input
                  placeholder="WC-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Hours / Day</Label>
                <Input type="number" min="0.5" max="24" step="0.5" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Name</Label>
              <Input placeholder="Assembly Line A" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Notes</Label>
              <Input placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={createMut.isPending || !code.trim() || !name.trim()}
              onClick={() => createMut.mutate({ code, name, hoursPerDay: parseFloat(hoursPerDay) || 8, notes })}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Assets Tab ──────────────────────────────────────────────────────────────

function AssetsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [workCenter, setWorkCenter] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

  const assetsQ = useQuery({ queryKey: ["manufacturing-assets"], queryFn: manufacturingApi.listAssets });
  const wcQ = useQuery({ queryKey: ["manufacturing-work-centers"], queryFn: manufacturingApi.getWorkCenters });

  const createMut = useMutation({
    mutationFn: manufacturingApi.createAsset,
    onSuccess: () => {
      toast.success("Asset created");
      setOpen(false);
      setCode(""); setName(""); setWorkCenter(""); setManufacturer(""); setSerialNumber(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["manufacturing-assets"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not create asset")),
  });

  const list = assetsQ.data ?? [];
  const workCenters = wcQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Assets</h2>
          <p className="text-sm text-muted-foreground">Machines, equipment, and tools tracked for maintenance.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Code</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Name</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Work Center</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Manufacturer</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Serial #</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetsQ.isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground/50 italic">No assets registered yet</TableCell></TableRow>
              ) : list.map((a: { _id: string; code: string; name: string; workCenter?: { code: string; name: string }; manufacturer?: string; serialNumber?: string; active: boolean }) => (
                <TableRow key={a._id} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                  <TableCell className="py-4 px-6 font-bold text-sm font-mono">{a.code}</TableCell>
                  <TableCell className="py-4 font-medium text-sm">{a.name}</TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">{a.workCenter ? `${a.workCenter.code} — ${a.workCenter.name}` : "—"}</TableCell>
                  <TableCell className="py-4 text-sm">{a.manufacturer || "—"}</TableCell>
                  <TableCell className="py-4 text-sm font-mono">{a.serialNumber || "—"}</TableCell>
                  <TableCell className="py-4">
                    <Badge variant={a.active ? "default" : "secondary"} className="text-[10px] uppercase">
                      {a.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> Register Asset
            </DialogTitle>
            <DialogDescription>Add a machine or piece of equipment to track maintenance and downtime.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Asset Code</Label>
                <Input placeholder="CNC-01" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Work Center</Label>
                <Select value={workCenter} onValueChange={setWorkCenter}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {workCenters.map((wc: { _id: string; code: string; name: string }) => (
                      <SelectItem key={wc._id} value={wc._id}>{wc.code} — {wc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Asset Name</Label>
              <Input placeholder="CNC Milling Machine" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Manufacturer</Label>
                <Input placeholder="Haas Automation" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Serial Number</Label>
                <Input placeholder="SN-XXXXXXX" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Notes</Label>
              <Input placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={createMut.isPending || !code.trim() || !name.trim()}
              onClick={() => createMut.mutate({
                code, name,
                workCenter: workCenter && workCenter !== "none" ? workCenter : undefined,
                manufacturer, serialNumber, notes,
              })}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PM Schedules Tab ────────────────────────────────────────────────────────

function PmSchedulesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState("");
  const [title, setTitle] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("30");
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const pmQ = useQuery({ queryKey: ["manufacturing-pm-schedules"], queryFn: manufacturingApi.listPmSchedules });
  const assetsQ = useQuery({ queryKey: ["manufacturing-assets"], queryFn: manufacturingApi.listAssets });

  const createMut = useMutation({
    mutationFn: manufacturingApi.createPmSchedule,
    onSuccess: () => {
      toast.success("PM schedule created");
      setOpen(false);
      setAsset(""); setTitle(""); setFrequencyDays("30"); setNextDueDate(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["manufacturing-pm-schedules"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not create PM schedule")),
  });

  const completeMut = useMutation({
    mutationFn: manufacturingApi.completePm,
    onSuccess: () => {
      toast.success("PM marked complete — next date recalculated");
      qc.invalidateQueries({ queryKey: ["manufacturing-pm-schedules"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not complete PM")),
  });

  const list = pmQ.data ?? [];
  const assets = assetsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">PM Schedules</h2>
          <p className="text-sm text-muted-foreground">Recurring preventive maintenance tasks, sorted by next due date.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New PM Task
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Asset</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Task</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Frequency</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Next Due</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Last Done</TableHead>
                <TableHead className="py-3 px-6 text-right text-[11px] font-bold uppercase tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pmQ.isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground/50 italic">No PM schedules defined yet</TableCell></TableRow>
              ) : list.map((pm: {
                _id: string;
                asset?: { code: string; name: string };
                title: string;
                frequencyDays: number;
                nextDueDate: string;
                lastCompletedAt?: string;
              }) => {
                const overdue = isPast(new Date(pm.nextDueDate));
                return (
                  <TableRow key={pm._id} className={`border-b border-border/20 last:border-0 hover:bg-muted/20 ${overdue ? "bg-destructive/5" : ""}`}>
                    <TableCell className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm font-mono">{pm.asset?.code ?? "—"}</span>
                        <span className="text-[10px] text-muted-foreground">{pm.asset?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-medium text-sm">{pm.title}</TableCell>
                    <TableCell className="py-4 text-sm">Every {pm.frequencyDays}d</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5">
                        {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        <span className={`text-sm font-medium ${overdue ? "text-destructive" : ""}`}>
                          {format(new Date(pm.nextDueDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {overdue ? "Overdue " : ""}{formatDistanceToNow(new Date(pm.nextDueDate), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {pm.lastCompletedAt ? format(new Date(pm.lastCompletedAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-lg text-xs font-bold border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500"
                        disabled={completeMut.isPending && completeMut.variables === pm._id}
                        onClick={() => completeMut.mutate(pm._id)}
                      >
                        {completeMut.isPending && completeMut.variables === pm._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Mark Done
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" /> New PM Schedule
            </DialogTitle>
            <DialogDescription>Create a recurring preventive maintenance task for an asset.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Asset</Label>
              <Select value={asset} onValueChange={setAsset}>
                <SelectTrigger><SelectValue placeholder="Select asset..." /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: { _id: string; code: string; name: string }) => (
                    <SelectItem key={a._id} value={a._id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Task Title</Label>
              <Input placeholder="Oil change & lubrication" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">Frequency (days)</Label>
                <Input type="number" min="1" value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground/70">First Due Date</Label>
                <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Notes</Label>
              <Input placeholder="Optional procedure notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={createMut.isPending || !asset || !title.trim() || !nextDueDate}
              onClick={() => createMut.mutate({
                asset, title,
                frequencyDays: parseInt(frequencyDays, 10) || 30,
                nextDueDate, notes,
              })}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Downtime Tab ─────────────────────────────────────────────────────────────

function DowntimeTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState("");
  const [reasonCode, setReasonCode] = useState("breakdown");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");

  const downtimeQ = useQuery({
    queryKey: ["manufacturing-downtime"],
    queryFn: () => manufacturingApi.listDowntime({ limit: 100 }),
    refetchInterval: 60_000,
  });
  const assetsQ = useQuery({ queryKey: ["manufacturing-assets"], queryFn: manufacturingApi.listAssets });

  const createMut = useMutation({
    mutationFn: manufacturingApi.createDowntime,
    onSuccess: () => {
      toast.success("Downtime event logged");
      setOpen(false);
      setAsset(""); setReasonCode("breakdown"); setDescription(""); setReportedBy("");
      qc.invalidateQueries({ queryKey: ["manufacturing-downtime"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not log downtime")),
  });

  const endMut = useMutation({
    mutationFn: manufacturingApi.endDowntime,
    onSuccess: () => {
      toast.success("Downtime ended");
      qc.invalidateQueries({ queryKey: ["manufacturing-downtime"] });
    },
    onError: (e) => toast.error(getApiError(e, "Could not end downtime")),
  });

  const list = downtimeQ.data ?? [];
  const assets = assetsQ.data ?? [];
  const activeCount = list.filter((d: { endedAt?: string }) => !d.endedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Downtime Events</h2>
          <p className="text-sm text-muted-foreground">
            Log and track unplanned stoppages.
            {activeCount > 0 && (
              <span className="ml-2 text-destructive font-bold">{activeCount} asset{activeCount > 1 ? "s" : ""} currently down.</span>
            )}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} variant="destructive" className="rounded-xl gap-2">
          <XCircle className="h-4 w-4" /> Log Downtime
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Asset</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Reason</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Started</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Duration</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider">Reported By</TableHead>
                <TableHead className="py-3 px-6 text-right text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {downtimeQ.isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground/50 italic">No downtime events recorded</TableCell></TableRow>
              ) : list.map((d: {
                _id: string;
                asset?: { code: string; name: string };
                reasonCode: string;
                description?: string;
                startedAt: string;
                endedAt?: string;
                reportedBy?: string;
              }) => {
                const isActive = !d.endedAt;
                const reasonLabel = DOWNTIME_REASONS.find(r => r.value === d.reasonCode)?.label ?? d.reasonCode;
                return (
                  <TableRow key={d._id} className={`border-b border-border/20 last:border-0 hover:bg-muted/20 ${isActive ? "bg-destructive/5" : ""}`}>
                    <TableCell className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm font-mono">{d.asset?.code ?? "—"}</span>
                        <span className="text-[10px] text-muted-foreground">{d.asset?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{reasonLabel}</span>
                        {d.description && <span className="text-[10px] text-muted-foreground max-w-[200px] truncate">{d.description}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm whitespace-nowrap">
                      {format(new Date(d.startedAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="py-4 text-sm font-mono font-medium">
                      {formatDuration(d.startedAt, d.endedAt)}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">{d.reportedBy || "—"}</TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      {isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 rounded-lg text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/10"
                          disabled={endMut.isPending && endMut.variables === d._id}
                          onClick={() => endMut.mutate(d._id)}
                        >
                          {endMut.isPending && endMut.variables === d._id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Timer className="h-3.5 w-3.5" />}
                          End
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Resolved</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Log Downtime Event
            </DialogTitle>
            <DialogDescription>Record an unplanned stoppage. The start time is set to now.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Asset</Label>
              <Select value={asset} onValueChange={setAsset}>
                <SelectTrigger><SelectValue placeholder="Select asset..." /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: { _id: string; code: string; name: string }) => (
                    <SelectItem key={a._id} value={a._id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Reason</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOWNTIME_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Description</Label>
              <Input placeholder="What happened?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground/70">Reported By</Label>
              <Input placeholder="Operator name" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={createMut.isPending || !asset}
              onClick={() => createMut.mutate({ asset, reasonCode, description, reportedBy })}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Maintenance() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage work centers, assets, preventive maintenance schedules, and downtime events.</p>
      </div>

      <Tabs defaultValue="work-centers" className="space-y-6">
        <StickyModuleTabs>
          <TabsList className={moduleTabsListClassName()}>
            <TabsTrigger value="work-centers" className={moduleTabsTriggerClassName()}>
              <Building2 className="h-4 w-4" /> Work Centers
            </TabsTrigger>
            <TabsTrigger value="assets" className={moduleTabsTriggerClassName()}>
              <Cpu className="h-4 w-4" /> Assets
            </TabsTrigger>
            <TabsTrigger value="pm" className={moduleTabsTriggerClassName()}>
              <CalendarClock className="h-4 w-4" /> PM Schedules
            </TabsTrigger>
            <TabsTrigger value="downtime" className={moduleTabsTriggerClassName()}>
              <Wrench className="h-4 w-4" /> Downtime
            </TabsTrigger>
          </TabsList>
        </StickyModuleTabs>

        <TabsContent value="work-centers"><WorkCentersTab /></TabsContent>
        <TabsContent value="assets"><AssetsTab /></TabsContent>
        <TabsContent value="pm"><PmSchedulesTab /></TabsContent>
        <TabsContent value="downtime"><DowntimeTab /></TabsContent>
      </Tabs>
    </div>
  );
}
