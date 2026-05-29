import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { productionApi, manufacturingApi, type TenantModuleFlags } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PERMS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

type DayMark = "blue" | "orange" | "purple" | "green";

export function DashboardFeedsCalendar() {
  const { t } = useLocale();
  const { user, can } = useAuth();
  const mfgEnabled = moduleEnabled(user, "manufacturing") && can(PERMS.DASHBOARD_MFG);
  const [feedTab, setFeedTab] = useState<"checkout" | "repair">("checkout");
  const [calSort, setCalSort] = useState("month");

  const { data: jobs = [] } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
    enabled: mfgEnabled,
  });

  const { data: downtime = [] } = useQuery({
    queryKey: ["manufacturing-downtime"],
    queryFn: () => manufacturingApi.listDowntime({ limit: 200 }),
    enabled: mfgEnabled,
  });

  const checkoutRows = useMemo(() => {
    return (jobs as { jobId?: string; bom?: { name?: string }; status?: string; dueDate?: string }[])
      .filter((j) => j.status !== "Cancelled" && j.status !== "Completed")
      .slice(0, 8)
      .map((j) => ({
        id: j.jobId || "—",
        desc: j.bom?.name || t("feeds.productionJob"),
        due: j.dueDate
          ? new Date(j.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
          : t("feeds.noDueDate"),
      }));
  }, [jobs, t]);

  const repairRows = useMemo(() => {
    return (downtime as { _id?: string; reason?: string; startedAt?: string; endedAt?: string | null; asset?: { name?: string } | string }[])
      .filter((d) => !d.endedAt)
      .slice(0, 8)
      .map((d) => {
        const assetLabel =
          typeof d.asset === "object" && d.asset?.name
            ? d.asset.name
            : typeof d.asset === "string"
              ? t("feeds.assetFallback")
              : t("feeds.assetFallback");
        return {
          id: String(d._id || "").slice(-6) || "—",
          desc: d.reason || assetLabel,
          due: d.startedAt
            ? new Date(d.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : "—",
        };
      });
  }, [downtime, t]);

  const { monthLabel, calendarWeeks, marksByDay } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();

    const marks = new Map<number, DayMark>();

    if (mfgEnabled) {
      for (const j of jobs as { dueDate?: string; status?: string }[]) {
        if (!j.dueDate || j.status === "Cancelled") continue;
        const d = new Date(j.dueDate);
        if (d.getFullYear() === y && d.getMonth() === m) marks.set(d.getDate(), "blue");
      }
      for (const d of downtime as { startedAt?: string; endedAt?: string | null }[]) {
        if (!d.startedAt || d.endedAt) continue;
        const dt = new Date(d.startedAt);
        if (dt.getFullYear() === y && dt.getMonth() === m) marks.set(dt.getDate(), "orange");
      }
      let i = 0;
      for (const j of jobs as { updatedAt?: string; status?: string }[]) {
        if (j.status !== "Completed" || !j.updatedAt) continue;
        const dt = new Date(j.updatedAt);
        if (dt.getFullYear() === y && dt.getMonth() === m) {
          const day = dt.getDate();
          if (!marks.has(day) && i < 4) {
            marks.set(day, i % 2 === 0 ? "green" : "purple");
            i++;
          }
        }
      }
    }

    const cells: ({ day: number | null } | null)[] = [];
    for (let p = 0; p < startPad; p++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: ({ day: number | null } | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const monthLabel = `${first.toLocaleString(undefined, { month: "long" })} ${y}`;
    return { monthLabel, calendarWeeks: weeks, marksByDay: marks };
  }, [jobs, downtime, mfgEnabled]);

  const dotClass: Record<DayMark, string> = {
    blue: "bg-primary",
    orange: "bg-amber-500",
    purple: "bg-violet-500",
    green: "bg-emerald-500",
  };

  const today = new Date().getDate();
  const rows = feedTab === "checkout" ? checkoutRows : repairRows;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Work Queue Table */}
      <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Work queue
            </p>
            <CardTitle className="mt-1 text-base font-bold text-foreground">
              {t("feeds.title")}
            </CardTitle>
          </div>
          <div className="flex rounded-lg bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setFeedTab("checkout")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                feedTab === "checkout"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("feeds.checkout")}
            </button>
            <button
              type="button"
              onClick={() => setFeedTab("repair")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                feedTab === "repair"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("feeds.repair")}
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-5">
          {!mfgEnabled ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("feeds.enableMfg")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("feeds.colTag")}
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("feeds.colDesc")}
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("feeds.colDue")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                        {t("feeds.noRows")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow
                        key={`${r.id}-${idx}`}
                        className="border-border/30 transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="text-sm font-medium text-foreground">{r.id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.desc}</TableCell>
                        <TableCell className="text-sm font-medium text-muted-foreground">{r.due}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Calendar
            </p>
            <CardTitle className="mt-1 text-base font-bold text-foreground">
              {t("feeds.alerts")}
            </CardTitle>
          </div>
          <p className="text-center text-sm font-semibold text-foreground sm:flex-1">{monthLabel}</p>
          <Select value={calSort} onValueChange={setCalSort}>
            <SelectTrigger className="h-8 w-[130px] rounded-lg border-border/50 bg-muted/30 text-xs font-medium sm:ml-auto">
              <SelectValue placeholder={t("charts.sortByPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("feeds.calSortMonth")}</SelectItem>
              <SelectItem value="week">{t("feeds.calSortWeek")}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!mfgEnabled ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("feeds.enableMfgCal")}</p>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {(
                  [
                    "feeds.weekday.sun", "feeds.weekday.mon", "feeds.weekday.tue",
                    "feeds.weekday.wed", "feeds.weekday.thu", "feeds.weekday.fri",
                    "feeds.weekday.sat",
                  ] as const
                ).map((k) => (
                  <div key={k} className="py-2">{t(k)}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="mt-1 space-y-1 rounded-xl bg-muted/15 p-2">
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((cell, ci) => {
                      if (!cell || cell.day == null) {
                        return <div key={ci} className="aspect-square" />;
                      }
                      const mark = marksByDay.get(cell.day);
                      const isToday = cell.day === today;
                      return (
                        <div
                          key={ci}
                          className={cn(
                            "relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors",
                            isToday
                              ? "bg-primary text-primary-foreground font-bold shadow-sm"
                              : "bg-background text-foreground hover:bg-accent"
                          )}
                        >
                          {cell.day}
                          {mark && !isToday ? (
                            <span className={cn("absolute bottom-1 h-1.5 w-1.5 rounded-full", dotClass[mark])} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> {t("feeds.legendJobDue")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> {t("feeds.legendDowntime")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500" /> {t("feeds.legendCompleted")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("feeds.legendActivity")}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
