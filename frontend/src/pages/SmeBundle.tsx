import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Truck,
  Factory,
  FileSpreadsheet,
  WifiOff,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { ModuleDashboardLayout } from "@/components/ModuleDashboardLayout";

/**
 * In-app overview of the SME go-to-market package (inventory + PO + simple production + ETB finance).
 */
export default function SmeBundle() {
  return (
    <ModuleDashboardLayout
      title="SME package"
      description="One clear scope before APS/MES: stock, purchasing, light production, and Ethiopia-ready invoices."
      icon={Package}
      healthStats={[
        { label: "Core modules", value: "4" },
        { label: "Offline queue", value: "Receipt / issue" },
        { label: "Currency", value: "ETB-first" },
      ]}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-lg bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" /> Inventory &amp; movements
            </CardTitle>
            <CardDescription>On-hand, adjustments, manual receipt/issue — works with an offline queue on poor links.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/inventory">
                Open inventory <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5 text-primary" /> Purchase orders &amp; receive
            </CardTitle>
            <CardDescription>Draft → approve → receive into stock; import landed cost and lot/batch optional.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/purchase-orders">
                Purchasing <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Factory className="h-5 w-5 text-primary" /> Simple production
            </CardTitle>
            <CardDescription>BOMs, jobs, shop-floor operations — not full APS/MES scheduling.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/boms">BOMs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/production-jobs">Jobs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> ETB invoices &amp; tax
            </CardTitle>
            <CardDescription>VAT/WHT settings, tax invoice HTML, CSV exports for accountants.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/finance">
                Finance <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-dashed border-2 bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="h-5 w-5" /> Slow or intermittent connectivity
          </CardTitle>
          <CardDescription>
            PO <strong>receive</strong> and inventory <strong>receipt/issue</strong> (manual movement) can be saved locally and synced when the connection returns. Use the amber bar at the top to <strong>Sync now</strong>.
          </CardDescription>
        </CardHeader>
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
