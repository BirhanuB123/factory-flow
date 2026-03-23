import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { isLikelyMongoObjectId } from "@/lib/tenantContext";
import { cn } from "@/lib/utils";

/** Sentinel: use employee profile `tenantId` for `x-tenant-id` (no override). */
const PROFILE_CONTEXT = "__profile_context__";

type TenantContextSelectProps = {
  /** Wider layout in header vs compact in menu */
  variant?: "header" | "menu";
  className?: string;
};

/**
 * Core control: which company context applies to ERP API calls (`x-tenant-id`).
 */
export function TenantContextSelect({ variant = "header", className }: TenantContextSelectProps) {
  const { user, actAsTenantId, setActAsTenantId } = useAuth();

  if (user?.platformRole !== "super_admin") return null;

  const { data, isLoading } = useQuery({
    queryKey: ["platform-tenants-header"],
    queryFn: () => platformApi.listTenants(),
    staleTime: 60_000,
  });

  const tenants = data?.data ?? [];
  const homeId = user.tenantId && isLikelyMongoObjectId(user.tenantId) ? user.tenantId : null;

  const selectValue: string | undefined = actAsTenantId
    ? actAsTenantId
    : homeId
      ? PROFILE_CONTEXT
      : undefined;

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 text-muted-foreground", className)}>
      <Building2 className="h-4 w-4 shrink-0 hidden sm:inline" aria-hidden />
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === PROFILE_CONTEXT) setActAsTenantId(null);
            else setActAsTenantId(v);
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 text-xs border-dashed",
              variant === "header"
                ? "w-[min(200px,36vw)] sm:w-[min(240px,28vw)]"
                : "w-full"
            )}
          >
            <SelectValue placeholder="Company for ERP…" />
          </SelectTrigger>
          <SelectContent align="end">
            {homeId ? (
              <SelectItem value={PROFILE_CONTEXT} className="text-xs">
                Profile default company
              </SelectItem>
            ) : null}
            {tenants.map((t) => (
              <SelectItem key={t._id} value={t._id} className="text-xs">
                {(t.displayName || t.legalName) + ` (${t.key})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/**
 * Header row: visible on all breakpoints (was `lg` only — many laptops/tablets missed it).
 */
export function SuperTenantSwitcher() {
  return (
    <TenantContextSelect
      variant="header"
      className="mr-1 sm:mr-2 shrink-0 max-md:max-w-[min(200px,46vw)]"
    />
  );
}
