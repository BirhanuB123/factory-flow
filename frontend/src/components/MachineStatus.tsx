import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle } from "lucide-react";

const machines = [
  { name: "CNC Lathe A1", status: "running", uptime: "98.2%", health: 100 },
  { name: "3D Printer B4", status: "running", uptime: "95.5%", health: 92 },
  { name: "Milling Station", status: "idle", uptime: "88.1%", health: 85 },
  { name: "Laser Cutter", status: "down", uptime: "76.4%", health: 45 },
  { name: "Assembly Robot", status: "running", uptime: "99.1%", health: 98 },
  { name: "Quality Scanner", status: "running", uptime: "97.8%", health: 100 },
];

export function MachineStatus() {
  return (
    <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Machine Health & Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {machines.map((machine) => (
            <div 
              key={machine.name} 
              className="group p-3 rounded-xl border bg-background/40 hover:bg-background/60 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold truncate max-w-[120px]">{machine.name}</span>
                <div className="flex items-center gap-1.5">
                  <Circle className={`h-2.5 w-2.5 fill-current ${
                    machine.status === 'running' ? 'text-success' : 
                    machine.status === 'idle' ? 'text-warning' : 'text-destructive'
                  }`} />
                  <span className="text-[10px] uppercase font-bold tracking-tight opacity-70">
                    {machine.status}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono font-medium">{machine.uptime}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      machine.health > 80 ? 'bg-success' : machine.health > 50 ? 'bg-warning' : 'bg-destructive'
                    }`}
                    style={{ width: `${machine.health}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
