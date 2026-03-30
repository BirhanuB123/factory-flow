import { Link } from "react-router-dom";
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
} from "lucide-react";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

/**
 * In-app overview of the SME go-to-market package (inventory + PO + simple production + ETB finance).
 */
export default function SmeBundle() {
  const { user } = useAuth();
  const role = user?.role ?? "employee";
  const canOpenFinance = ["Admin", "finance_head", "finance_viewer"].includes(role);
  const canOpenShipments = ["Admin", "warehouse_head", "finance_head", "finance_viewer", "purchasing_head"].includes(role);
  const canOpenHr = ["Admin", "hr_head", "finance_head"].includes(role);

  return (
    <ModuleDashboardLayout
      title="SME package"
      description="A focused ERP starter kit: stock, purchasing, light production, and Ethiopia-ready invoicing — designed to go live fast."
      icon={Package}
      healthStats={[
        { label: "Core modules", value: "4" },
        { label: "Offline queue", value: "PO receive + stock moves" },
        { label: "Currency", value: "ETB-first" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="h-11 rounded-xl px-6 font-black uppercase italic text-[11px] tracking-widest shadow-xl shadow-primary/20 gap-2">
            <Link to="/orders">
              Start with an order <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl px-5 font-black uppercase text-[10px] tracking-widest border-border/60">
            <Link to="/settings">Configure</Link>
          </Button>
        </div>
      }
    >
      {/* Hero / value props */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-primary/[0.14] via-background to-background p-7 md:p-10 shadow-2xl shadow-primary/10">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                Live fast
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                Ethiopia-ready
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                Ops-first
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
              The minimum ERP that still feels complete.
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              SME package focuses on the workflows that create immediate control: buy parts, build, track stock, ship, and invoice — without heavy scheduling complexity.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Go-live</p>
              <p className="text-lg font-black">Days</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Scope</p>
              <p className="text-lg font-black">Focused</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Exports</p>
              <p className="text-lg font-black">CSV</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-white/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Quick start flow</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 italic">
                  The shortest path to value
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-2">
            <div className="grid gap-4">
              {[
                { n: "01", title: "Create SKUs", desc: "Add raw materials + finished goods in Inventory.", to: "/inventory", icon: Boxes },
                { n: "02", title: "Define BOM", desc: "Link components to finished good, then set Active.", to: "/boms", icon: Factory },
                { n: "03", title: "Order → Job", desc: "Create an order, then generate a production job.", to: "/orders", icon: Zap },
                { n: "04", title: "Ship & invoice", desc: "Create shipment then invoice from Finance.", to: "/shipments", icon: Truck },
              ].map((step) => (
                <div key={step.n} className="rounded-2xl border border-border/60 bg-background/60 p-4 md:p-5 backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Step {step.n}
                        </p>
                        <p className="text-sm font-black tracking-tight">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="h-9 rounded-xl font-bold text-xs shrink-0">
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

        <Card className="border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-white/10 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Included</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 italic">
                  Modules in the SME scope
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-2 space-y-4">
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
                  <p className="text-sm font-black tracking-tight">{row.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
                </div>
              </div>
            ))}
            <Separator className="bg-border/60" />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/inventory">Inventory</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/purchase-orders">Purchase orders</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/production-jobs">Jobs</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/finance">Finance</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-dashed border-2 bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="h-5 w-5" /> Slow or intermittent connectivity
          </CardTitle>
          <CardDescription>
            PO <strong>receive</strong> and inventory manual movements (<strong>receipt/issue/adjustment</strong>) can be saved locally and synced when the connection returns. Use the amber bar at the top to <strong>Sync now</strong>.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5" /> End-to-end workflow handoff
          </CardTitle>
          <CardDescription>
            Follow this sequence from order intake to finance close, with role-aware route gates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Step {row.step}
                </Badge>
                <span className="text-sm font-medium">{row.label}</span>
              </div>
              {row.open ? (
                <Button asChild size="sm" variant="secondary" className="h-8">
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" /> Partners &amp; accountants
          </CardTitle>
          <CardDescription>
            See <code className="text-xs bg-muted px-1 rounded">docs/GTM_PARTNERS.md</code> in the repo for export index, training outline, and regional hosting notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Accountant-friendly CSVs: Finance &amp; Ethiopia tax reports, payroll pension/income-tax exports, inventory
            valuation, AP aging, and more — all Bearer-auth via the app or Postman.
          </p>
        </CardContent>
      </Card>
    </ModuleDashboardLayout>
  );
}
