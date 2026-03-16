import { KpiCards } from "@/components/KpiCards";
import { ProductionJobsTable } from "@/components/ProductionJobsTable";
import { QuickActions } from "@/components/QuickActions";
import { DashboardCharts } from "@/components/DashboardCharts";
import { MachineStatus } from "@/components/MachineStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/use-settings";
import { Sparkles } from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const userName = user?.name || settings.displayName || "Operator";
  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Good Morning" : hours < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
              {greeting}, {userName.split(' ')[0]}
            </h1>
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-sm font-medium text-muted-foreground max-w-md">
            Your factory is humming. Here's what's happening on the floor right now.
          </p>
        </div>
        
        <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-secondary/50 rounded-2xl backdrop-blur-sm border border-border/50">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">System Health</p>
            <p className="text-sm font-mono font-bold text-success">OPERATIONAL</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Efficiency</p>
            <p className="text-sm font-mono font-bold">94.8%</p>
          </div>
        </div>
      </div>

      <KpiCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <DashboardCharts />
          <ProductionJobsTable />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <MachineStatus />
        </div>
      </div>
    </div>
  );
};

export default Index;
