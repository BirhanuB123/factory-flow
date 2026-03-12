import { KpiCards } from "@/components/KpiCards";
import { ProductionJobsTable } from "@/components/ProductionJobsTable";
import { QuickActions } from "@/components/QuickActions";

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Shop Floor Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Real-time overview of production, machines, and inventory
        </p>
      </div>

      <KpiCards />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <ProductionJobsTable />
        <QuickActions />
      </div>
    </div>
  );
};

export default Index;
