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
      <section className="relative overflow-hidden rounded-[20px] border border-white/60 bg-[linear-gradient(135deg,hsl(222_47%_12%),hsl(221_68%_25%)_52%,hsl(190_75%_34%))] text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.24),transparent_32%)]" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_380px] lg:p-7">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/80">
              <Layers className="h-3.5 w-3.5" />
              SME operating package
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("pages.sme.title")}</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/65">{t("pages.sme.subtitle")}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Core modules", value: "4", tone: "text-sky-200" },
                { label: "Offline queue", value: "Ready", tone: "text-amber-200" },
                { label: "Currency", value: "ETB-first", tone: "text-emerald-200" },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{item.label}</p>
                  <p className={`mt-1 text-xl font-black tracking-tight ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Launch path</p>
                <p className="mt-2 text-3xl font-black tracking-tight">Order to invoice</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/55">
                  Inventory, purchasing, production, shipments, and finance in one focused workflow.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-emerald-400/15 text-emerald-200">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild className="h-10 gap-2 rounded-[12px] bg-white px-5 font-semibold text-slate-950 shadow-sm hover:bg-white/90">
                <Link to="/orders">
                  {t("pages.sme.ctaOrder")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-[12px] border-white/20 bg-white/10 px-5 font-semibold text-white shadow-none hover:bg-white hover:text-slate-950">
                <Link to="/settings">{t("pages.sme.ctaConfigure")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

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
            sub: "SKU -> BOM -> order -> ship",
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
            className="group relative overflow-hidden rounded-[18px] border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-400" />
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${stat.bg} transition-transform duration-300 group-hover:scale-105`}
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
      <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
        <CardContent className="relative p-6 md:p-8">
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">Live fast</Badge>
                <Badge variant="secondary" className="rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  Ethiopia-ready
                </Badge>
                <Badge variant="outline" className="rounded-[10px] border-border/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  Ops-first
                </Badge>
              </div>
              <h2 className="text-xl font-black tracking-tight text-foreground md:text-2xl">
                The minimum ERP that still feels complete.
              </h2>
              <p className="text-sm font-medium text-muted-foreground">
                SME package focuses on the workflows that create immediate control: buy parts, build, track stock, ship, and
                invoice without heavy scheduling complexity.
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
              {[
                { k: "Go-live", v: "Days" },
                { k: "Scope", v: "Focused" },
                { k: "Exports", v: "CSV" },
              ].map((x) => (
                <div key={x.k} className="rounded-[14px] border border-border/60 bg-muted/25 px-3 py-3 sm:px-4">
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
        <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm lg:col-span-2">
          <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
          <CardHeader className="border-b border-border/50 bg-muted/25 p-6 pb-4 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-black tracking-tight text-foreground">Quick start flow</CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">The shortest path to value</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-4 md:p-8 md:pt-6">
            <div className="grid gap-4">
              {[
                { n: "01", title: "Create SKUs", desc: "Add raw materials + finished goods in Inventory.", to: "/inventory", icon: Boxes },
                { n: "02", title: "Define BOM", desc: "Link components to finished good, then set Active.", to: "/boms", icon: Factory },
                { n: "03", title: "Order -> Job", desc: "Create an order, then generate a production job.", to: "/orders", icon: Zap },
                { n: "04", title: "Ship & invoice", desc: "Create shipment then invoice from Finance.", to: "/shipments", icon: Truck },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-[16px] border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-primary/[0.03] md:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-primary/15 bg-primary/10 text-primary">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step {step.n}</p>
                        <p className="text-sm font-semibold tracking-tight text-foreground">{step.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="h-9 shrink-0 rounded-[10px] border-border/60 px-4 text-xs font-semibold shadow-sm">
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

        <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-primary to-amber-400" />
          <CardHeader className="border-b border-border/50 bg-muted/25 p-6 pb-4 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg font-black tracking-tight text-foreground">Included</CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">Modules in the SME scope</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-4 md:p-8 md:pt-6">
            {[
              { icon: Package, title: "Inventory & movements", desc: "On-hand plus manual receipt/issue/adjustment with offline queue." },
              { icon: Truck, title: "Purchase orders", desc: "Draft -> approve -> receive; landed cost optional." },
              { icon: Factory, title: "Simple production", desc: "BOMs + jobs + operations (not full APS/MES)." },
              { icon: FileSpreadsheet, title: "Finance & Ethiopia tax", desc: "Invoices, VAT/WHT exports, tax invoice HTML." },
            ].map((row) => (
              <div key={row.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-primary/15 bg-primary/10 text-primary">
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
              <Button asChild variant="secondary" className="rounded-[10px] border-border/60 shadow-sm">
                <Link to="/inventory">Inventory</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-[10px] border-border/60 shadow-sm">
                <Link to="/purchase-orders">Purchase orders</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-[10px] border-border/60 shadow-sm">
                <Link to="/production-jobs">Jobs</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-[10px] border-border/60 shadow-sm">
                <Link to="/finance">Finance</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-2 overflow-hidden rounded-[18px] border border-amber-500/25 bg-amber-50/70 shadow-sm dark:bg-amber-950/10">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
        <CardHeader className="border-b border-amber-500/20 bg-amber-500/5">
          <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
            <WifiOff className="h-5 w-5 text-amber-500" /> Slow or intermittent connectivity
          </CardTitle>
          <CardDescription className="text-sm">
            PO <strong>receive</strong> and inventory manual movements (<strong>receipt/issue/adjustment</strong>) can be saved locally and synced when the connection returns. Use the amber bar at the top to <strong>Sync now</strong>.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
        <CardHeader className="border-b border-border/50 bg-muted/25">
          <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
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
              className="flex items-center justify-between rounded-[14px] border border-border/60 bg-muted/15 px-3 py-2.5 transition-colors hover:bg-primary/[0.03]"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Step {row.step}
                </Badge>
                <span className="text-sm font-medium">{row.label}</span>
              </div>
              {row.open ? (
                <Button asChild size="sm" variant="secondary" className="h-8 rounded-[10px] border-border/60 shadow-sm">
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

      <Card className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-sky-500 via-primary to-emerald-500" />
        <CardHeader className="border-b border-border/50 bg-muted/25">
          <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
            <BookOpen className="h-5 w-5 text-primary" /> Partners &amp; accountants
          </CardTitle>
          <CardDescription className="text-sm">
            See <code className="rounded bg-muted px-1 text-xs">docs/GTM_PARTNERS.md</code> in the repo for export index, training outline, and regional hosting notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 text-sm text-muted-foreground md:p-8">
          <p>
            Accountant-friendly CSVs: Finance &amp; Ethiopia tax reports, payroll pension/income-tax exports, inventory
            valuation, AP aging, and more - all Bearer-auth via the app or Postman.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
