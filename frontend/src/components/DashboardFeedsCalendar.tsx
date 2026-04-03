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
        if (d.getFullYear() === y && d.getMonth() === m) {
          const day = d.getDate();
          marks.set(day, "blue");
        }
      }
      for (const d of downtime as { startedAt?: string; endedAt?: string | null }[]) {
        if (!d.startedAt || d.endedAt) continue;
        const dt = new Date(d.startedAt);
        if (dt.getFullYear() === y && dt.getMonth() === m) {
          const day = dt.getDate();
          marks.set(day, "orange");
        }
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
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthLabel = `${first.toLocaleString(undefined, { month: "short" })} – ${last.toLocaleString(undefined, { month: "short" })} ${y}`;

    return { monthLabel, calendarWeeks: weeks, marksByDay: marks };
  }, [jobs, downtime, mfgEnabled]);

  const dotClass: Record<DayMark, string> = {
    blue: "bg-[hsl(221,83%,53%)]",
    orange: "bg-[hsl(32,95%,52%)]",
    purple: "bg-[hsl(262,83%,58%)]",
    green: "bg-[hsl(152,69%,42%)]",
  };

  const rows = feedTab === "checkout" ? checkoutRows : repairRows;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base font-bold text-foreground">{t("feeds.title")}</CardTitle>
          <div className="flex rounded-full bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setFeedTab("checkout")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                feedTab === "checkout" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t("feeds.checkout")}
            </button>
            <button
              type="button"
              onClick={() => setFeedTab("repair")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                feedTab === "repair" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t("feeds.repair")}
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          {!mfgEnabled ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("feeds.enableMfg")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="text-xs font-bold text-foreground">{t("feeds.colTag")}</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">{t("feeds.colDesc")}</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">{t("feeds.colDue")}</TableHead>
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
                        className={cn("border-border/40", idx % 2 === 1 ? "bg-muted/30" : "bg-transparent")}
                      >
                        <TableCell className="text-sm font-medium">{r.id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.desc}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.due}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-bold text-foreground">{t("feeds.alerts")}</CardTitle>
          <p className="text-center text-sm font-semibold text-muted-foreground sm:flex-1">{monthLabel}</p>
          <Select value={calSort} onValueChange={setCalSort}>
            <SelectTrigger className="h-9 w-[150px] rounded-full border-border/60 bg-muted/40 text-xs font-medium sm:ml-auto">
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
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                {(
                  [
                    "feeds.weekday.sun",
                    "feeds.weekday.mon",
                    "feeds.weekday.tue",
                    "feeds.weekday.wed",
                    "feeds.weekday.thu",
                    "feeds.weekday.fri",
                    "feeds.weekday.sat",
                  ] as const
                ).map((k) => (
                  <div key={k} className="py-2">
                    {t(k)}
                  </div>
                ))}
              </div>
              <div className="mt-1 space-y-1">
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((cell, ci) => {
                      if (!cell || cell.day == null) {
                        return <div key={ci} className="aspect-square rounded-lg bg-transparent" />;
                      }
                      const mark = marksByDay.get(cell.day);
                      return (
                        <div
                          key={ci}
                          className="relative flex aspect-square items-center justify-center rounded-lg bg-muted/25 text-sm font-medium text-foreground"
                        >
                          {cell.day}
                          {mark ? (
                            <span
                              className={cn(
                                "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                                dotClass[mark]
                              )}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[hsl(221,83%,53%)]" /> {t("feeds.legendJobDue")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[hsl(32,95%,52%)]" /> {t("feeds.legendDowntime")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[hsl(262,83%,58%)]" /> {t("feeds.legendCompleted")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[hsl(152,69%,42%)]" /> {t("feeds.legendActivity")}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
