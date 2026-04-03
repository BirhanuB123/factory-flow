import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Truck,
  Factory,
  FileSpreadsheet,
  WifiOff,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Boxes,
  Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * In-app overview of the SME go-to-market package (inventory + PO + simple production + ETB finance).
 */
export default function SmeBundle() {
  const { t } = useLocale();
  const { user } = useAuth();
  const role = user?.role ?? "employee";
  const canOpenFinance = ["Admin", "finance_head", "finance_viewer"].includes(role);
  const canOpenShipments = ["Admin", "warehouse_head", "finance_head", "finance_viewer", "purchasing_head"].includes(role);
  const canOpenHr = ["Admin", "hr_head", "finance_head"].includes(role);

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2744]">{t("pages.sme.title")}</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">{t("pages.sme.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            className="h-10 gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Link to="/orders">
              {t("pages.sme.ctaOrder")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-full border-border/60 px-5 font-semibold shadow-erp-sm">
            <Link to="/settings">{t("pages.sme.ctaConfigure")}</Link>
          </Button>
        </div>
      </div>

      <div className="hidden items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-3 shadow-erp-sm lg:flex">
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Core modules</p>
          <p className="text-sm font-semibold text-foreground">4</p>
        </div>
        <div className="h-8 w-px bg-border/70" />
        <div className="min-w-0 flex-1 text-right lg:text-left">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Offline queue</p>
          <p className="truncate text-sm font-semibold text-amber-600">PO receive + stock moves</p>
        </div>
        <div className="h-8 w-px bg-border/70" />
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Currency</p>
          <p className="text-sm font-semibold text-[hsl(152,69%,36%)]">ETB-first</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Core modules",
            value: "4",
            sub: "Inventory, PO, production, finance",
            icon: Layers,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Quick start steps",
            value: "4",
            sub: "SKU → BOM → order → ship",
            icon: Zap,
            color: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Offline-ready",
            value: "Queue",
            sub: "Receive & movements sync later",
            icon: WifiOff,
            color: "text-info",
            bg: "bg-info/10",
          },
          {
            label: "Tax & exports",
            value: "ETB",
            sub: "VAT / WHT CSV + invoices",
            icon: FileSpreadsheet,
            color: "text-success",
            bg: "bg-success/10",
          },
        ].map((stat, idx) => (
          <Card
            key={idx}
            className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-20 ${stat.bg}`} />
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Value props */}
      <Card className="overflow-hidden rounded-2xl border-0 border-l-4 border-l-primary/70 bg-card shadow-erp">
        <CardContent className="relative p-6 md:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">Live fast</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  Ethiopia-ready
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  Ops-first
                </Badge>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#1a2744] md:text-2xl">
                The minimum ERP that still feels complete.
              </h2>
              <p className="text-sm font-medium text-muted-foreground">
                SME package focuses on the workflows that create immediate control: buy parts, build, track stock, ship, and
                invoice — without heavy scheduling complexity.
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
              {[
                { k: "Go-live", v: "Days" },
                { k: "Scope", v: "Focused" },
                { k: "Exports", v: "CSV" },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 shadow-erp-sm sm:px-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{x.k}</p>
                  <p className="text-lg font-bold tracking-tight">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick start */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp lg:col-span-2">
          <CardHeader className="border-b border-border/50 bg-muted/20 p-6 pb-4 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Quick start flow</CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">The shortest path to value</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-4 md:p-8 md:pt-6">
            <div className="grid gap-4">
              {[
                { n: "01", title: "Create SKUs", desc: "Add raw materials + finished goods in Inventory.", to: "/inventory", icon: Boxes },
                { n: "02", title: "Define BOM", desc: "Link components to finished good, then set Active.", to: "/boms", icon: Factory },
                { n: "03", title: "Order → Job", desc: "Create an order, then generate a production job.", to: "/orders", icon: Zap },
                { n: "04", title: "Ship & invoice", desc: "Create shipment then invoice from Finance.", to: "/shipments", icon: Truck },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-2xl border border-border/50 bg-muted/20 p-4 shadow-erp-sm md:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step {step.n}</p>
                        <p className="text-sm font-semibold tracking-tight text-foreground">{step.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="h-9 shrink-0 rounded-full border-border/60 px-4 text-xs font-semibold shadow-erp-sm">
                      <Link to={step.to}>
                        Open <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
          <CardHeader className="border-b border-border/50 bg-muted/20 p-6 pb-4 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-[#1a2744]">Included</CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">Modules in the SME scope</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-4 md:p-8 md:pt-6">
            {[
              { icon: Package, title: "Inventory & movements", desc: "On-hand plus manual receipt/issue/adjustment with offline queue." },
              { icon: Truck, title: "Purchase orders", desc: "Draft → approve → receive; landed cost optional." },
              { icon: Factory, title: "Simple production", desc: "BOMs + jobs + operations (not full APS/MES)." },
              { icon: FileSpreadsheet, title: "Finance & Ethiopia tax", desc: "Invoices, VAT/WHT exports, tax invoice HTML." },
            ].map((row) => (
              <div key={row.title} className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                  <row.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">{row.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.desc}</p>
                </div>
              </div>
            ))}
            <Separator className="bg-border/60" />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="rounded-full border-border/60 shadow-erp-sm">
                <Link to="/inventory">Inventory</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-full border-border/60 shadow-erp-sm">
                <Link to="/purchase-orders">Purchase orders</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-full border-border/60 shadow-erp-sm">
                <Link to="/production-jobs">Jobs</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-full border-border/60 shadow-erp-sm">
                <Link to="/finance">Finance</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-2 overflow-hidden rounded-2xl border-0 border-l-4 border-l-amber-500/80 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a2744]">
            <WifiOff className="h-5 w-5 text-amber-500" /> Slow or intermittent connectivity
          </CardTitle>
          <CardDescription className="text-sm">
            PO <strong>receive</strong> and inventory manual movements (<strong>receipt/issue/adjustment</strong>) can be saved locally and synced when the connection returns. Use the amber bar at the top to <strong>Sync now</strong>.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a2744]">
            <CheckCircle2 className="h-5 w-5 text-primary" /> End-to-end workflow handoff
          </CardTitle>
          <CardDescription className="text-sm">
            Follow this sequence from order intake to finance close, with role-aware route gates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-6 md:p-8">
          {[
            { step: "1", label: "Orders intake", to: "/orders", open: true },
            { step: "2", label: "Production jobs", to: "/production-jobs", open: true },
            { step: "3", label: "Purchase orders", to: "/purchase-orders", open: true },
            { step: "4", label: "Inventory control", to: "/inventory", open: true },
            { step: "5", label: "Shipments", to: "/shipments", open: canOpenShipments },
            { step: "6", label: "Finance", to: "/finance", open: canOpenFinance },
            { step: "7", label: "HR payroll", to: "/hr", open: canOpenHr },
          ].map((row) => (
            <div
              key={row.step}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 shadow-erp-sm"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Step {row.step}
                </Badge>
                <span className="text-sm font-medium">{row.label}</span>
              </div>
              {row.open ? (
                <Button asChild size="sm" variant="secondary" className="h-8 rounded-full border-border/60 shadow-erp-sm">
                  <Link to={row.to}>Open</Link>
                </Button>
              ) : (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  Role restricted
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-erp">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1a2744]">
            <BookOpen className="h-5 w-5 text-primary" /> Partners &amp; accountants
          </CardTitle>
          <CardDescription className="text-sm">
            See <code className="rounded bg-muted px-1 text-xs">docs/GTM_PARTNERS.md</code> in the repo for export index, training outline, and regional hosting notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 text-sm text-muted-foreground md:p-8">
          <p>
            Accountant-friendly CSVs: Finance &amp; Ethiopia tax reports, payroll pension/income-tax exports, inventory
            valuation, AP aging, and more — all Bearer-auth via the app or Postman.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
