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
import { Globe, Sun, LayoutGrid, Wallet } from "lucide-react";
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
  ETB: "Br",
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

    const ring1 =
      mfgEnabled || invEnabled
        ? Math.min(100, Math.max(18, 24 + Math.min(assetCount * 4, 56)))
        : 0;
    const ring2 =
      invEnabled && grossValue > 0
        ? Math.min(100, Math.round(32 + (Math.log10(grossValue + 1) / 5) * 28))
        : invEnabled
          ? 32
          : 0;
    const ring3 =
      invEnabled && grossValue > 0
        ? Math.min(100, Math.round((100 * netValue) / grossValue))
        : invEnabled
          ? 48
          : 0;
    const ring4 = poEnabled
      ? fyPurchases > 0
        ? Math.min(100, Math.round(45 + (Math.log10(fyPurchases + 1) / 6) * 35))
        : 28
      : mfgEnabled
        ? Math.min(100, Math.max(20, workloadPct))
        : 0;

    return {
      assetCount,
      grossValue,
      netValue,
      fyPurchases,
      ring1,
      ring2,
      ring3,
      ring4,
    };
  }, [assets, inventory, jobs, purchaseOrders, mfgEnabled, invEnabled, poEnabled]);

  const cur = settings.currency || "USD";

  const kpis = [
    {
      label: t("kpi.assetsCount"),
      value: mfgEnabled || invEnabled ? String(metrics.assetCount) : "—",
      ring: metrics.ring1,
      color: "hsl(221, 83%, 53%)",
      icon: Globe,
      href: mfgEnabled ? "/production" : "/inventory",
    },
    {
      label: t("kpi.valueOfAssets"),
      value: invEnabled ? formatMoney(metrics.grossValue, cur) : "—",
      ring: metrics.ring2,
      color: "hsl(32, 95%, 52%)",
      icon: Sun,
      href: "/inventory",
    },
    {
      label: t("kpi.netAssetsValue"),
      value: invEnabled ? formatMoney(metrics.netValue, cur) : "—",
      ring: metrics.ring3,
      color: "hsl(262, 83%, 58%)",
      icon: LayoutGrid,
      href: "/inventory",
    },
    {
      label: t("kpi.purchasesFY"),
      value: poEnabled ? formatMoney(metrics.fyPurchases, cur) : "—",
      ring: metrics.ring4,
      color: "hsl(152, 69%, 42%)",
      icon: Wallet,
      href: "/purchase-orders",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          role="link"
          tabIndex={0}
          className="cursor-pointer border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
          onClick={() => navigate(kpi.href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(kpi.href);
            }
          }}
        >
          <CardContent className="flex flex-col items-center p-6 pt-7 text-center">
            <div className="relative mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
              <StatRing pct={kpi.ring} color={kpi.color} size={72} stroke={5} />
              <div
                className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-muted/50"
                style={{ color: kpi.color }}
              >
                <kpi.icon className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{kpi.value}</p>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{kpi.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
