import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, Zap, Clock } from "lucide-react";

export function ProductionMetrics() {
  const metrics = [
    {
      label: "Operational Efficiency",
      value: "94.8%",
      secondary: "+2.4% from avg",
      icon: Activity,
      color: "text-success",
      bg: "bg-success/10",
      progress: 94.8
    },
    {
      label: "Daily Output Target",
      value: "1,240",
      secondary: "85% complete",
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      progress: 85
    },
    {
      label: "Live Cycle Time",
      value: "4.2m",
      secondary: "-0.3m optimization",
      icon: Zap,
      color: "text-warning",
      bg: "bg-warning/10",
      progress: 78
    },
    {
      label: "Lead Time (Avg)",
      value: "2.5d",
      secondary: "Within KPI range",
      icon: Clock,
      color: "text-info",
      bg: "bg-info/10",
      progress: 92
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <Card key={m.label} className="relative overflow-hidden group border-none shadow-md bg-card/60 backdrop-blur-md">
           <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full blur-3xl opacity-10 ${m.bg}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className="text-2xl font-black tracking-tighter">{m.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${m.bg}`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className="text-muted-foreground">{m.secondary}</span>
                <span className={m.color}>{m.progress}%</span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${m.color.replace('text', 'bg')}`} 
                  style={{ width: `${m.progress}%` }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
