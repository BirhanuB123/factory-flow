import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, Clock, Edit2, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ModuleDashboardLayout,
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

export default function EmployeeHr() {
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

  return (
    <ModuleDashboardLayout
      title="My HR Dashboard"
      description="Self-service attendance, leave, and correction requests."
      icon={Calendar}
      healthStats={[
        { label: "Today", value: `${today?.checkIn || "--:--"} - ${today?.checkOut || "--:--"}` },
        { label: "Pending leaves", value: String(pendingLeaves), accent: "text-warning" },
        { label: "Sync", value: syncing ? "Syncing..." : "Auto 30s", accent: syncing ? "text-primary" : undefined },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onCheckIn}
            disabled={loading || !!today?.checkIn}
            className="h-10 font-black uppercase text-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
            Check in
          </Button>
          <Button
            variant="outline"
            onClick={onCheckOut}
            disabled={loading || !today?.checkIn || !!today?.checkOut}
            className="h-10 font-black uppercase text-xs"
          >
            Check out
          </Button>
        </div>
      }
    >
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
          <Card className="rounded-2xl border-border/70 bg-background/70 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60 bg-muted/10">
              <CardTitle className="text-base font-black uppercase tracking-wide">My Attendance History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                <Label className="text-xs font-semibold">Manual attendance entry</Label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                      type="time"
                      value={attendanceForm.checkIn}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, checkIn: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Check-out (optional)</Label>
                    <Input
                      type="time"
                      value={attendanceForm.checkOut}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, checkOut: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={onSubmitAttendance} className="w-full h-10 font-black uppercase text-xs">
                      Submit attendance
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Notes (optional)"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>OT Review</TableHead>
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
                      <TableRow key={a._id}>
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
                      <div key={l._id} className="rounded-md border p-2 text-sm flex items-center justify-between">
                        <span>
                          {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()} ({l.leaveType})
                        </span>
                        <Badge variant={l.status === "approved" ? "success" : "secondary"}>{l.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card className="rounded-2xl border-border/70 bg-background/70 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60 bg-muted/10">
              <CardTitle className="text-base flex items-center gap-2 font-black uppercase tracking-wide">
                <Calendar className="h-4 w-4" /> Request Leave
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Type</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm((s) => ({ ...s, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm((s) => ({ ...s, endDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={onRequestLeave} className="w-full h-10 font-black uppercase text-xs">
                    Submit request
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Reason (optional)"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((s) => ({ ...s, reason: e.target.value }))}
              />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
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
                      <TableRow key={l._id}>
                        <TableCell>
                          {editingLeaveId === l._id ? (
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={editLeaveForm.startDate}
                                onChange={(e) => setEditLeaveForm((s) => ({ ...s, startDate: e.target.value }))}
                                className="h-8"
                              />
                              <Input
                                type="date"
                                value={editLeaveForm.endDate}
                                onChange={(e) => setEditLeaveForm((s) => ({ ...s, endDate: e.target.value }))}
                                className="h-8"
                              />
                            </div>
                          ) : (
                            <>{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</>
                          )}
                        </TableCell>
                        <TableCell className="uppercase">
                          {editingLeaveId === l._id ? (
                            <select
                              className="h-8 rounded-md border bg-background px-2 text-xs"
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
                                  <Button size="sm" className="h-7 text-[10px]" onClick={onSaveEditLeave}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px]"
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
                                    className="h-7 text-[10px]"
                                    onClick={() => onStartEditLeave(l)}
                                  >
                                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px]"
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
          <Card className="rounded-2xl border-border/70 bg-background/70 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60 bg-muted/10">
              <CardTitle className="text-base font-black uppercase tracking-wide">
                Attendance Correction Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={correctionForm.attendanceDate}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, attendanceDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Requested status</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                    type="time"
                    value={correctionForm.requestedCheckIn}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, requestedCheckIn: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Check-out (optional)</Label>
                  <Input
                    type="time"
                    value={correctionForm.requestedCheckOut}
                    onChange={(e) => setCorrectionForm((s) => ({ ...s, requestedCheckOut: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={onRequestCorrection} className="w-full h-10 font-black uppercase text-xs">
                    Submit correction
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Reason"
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm((s) => ({ ...s, reason: e.target.value }))}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review note</TableHead>
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
                      <TableRow key={c._id}>
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
                          >
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
    </ModuleDashboardLayout>
  );
}
