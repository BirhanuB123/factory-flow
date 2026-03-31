import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantModuleFlags } from "@/lib/api";
import { manufacturingApi } from "@/lib/api";
import { PERMS } from "@/lib/permissions";

type AssetRow = {
  _id: string;
  code: string;
  name: string;
  active?: boolean;
  workCenter?: { code?: string; name?: string } | null;
};

type DowntimeRow = {
  asset: string | { _id?: string };
  startedAt: string;
  endedAt?: string | null;
};

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

function assetIdFromDowntime(d: DowntimeRow): string | null {
  const a = d.asset;
  if (a && typeof a === "object" && "_id" in a && a._id) return String(a._id);
  if (typeof a === "string") return a;
  return null;
}

function uptimePctLast7d(assetId: string, downtime: DowntimeRow[]): number {
  const now = Date.now();
  const windowStart = now - 7 * 86400000;
  let downMs = 0;
  for (const d of downtime) {
    const aid = assetIdFromDowntime(d);
    if (!aid || aid !== String(assetId)) continue;
    const sAt = new Date(d.startedAt).getTime();
    const eAt = d.endedAt ? new Date(d.endedAt).getTime() : now;
    const lo = Math.max(sAt, windowStart);
    const hi = Math.min(eAt, now);
    if (hi > lo) downMs += hi - lo;
  }
  const windowMs = now - windowStart;
  return windowMs > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - downMs / windowMs)))) : 100;
}

export function MachineStatus() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const mfgEnabled = moduleEnabled(user, "manufacturing") && can(PERMS.DASHBOARD_MFG);

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["manufacturing-assets"],
    queryFn: manufacturingApi.listAssets,
    enabled: mfgEnabled,
  });

  const { data: downtime = [], isLoading: downLoading } = useQuery({
    queryKey: ["manufacturing-downtime"],
    queryFn: () => manufacturingApi.listDowntime({ limit: 200 }),
    enabled: mfgEnabled,
  });

  const openDownIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of downtime as DowntimeRow[]) {
      if (d.endedAt) continue;
      const id = assetIdFromDowntime(d);
      if (id) s.add(id);
    }
    return s;
  }, [downtime]);

  const rows = useMemo(() => {
    const list = (assets as AssetRow[]).filter((a) => a.active !== false);
    return list.slice(0, 12).map((a) => {
      const isDown = openDownIds.has(String(a._id));
      const pct = uptimePctLast7d(String(a._id), downtime as DowntimeRow[]);
      return {
        id: a._id,
        name: a.name || a.code,
        subtitle: a.workCenter?.code ? `${a.workCenter.code}` : a.code,
        status: isDown ? ("down" as const) : ("idle" as const),
        uptimePct: pct,
        health: isDown ? Math.min(pct, 45) : pct,
      };
    });
  }, [assets, downtime, openDownIds]);

  const loading = mfgEnabled && (assetsLoading || downLoading);

  return (
    <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Assets & downtime
        </CardTitle>
        <p className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal">
          From CMMS assets and open downtime events (7d availability).
        </p>
      </CardHeader>
      <CardContent>
        {!mfgEnabled ? (
          <div className="text-sm text-muted-foreground py-6 text-center px-2">
            Manufacturing is disabled for this tenant.
          </div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center px-2">
            No active assets. Register machines under Manufacturing to track status here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((machine) => (
              <div
                key={machine.id}
                role="link"
                tabIndex={0}
                className="group p-3 rounded-xl border bg-background/40 hover:bg-background/60 transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => navigate("/production")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate("/production");
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-sm font-semibold truncate min-w-0" title={machine.name}>
                    {machine.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Circle
                      className={`h-2.5 w-2.5 fill-current ${
                        machine.status === "idle" ? "text-warning" : "text-destructive"
                      }`}
                    />
                    <span className="text-[10px] uppercase font-bold tracking-tight opacity-70">
                      {machine.status === "down" ? "down" : "up"}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2 truncate">{machine.subtitle}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground">7d availability</span>
                    <span className="font-mono font-medium">{machine.uptimePct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        machine.health > 80
                          ? "bg-success"
                          : machine.health > 50
                            ? "bg-warning"
                            : "bg-destructive"
                      }`}
                      style={{ width: `${machine.health}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
