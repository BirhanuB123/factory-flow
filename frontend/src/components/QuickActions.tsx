import { Plus, AlertOctagon, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const actions = [
  { label: "Create New Job", icon: Plus, variant: "default" as const },
  { label: "Report Machine Down", icon: AlertOctagon, variant: "destructive" as const },
  { label: "Receive Inventory", icon: PackagePlus, variant: "outline" as const },
];

export function QuickActions() {
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
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
