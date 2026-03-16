import { useNavigate } from "react-router-dom";
import { Plus, AlertOctagon, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const actions = [
  { label: "Create New Job", icon: Plus, variant: "default" as const, path: "/jobs" },
  { label: "Report Machine Down", icon: AlertOctagon, variant: "destructive" as const, path: null as string | null },
  { label: "Receive Inventory", icon: PackagePlus, variant: "outline" as const, path: "/inventory" },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Operations
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2.5">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className={`w-full justify-between h-11 group transition-all duration-300 ${
              action.variant === 'default' ? 'shadow-lg shadow-primary/20 hover:shadow-primary/40' : 
              action.variant === 'destructive' ? 'shadow-lg shadow-destructive/10 hover:shadow-destructive/20' : ''
            }`}
            onClick={() => {
              if (action.path) navigate(action.path);
              else toast.info("Report machine down: log this in your maintenance system.");
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-background/20 group-hover:bg-background/40 transition-colors">
                <action.icon className="h-4 w-4" />
              </div>
              <span className="font-semibold text-xs tracking-tight">{action.label}</span>
            </div>
            <div className="h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/20">
              <Plus className="h-3 w-3 rotate-45" />
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
