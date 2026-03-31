import { useNavigate } from "react-router-dom";
import { Plus, AlertOctagon, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantModuleKey } from "@/lib/api";
import { toast } from "sonner";
import { PERMS } from "@/lib/permissions";

const actions = [
  {
    label: "Create New Job",
    icon: Plus,
    variant: "default" as const,
    path: "/production-jobs?action=new",
    moduleKey: "manufacturing" as TenantModuleKey,
    permission: PERMS.DASHBOARD_MFG,
  },
  {
    label: "Report Machine Down",
    icon: AlertOctagon,
    variant: "destructive" as const,
    path: null as string | null,
    moduleKey: "manufacturing" as TenantModuleKey,
    permission: PERMS.DASHBOARD_MFG,
  },
  {
    label: "Receive Inventory",
    icon: PackagePlus,
    variant: "outline" as const,
    path: "/inventory?action=receipt",
    moduleKey: "inventory" as TenantModuleKey,
    permission: PERMS.DASHBOARD_INVENTORY,
  },
];

export function QuickActions() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const visible = actions.filter((action) => (action.permission ? can(action.permission) : true));
  if (visible.length === 0) return null;

  return (
    <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Operations
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2.5">
        {visible.map((action) => {
          const isDisabledByPolicy =
            user?.platformRole !== "super_admin" && user?.tenantModuleFlags?.[action.moduleKey] === false;
          return (
          <Button
            key={action.label}
            variant={action.variant}
            disabled={isDisabledByPolicy}
            className={`w-full justify-between h-11 group transition-all duration-300 ${
              action.variant === 'default' ? 'shadow-lg shadow-primary/20 hover:shadow-primary/40' : 
              action.variant === 'destructive' ? 'shadow-lg shadow-destructive/10 hover:shadow-destructive/20' : ''
            }`}
            onClick={() => {
              if (isDisabledByPolicy) {
                toast.error("This action is disabled by your tenant module policy.");
                return;
              }
              if (action.path) {
                const [pathname, search] = action.path.split("?");
                navigate({ pathname, search: search ? `?${search}` : "" });
              }
              else toast.info("Report machine down: log this in your maintenance system.");
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-background/20 group-hover:bg-background/40 transition-colors">
                <action.icon className="h-4 w-4" />
              </div>
              <span className="font-semibold text-xs tracking-tight">{action.label}</span>
              {isDisabledByPolicy ? (
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-amber-500/40 text-amber-700 dark:text-amber-300">
                  Disabled
                </Badge>
              ) : null}
            </div>
            <div className="h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/20">
              <Plus className="h-3 w-3 rotate-45" />
            </div>
          </Button>
        )})}
      </CardContent>
    </Card>
  );
}
