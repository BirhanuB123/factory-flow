import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  productionApi,
  inventoryApi,
  manufacturingApi,
  purchaseOrdersApi,
  type TenantModuleFlags,
} from "@/lib/api";
import { ArrowUpRight, Boxes, Factory, PackageCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/use-settings";
import { PERMS } from "@/lib/permissions";
import { useLocale } from "@/contexts/LocaleContext";
import { StatRing } from "@/components/StatRing";

function moduleEnabled(
  user: { platformRole?: string; tenantModuleFlags?: Partial<TenantModuleFlags> } | null | undefined,
  key: keyof TenantModuleFlags
): boolean {
  if (!user) return false;
  if (user.platformRole === "super_admin") return true;
  return user.tenantModuleFlags?.[key] !== false;
}

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  ETB: "ETB ",
};

function formatMoney(amount: number, currencyCode: string): string {
  const sym = currencySymbols[currencyCode] || currencyCode + " ";
  if (!Number.isFinite(amount)) return `${sym}0`;
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

function poApproxTotal(po: {
  lines?: { quantityOrdered?: number; quantity?: number; unitCost?: number }[];
  totalAmount?: number;
}): number {
  if (typeof po.totalAmount === "number" && Number.isFinite(po.totalAmount)) return po.totalAmount;
  const lines = po.lines || [];
  return lines.reduce(
    (s, l) => s + (l.quantityOrdered || l.quantity || 0) * (l.unitCost || 0),
    0
  );
}

const kpiThemes = [
  {
    gradient: "from-blue-500/8 to-blue-500/0",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    ringColor: "hsl(221, 83%, 53%)",
    barColor: "bg-blue-500",
    borderAccent: "hover:border-blue-200/70 dark:hover:border-blue-800/50",
  },
  {
    gradient: "from-amber-500/8 to-amber-500/0",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    ringColor: "hsl(32, 95%, 52%)",
    barColor: "bg-amber-500",
    borderAccent: "hover:border-amber-200/70 dark:hover:border-amber-800/50",
  },
  {
    gradient: "from-violet-500/8 to-violet-500/0",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
    ringColor: "hsl(262, 83%, 58%)",
    barColor: "bg-violet-500",
    borderAccent: "hover:border-violet-200/70 dark:hover:border-violet-800/50",
  },
  {
    gradient: "from-emerald-500/8 to-emerald-500/0",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    ringColor: "hsl(152, 69%, 42%)",
    barColor: "bg-emerald-500",
    borderAccent: "hover:border-emerald-200/70 dark:hover:border-emerald-800/50",
  },
];

export function KpiCards() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const { settings } = useSettings();
  const mfgEnabled = moduleEnabled(user, "manufacturing") && can(PERMS.DASHBOARD_MFG);
  const invEnabled = moduleEnabled(user, "inventory") && can(PERMS.DASHBOARD_INVENTORY);
  const poEnabled = moduleEnabled(user, "procurement") && can(PERMS.PO_VIEW);

  const { data: jobs = [] } = useQuery({
    queryKey: ["productions"],
    queryFn: productionApi.getAll,
    enabled: mfgEnabled,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.getAll,
    enabled: invEnabled,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["manufacturing-assets"],
    queryFn: manufacturingApi.listAssets,
    enabled: mfgEnabled,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersApi.getAll,
    enabled: poEnabled,
  });

  const metrics = useMemo(() => {
    const activeAssets = (assets as { active?: boolean }[]).filter((a) => a.active !== false).length;
    const assetCount = mfgEnabled ? activeAssets : invEnabled ? (inventory as unknown[]).length : 0;

    let grossValue = 0;
    let netValue = 0;
    for (const row of inventory as { stock?: number; unitCost?: number }[]) {
      const stock = Number(row.stock || 0);
      const unit = Number(row.unitCost || 0);
      const line = stock * unit;
      grossValue += line;
      if (stock > 0) netValue += line;
    }

    const fyStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    let fyPurchases = 0;
    for (const po of purchaseOrders as { createdAt?: string; status?: string }[]) {
      const t = po.createdAt ? new Date(po.createdAt).getTime() : 0;
      if (t >= fyStart && po.status !== "cancelled" && po.status !== "Cancelled") {
        fyPurchases += poApproxTotal(po as Parameters<typeof poApproxTotal>[0]);
      }
    }

    const jobPool = (jobs as { status?: string }[]).filter((j) => j.status !== "Cancelled").length;
    const activeJobs = (jobs as { status?: string }[]).filter(
      (j) => j.status === "In Progress" || j.status === "Scheduled"
    ).length;
    const workloadPct = jobPool <= 0 ? 0 : Math.round((100 * activeJobs) / jobPool);

    const ring1 = mfgEnabled || invEnabled ? Math.min(100, Math.max(18, 24 + Math.min(assetCount * 4, 56))) : 0;
    const ring2 = invEnabled && grossValue > 0 ? Math.min(100, Math.round(32 + (Math.log10(grossValue + 1) / 5) * 28)) : invEnabled ? 32 : 0;
    const ring3 = invEnabled && grossValue > 0 ? Math.min(100, Math.round((100 * netValue) / grossValue)) : invEnabled ? 48 : 0;
    const ring4 = poEnabled
      ? fyPurchases > 0 ? Math.min(100, Math.round(45 + (Math.log10(fyPurchases + 1) / 6) * 35)) : 28
      : mfgEnabled ? Math.min(100, Math.max(20, workloadPct)) : 0;

    return { assetCount, grossValue, netValue, fyPurchases, ring1, ring2, ring3, ring4 };
  }, [assets, inventory, jobs, purchaseOrders, mfgEnabled, invEnabled, poEnabled]);

  const cur = settings.currency || "USD";

  const kpis = [
    {
      label: t("kpi.assetsCount"),
      value: mfgEnabled || invEnabled ? String(metrics.assetCount) : "—",
      ring: metrics.ring1,
      icon: Factory,
      href: mfgEnabled ? "/production" : "/inventory",
      chip: "Assets",
    },
    {
      label: t("kpi.valueOfAssets"),
      value: invEnabled ? formatMoney(metrics.grossValue, cur) : "—",
      ring: metrics.ring2,
      icon: Boxes,
      href: "/inventory",
      chip: "Inventory",
    },
    {
      label: t("kpi.netAssetsValue"),
      value: invEnabled ? formatMoney(metrics.netValue, cur) : "—",
      ring: metrics.ring3,
      icon: PackageCheck,
      href: "/inventory",
      chip: "Net value",
    },
    {
      label: t("kpi.purchasesFY"),
      value: poEnabled ? formatMoney(metrics.fyPurchases, cur) : "—",
      ring: metrics.ring4,
      icon: Wallet,
      href: "/purchase-orders",
      chip: "Fiscal year",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, idx) => {
        const theme = kpiThemes[idx];
        return (
          <Card
            key={kpi.label}
            role="link"
            tabIndex={0}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${theme.borderAccent}`}
            onClick={() => navigate(kpi.href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(kpi.href); }
            }}
          >
            {/* Subtle gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />

            <CardContent className="relative p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <span className="inline-flex items-center rounded-md border border-border/40 bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {kpi.chip}
                  </span>
                  <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                </div>
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <StatRing pct={kpi.ring} color={theme.ringColor} size={64} stroke={4.5} />
                  <div className={`absolute flex h-9 w-9 items-center justify-center rounded-lg ${theme.iconBg}`}>
                    <kpi.icon className={`h-4 w-4 ${theme.iconColor}`} strokeWidth={2} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                <p className="text-[13px] font-medium text-muted-foreground">{kpi.label}</p>
                <div className="flex items-center gap-2">
                  <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${theme.barColor}`}
                      style={{ width: `${kpi.ring}%` }}
                    />
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
