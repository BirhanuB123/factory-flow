import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, Clock, Edit2, Trash2, Save, ClipboardList, CheckCircle2, FileQuestion, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  StickyModuleTabs,
  moduleTabsListClassName,
  moduleTabsTriggerClassName,
} from "@/components/ModuleDashboardLayout";
import {
  employeeSelfServiceApi,
  type HrLeaveRow,
  type EmployeeAttendanceRow,
  type AttendanceCorrectionRow,
} from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";

export default function EmployeeHr() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState<EmployeeAttendanceRow | null>(null);
  const [history, setHistory] = useState<EmployeeAttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<HrLeaveRow[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const previousLeaveStatusRef = useRef<Record<string, HrLeaveRow["status"]>>({});
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [editLeaveForm, setEditLeaveForm] = useState({
    leaveType: "annual" as HrLeaveRow["leaveType"],
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "annual" as HrLeaveRow["leaveType"],
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: "Present" as "Present" | "Absent" | "Late" | "On Leave",
    checkIn: "",
    checkOut: "",
    notes: "",
  });
  const [correctionForm, setCorrectionForm] = useState({
    attendanceDate: new Date().toISOString().slice(0, 10),
    requestedStatus: "Present" as "Present" | "Absent" | "Late" | "On Leave",
    requestedCheckIn: "",
    requestedCheckOut: "",
    reason: "",
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [t, h, l, c] = await Promise.all([
        employeeSelfServiceApi.getTodayAttendance(),
        employeeSelfServiceApi.listAttendance(),
        employeeSelfServiceApi.listLeaves(),
        employeeSelfServiceApi.listAttendanceCorrections(),
      ]);
      setToday(t);
      setHistory(Array.isArray(h) ? h : []);
      setLeaves(Array.isArray(l) ? l : []);
      setCorrections(Array.isArray(c) ? c : []);
    } catch {
      toast({ title: "Could not load self-service data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function syncLeavesWithNotifications() {
    setSyncing(true);
    try {
      const latest = await employeeSelfServiceApi.listLeaves();
      const rows = Array.isArray(latest) ? latest : [];
      const prevMap = previousLeaveStatusRef.current;
      for (const l of rows) {
        const prev = prevMap[l._id];
        const next = l.status;
        if (prev && prev !== next && (next === "approved" || next === "rejected")) {
          toast({
            title: next === "approved" ? "Leave approved" : "Leave rejected",
            description: `${new Date(l.startDate).toLocaleDateString()} - ${new Date(l.endDate).toLocaleDateString()} (${l.leaveType})`,
            variant: next === "approved" ? "default" : "destructive",
          });
        }
      }
      previousLeaveStatusRef.current = Object.fromEntries(rows.map((r) => [r._id, r.status]));
      setLeaves(rows);
    } catch {
      // silent; polling shouldn't spam toasts on transient errors
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    // Seed previous status map once data is initially loaded.
    previousLeaveStatusRef.current = Object.fromEntries(leaves.map((r) => [r._id, r.status]));
  }, [leaves]);

  useEffect(() => {
    const id = window.setInterval(() => {
      syncLeavesWithNotifications();
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  async function onCheckIn() {
    try {
      await employeeSelfServiceApi.checkIn();
      toast({ title: "Checked in" });
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Check-in failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  async function onCheckOut() {
    try {
      await employeeSelfServiceApi.checkOut();
      toast({ title: "Checked out" });
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Check-out failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  async function onRequestLeave() {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      toast({ title: "Start and end dates are required", variant: "destructive" });
      return;
    }
    try {
      await employeeSelfServiceApi.requestLeave(leaveForm);
      toast({ title: "Leave request submitted" });
      setLeaveForm((s) => ({ ...s, startDate: "", endDate: "", reason: "" }));
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Request failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  function onStartEditLeave(l: HrLeaveRow) {
    setEditingLeaveId(l._id);
    setEditLeaveForm({
      leaveType: l.leaveType,
      startDate: l.startDate.slice(0, 10),
      endDate: l.endDate.slice(0, 10),
      reason: l.reason || "",
    });
  }

  async function onSaveEditLeave() {
    if (!editingLeaveId) return;
    try {
      await employeeSelfServiceApi.updateLeave(editingLeaveId, editLeaveForm);
      toast({ title: "Leave request updated" });
      setEditingLeaveId(null);
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Update failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  async function onCancelLeave(leaveId: string) {
    try {
      await employeeSelfServiceApi.cancelLeave(leaveId);
      toast({ title: "Leave request cancelled" });
      if (editingLeaveId === leaveId) setEditingLeaveId(null);
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Cancel failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  async function onRequestCorrection() {
    if (!correctionForm.attendanceDate) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }
    try {
      await employeeSelfServiceApi.requestAttendanceCorrection(correctionForm);
      toast({ title: "Correction request submitted" });
      setCorrectionForm((s) => ({
        ...s,
        requestedCheckIn: "",
        requestedCheckOut: "",
        reason: "",
      }));
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Request failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  async function onSubmitAttendance() {
    if (!attendanceForm.date) {
      toast({ title: "Attendance date is required", variant: "destructive" });
      return;
    }
    try {
      await employeeSelfServiceApi.submitAttendance(attendanceForm);
      toast({ title: "Attendance submitted" });
      setAttendanceForm((s) => ({ ...s, notes: "", checkIn: "", checkOut: "" }));
      await loadAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Submit failed", description: msg || "Try again", variant: "destructive" });
    }
  }

  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === "pending").length,
    [leaves]
  );

  const reviewedLeaves = useMemo(
    () => leaves.filter((l) => l.status === "approved" || l.status === "rejected"),
    [leaves]
  );

  const pendingCorrections = useMemo(
    () => corrections.filter((c) => c.status === "pending").length,
    [corrections]
  );

  return (
    <>
      <div className="space-y-8 pb-8 animate-in fade-in duration-500">
        <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="mb-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-white/55">
                  <UserCheck className="h-4 w-4" />
                  Employee self service
                </div>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("pages.myHr.title")}</h1>
                <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
                  {t("pages.myHr.subtitle")}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Today", value: today?.status || "Open", tone: "text-sky-200" },
                    { label: "Pending leaves", value: pendingLeaves, tone: "text-amber-300" },
                    { label: "Corrections", value: pendingCorrections, tone: "text-emerald-300" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[16px] border border-white/20 bg-white/[0.08] p-4 backdrop-blur">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                      <p className={`mt-2 text-3xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[16px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Today's interval</p>
                <p className="mt-2 font-mono text-2xl font-black tracking-tight text-white">
                  {today?.checkIn || "--:--"} / {today?.checkOut || "--:--"}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/55">{syncing ? "Syncing..." : "Auto sync every 30s"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <Button
              onClick={onCheckIn}
              disabled={loading || !!today?.checkIn}
              className="h-10 gap-2 rounded-[12px] px-5 font-black shadow-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              {t("pages.myHr.checkIn")}
            </Button>
            <Button
              variant="outline"
              onClick={onCheckOut}
              disabled={loading || !today?.checkIn || !!today?.checkOut}
              className="h-10 rounded-[12px] border-border/60 px-5 font-black shadow-sm"
            >
              {t("pages.myHr.checkOut")}
            </Button>
        </div>

        <div className="hidden items-center gap-5 rounded-[16px] border border-border/70 bg-card px-6 py-3 shadow-sm lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today</p>
            <p className="text-sm font-semibold text-foreground">
              {today?.checkIn || "—"} – {today?.checkOut || "—"}
            </p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending leaves</p>
            <p className={`text-sm font-semibold ${pendingLeaves > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {pendingLeaves}
            </p>
          </div>
          <div className="h-8 w-px bg-border/70" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sync</p>
            <p className={`text-sm font-semibold ${syncing ? "text-primary" : "text-muted-foreground"}`}>
              {syncing ? "Syncing..." : "Auto 30s"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "History rows",
              value: String(history.length),
              sub: "Attendance records",
              icon: ClipboardList,
              color: "text-primary",
              bg: "bg-primary/10",
              accent: "from-primary to-cyan-400",
            },
            {
              label: "Pending leaves",
              value: String(pendingLeaves),
              sub: "Awaiting review",
              icon: Calendar,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
              accent: "from-amber-400 to-rose-500",
            },
            {
              label: "Corrections (pending)",
              value: String(pendingCorrections),
              sub: "Attendance changes",
              icon: FileQuestion,
              color: "text-violet-600",
              bg: "bg-violet-500/10",
              accent: "from-violet-500 to-blue-500",
            },
            {
              label: "Decided leaves",
              value: String(reviewedLeaves.length),
              sub: "Approved or rejected",
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
              accent: "from-emerald-500 to-teal-400",
            },
          ].map((stat, idx) => (
            <Card
              key={idx}
              className="group relative overflow-hidden rounded-[12px] border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`h-1 bg-gradient-to-r ${stat.accent}`} />
              <CardContent className="p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                  </div>
                  <div className={`h-9 w-9 rounded-full ${stat.bg}`} />
                </div>
                <p className="text-4xl font-black tracking-tight text-foreground">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="attendance" className="space-y-6">
        <StickyModuleTabs>
          <TabsList className={moduleTabsListClassName()}>
            <TabsTrigger value="attendance" className={moduleTabsTriggerClassName()}>
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leaves" className={moduleTabsTriggerClassName()}>
              Leaves
            </TabsTrigger>
            <TabsTrigger value="corrections" className={moduleTabsTriggerClassName()}>
              Corrections
            </TabsTrigger>
          </TabsList>
        </StickyModuleTabs>

        <TabsContent value="attendance">
          <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
            <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                <ClipboardList className="h-5 w-5 text-primary" />
                My Attendance History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3 rounded-[16px] border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold">Manual attendance entry</Label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <Label>Date</Label>
                      <Input
                        className="h-10 rounded-[12px] border-border/60 bg-card"
                      type="date"
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select
                      className="h-10 w-full rounded-[12px] border border-border/60 bg-card px-3 text-sm"
                      value={attendanceForm.status}
                      onChange={(e) =>
                        setAttendanceForm((s) => ({
                          ...s,
                          status: e.target.value as "Present" | "Absent" | "Late" | "On Leave",
                        }))
                      }
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                  </div>
                  <div>
                    <Label>Check-in (optional)</Label>
                      <Input
                        className="h-10 rounded-[12px] border-border/60 bg-card"
                      type="time"
                      value={attendanceForm.checkIn}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, checkIn: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Check-out (optional)</Label>
                      <Input
                        className="h-10 rounded-[12px] border-border/60 bg-card"
                      type="time"
                      value={attendanceForm.checkOut}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, checkOut: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={onSubmitAttendance} className="h-10 w-full rounded-[12px] text-xs font-black uppercase">
                      Submit attendance
                    </Button>
                  </div>
                </div>
                <Input
                  className="h-10 rounded-[12px] border-border/60 bg-card"
                  placeholder="Notes (optional)"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Interval</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">OT</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">OT Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No attendance records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((a) => (
                      <TableRow key={a._id} className="border-border/40 hover:bg-primary/[0.03]">
                        <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                        <TableCell>{a.status}</TableCell>
                        <TableCell>{a.checkIn || "--:--"} - {a.checkOut || "--:--"}</TableCell>
                        <TableCell>{a.overtimeMinutes || 0} min</TableCell>
                        <TableCell>{a.overtimeApprovalStatus || "none"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="pt-2">
                <Label className="text-xs font-semibold">Recent leave decisions</Label>
                <div className="mt-2 space-y-2">
                  {reviewedLeaves.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No decisions yet.</p>
                  ) : (
                    reviewedLeaves.slice(0, 6).map((l) => (
                      <div key={l._id} className="flex items-center justify-between rounded-[12px] border border-border/60 bg-card p-3 text-sm shadow-sm">
                        <span>
                          {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()} ({l.leaveType})
                        </span>
                        <Badge variant={l.status === "approved" ? "success" : "secondary"} className="rounded-[8px] text-[10px] font-black uppercase">{l.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
            <div className="h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-primary" />
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                <Calendar className="h-5 w-5 text-primary" /> Request leave
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Type</Label>
                  <select
                    className="h-10 w-full rounded-[12px] border border-border/60 bg-muted/30 px-3 text-sm"
                    value={leaveForm.leaveType}
                    onChange={(e) =>
                      setLeaveForm((s) => ({ ...s, leaveType: e.target.value as HrLeaveRow["leaveType"] }))
                    }
                  >
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="maternity">Maternity</option>
                    <option value="paternity">Paternity</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input
                    className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm((s) => ({ ...s, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm((s) => ({ ...s, endDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={onRequestLeave} className="h-10 w-full rounded-[12px] text-xs font-black uppercase">
                    Submit request
                  </Button>
                </div>
              </div>
              <Input
                className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                placeholder="Reason (optional)"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((s) => ({ ...s, reason: e.target.value }))}
              />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Period</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Days</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No leave requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaves.map((l) => (
                      <TableRow key={l._id} className="border-border/40 hover:bg-primary/[0.03]">
                        <TableCell>
                          {editingLeaveId === l._id ? (
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={editLeaveForm.startDate}
                                onChange={(e) => setEditLeaveForm((s) => ({ ...s, startDate: e.target.value }))}
                                  className="h-8 rounded-[9px] border-border/60 bg-card"
                              />
                              <Input
                                type="date"
                                value={editLeaveForm.endDate}
                                onChange={(e) => setEditLeaveForm((s) => ({ ...s, endDate: e.target.value }))}
                                  className="h-8 rounded-[9px] border-border/60 bg-card"
                              />
                            </div>
                          ) : (
                            <>{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</>
                          )}
                        </TableCell>
                        <TableCell className="uppercase">
                          {editingLeaveId === l._id ? (
                            <select
                              className="h-8 rounded-[9px] border border-border/60 bg-card px-2 text-xs"
                              value={editLeaveForm.leaveType}
                              onChange={(e) =>
                                setEditLeaveForm((s) => ({
                                  ...s,
                                  leaveType: e.target.value as HrLeaveRow["leaveType"],
                                }))
                              }
                            >
                              <option value="annual">Annual</option>
                              <option value="sick">Sick</option>
                              <option value="unpaid">Unpaid</option>
                              <option value="maternity">Maternity</option>
                              <option value="paternity">Paternity</option>
                              <option value="other">Other</option>
                            </select>
                          ) : (
                            l.leaveType
                          )}
                        </TableCell>
                        <TableCell>{l.days}</TableCell>
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
                          {l.status === "pending" ? (
                            <div className="inline-flex gap-2">
                              {editingLeaveId === l._id ? (
                                <>
                                  <Button size="sm" className="h-7 rounded-[9px] text-[10px] font-black" onClick={onSaveEditLeave}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 rounded-[9px] text-[10px]"
                                    onClick={() => setEditingLeaveId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-[9px] text-[10px] font-black"
                                    onClick={() => onStartEditLeave(l)}
                                  >
                                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 rounded-[9px] text-[10px]"
                                    onClick={() => onCancelLeave(l._id)}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" /> Cancel
                                  </Button>
                                </>
                              )}
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

        <TabsContent value="corrections">
          <Card className="overflow-hidden rounded-[16px] border border-border/70 bg-card shadow-sm">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-primary" />
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                <FileQuestion className="h-5 w-5 text-primary" />
                Attendance correction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                    type="date"
                    value={correctionForm.attendanceDate}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, attendanceDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Requested status</Label>
                  <select
                    className="h-10 w-full rounded-[12px] border border-border/60 bg-muted/30 px-3 text-sm"
                    value={correctionForm.requestedStatus}
                    onChange={(e) =>
                      setCorrectionForm((s) => ({
                        ...s,
                        requestedStatus: e.target.value as "Present" | "Absent" | "Late" | "On Leave",
                      }))
                    }
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Late">Late</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                <div>
                  <Label>Check-in (optional)</Label>
                  <Input
                    className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                    type="time"
                    value={correctionForm.requestedCheckIn}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, requestedCheckIn: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Check-out (optional)</Label>
                  <Input
                    className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                    type="time"
                    value={correctionForm.requestedCheckOut}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, requestedCheckOut: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={onRequestCorrection} className="h-10 w-full rounded-[12px] text-xs font-black uppercase">
                    Submit correction
                  </Button>
                </div>
              </div>
              <Input
                className="h-10 rounded-[12px] border-border/60 bg-muted/30"
                placeholder="Reason"
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm((s) => ({ ...s, reason: e.target.value }))}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Requested</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Review note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No correction requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    corrections.map((c) => (
                      <TableRow key={c._id} className="border-border/40 hover:bg-primary/[0.03]">
                        <TableCell>{new Date(c.attendanceDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {c.requestedStatus} ({c.requestedCheckIn || "--:--"} - {c.requestedCheckOut || "--:--"})
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
                            className="rounded-[8px] text-[10px] font-black uppercase">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.reviewNote || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
