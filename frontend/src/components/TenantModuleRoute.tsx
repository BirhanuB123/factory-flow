import { Outlet, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantModuleKey } from "@/lib/api";

interface TenantModuleRouteProps {
  moduleKey: TenantModuleKey;
  moduleLabel: string;
}

export function TenantModuleRoute({ moduleKey, moduleLabel }: TenantModuleRouteProps) {
  const { user } = useAuth();

  if (user?.platformRole === "super_admin") return <Outlet />;

  if (user?.tenantModuleFlags?.[moduleKey] === false) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Module disabled for your company</h2>
            <p className="text-sm text-muted-foreground">
              The <span className="font-medium text-foreground">{moduleLabel}</span> module is currently turned off
              by your platform administrator for this tenant.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact your platform admin to enable access, or return to{" "}
              <Link to="/" className="text-primary underline underline-offset-4">
                Dashboard
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
