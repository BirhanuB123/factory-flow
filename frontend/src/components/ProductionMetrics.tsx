import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, Zap, Clock } from "lucide-react";
import { StatRing } from "@/components/StatRing";

export function ProductionMetrics() {
  const metrics = [
    {
      label: "Operational efficiency",
      value: "94.8%",
      secondary: "+2.4% from avg",
      icon: Activity,
      ring: 95,
      color: "hsl(152, 69%, 42%)",
    },
    {
      label: "Daily output target",
      value: "1,240",
      secondary: "85% complete",
      icon: Target,
      ring: 85,
      color: "hsl(221, 83%, 53%)",
    },
    {
      label: "Live cycle time",
      value: "4.2m",
      secondary: "−0.3m optimization",
      icon: Zap,
      ring: 78,
      color: "hsl(32, 95%, 52%)",
    },
    {
      label: "Lead time (avg)",
      value: "2.5d",
      secondary: "Within KPI range",
      icon: Clock,
      ring: 92,
      color: "hsl(262, 83%, 58%)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <Card
          key={m.label}
          className="rounded-2xl border-0 bg-card shadow-erp transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <CardContent className="flex flex-col items-center p-6 pt-7 text-center">
            <div className="relative mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
              <StatRing pct={m.ring} color={m.color} size={72} stroke={5} />
              <div
                className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-muted/50"
                style={{ color: m.color }}
              >
                <m.icon className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{m.value}</p>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">{m.label}</p>
            <p className="mt-2 text-xs text-muted-foreground/90">{m.secondary}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
