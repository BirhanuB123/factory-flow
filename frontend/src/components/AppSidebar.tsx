import {
  LayoutDashboard,
  Wrench,
  Package,
  FileStack,
  ShoppingCart,
  Users,
  UserCog,
  Settings,
  Factory,
  CircleDollarSign,
  Truck,
  PackageCheck,
  Layers,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import type { TenantModuleKey } from "@/lib/api";
import { PERMS } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

/** Nav: optional `permissions` (any) or `roles` (legacy self-service). No filter = any authenticated user. */
const allNavItems = [
  { titleKey: "nav.dashboard", url: "/", icon: LayoutDashboard, permissions: [PERMS.DASHBOARD_VIEW] },
  { titleKey: "nav.production", url: "/production", icon: Factory, permissions: [PERMS.DASHBOARD_MFG] },
  { titleKey: "nav.jobs", url: "/production-jobs", icon: Wrench, permissions: [PERMS.DASHBOARD_MFG] },
  { titleKey: "nav.boms", url: "/boms", icon: FileStack, permissions: [PERMS.DASHBOARD_MFG] },
  { titleKey: "nav.orders", url: "/orders", icon: ShoppingCart },
  { titleKey: "nav.clients", url: "/clients", icon: Users },
  { titleKey: "nav.inventory", url: "/inventory", icon: Package, permissions: [PERMS.DASHBOARD_INVENTORY] },
  { titleKey: "nav.purchasing", url: "/purchase-orders", icon: Truck, permissions: [PERMS.PO_VIEW] },
  {
    titleKey: "nav.shipments",
    url: "/shipments",
    icon: PackageCheck,
    permissions: [PERMS.SHIPMENTS_VIEW],
  },
  { titleKey: "nav.hr", url: "/hr", icon: UserCog, permissions: [PERMS.HR_FULL] },
  { titleKey: "nav.hr", url: "/my-hr", icon: UserCog, roles: ["employee"] as const },
  {
    titleKey: "nav.finance",
    url: "/finance",
    icon: CircleDollarSign,
    permissions: [PERMS.FINANCE_READ],
  },
  { titleKey: "nav.smeBundle", url: "/sme-bundle", icon: Layers },
  {
    titleKey: "nav.platform",
    url: "/platform",
    icon: Shield,
    platformSuperAdmin: true,
  },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
] as const;

const routeModuleMap: Partial<Record<(typeof allNavItems)[number]["url"], TenantModuleKey>> = {
  "/production": "manufacturing",
  "/production-jobs": "manufacturing",
  "/boms": "manufacturing",
  "/inventory": "inventory",
  "/orders": "sales",
  "/clients": "sales",
  "/shipments": "sales",
  "/purchase-orders": "procurement",
  "/finance": "finance",
  "/hr": "hr",
  "/my-hr": "hr",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, can } = useAuth();
  const { t } = useLocale();

  const navItems = allNavItems.filter((item) => {
    if ("platformSuperAdmin" in item && item.platformSuperAdmin) {
      return user?.platformRole === "super_admin";
    }
    const moduleKey = routeModuleMap[item.url];
    if (moduleKey && user?.tenantModuleFlags?.[moduleKey] === false) {
      return false;
    }
    if ("permissions" in item && item.permissions?.length) {
      return item.permissions.some((p) => can(p));
    }
    if ("roles" in item && item.roles) {
      const allowed = item.roles as readonly string[];
      if (user && allowed.includes(user.role)) return true;
      return false;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 p-0">
            <img
              src="/integra-logo.svg"
              alt="Integra logo"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
                INTEGRA
              </span>
              <span className="text-[10px] text-sidebar-muted uppercase tracking-widest">
                {t("nav.erpSubtitle")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">
            {t("nav.navigation")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active =
                  item.url === "/"
                    ? currentPath === "/"
                    : currentPath === item.url || currentPath.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{t(item.titleKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="text-[14px] text-sidebar-muted">
            v1.0.0 — Integra ERP
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
