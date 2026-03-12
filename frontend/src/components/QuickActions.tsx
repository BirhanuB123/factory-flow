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
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="w-full justify-start gap-2.5"
            onClick={() => {
              if (action.path) navigate(action.path);
              else toast.info("Report machine down: log this in your maintenance system.");
            }}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
