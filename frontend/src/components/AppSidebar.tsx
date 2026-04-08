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
  BarChart3,
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
import { ThemeToggle } from "@/components/ThemeToggle";

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
  { titleKey: "nav.myHr", url: "/my-hr", icon: UserCog, roles: ["employee"] as const },
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
  { titleKey: "nav.reports", url: "/reports", icon: BarChart3, permissions: [PERMS.DASHBOARD_VIEW] },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border z-20">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden"
            aria-hidden
            style={{ width: collapsed ? 36 : 40, height: collapsed ? 36 : 40 }}
          >
            <img
              src="/favicon.png"
              alt="Integra Logo"
              className="h-full w-full object-contain"
            />
          </div>

          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Integra</span>
              <span className="text-[11px] font-medium text-sidebar-muted">
                {t("nav.erpSubtitle")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
            {t("nav.navigation")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const active =
                  item.url === "/"
                    ? currentPath === "/"
                    : currentPath === item.url || currentPath.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={`${item.titleKey}-${item.url}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      size="lg"
                      className="h-11 rounded-xl px-3 transition-colors data-[active=true]:shadow-sm"
                    >
                      <NavLink
                        to={item.url}
                        end
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                        activeClassName="!bg-sidebar-accent !text-[hsl(221,83%,45%)] !font-semibold"
                      >
                        <item.icon
                          className={[
                            "!h-[18px] !w-[18px] shrink-0",
                            active ? "text-[hsl(221,83%,53%)]" : "text-sidebar-muted",
                          ].join(" ")}
                        />
                        {!collapsed && <span className="truncate">{t(item.titleKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-2 p-4 pt-2">
        <div className={collapsed ? "flex justify-center" : "flex justify-start"}>
          <ThemeToggle compact={collapsed} />
        </div>
        {!collapsed && (
          <div className="rounded-xl border border-sidebar-border/80 bg-muted/40 px-3 py-2 text-[11px] text-sidebar-muted">
            {t("sidebar.version")}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
