import {
  LayoutDashboard,
  Wrench,
  Package,
  FileStack,
  CalendarDays,
  ShoppingCart,
  Users,
  UserCog,
  Settings,
  Factory,
  CircleDollarSign,
  Truck,
  PackageCheck,
  Layers,
  BarChart3,
  Store,
  QrCode,
  ScanBarcode,
  LayoutTemplate,
  Shield,
  FileBarChart,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Nav: optional `permissions` (any) or `roles` (legacy self-service). No filter = any authenticated user. */
type NavItem = {
  titleKey: string;
  url?: string;
  icon: any;
  permissions?: string[];
  roles?: readonly string[];
  platformSuperAdmin?: boolean;
  items?: readonly {
    titleKey: string;
    url: string;
    icon: any;
    permissions?: string[];
    roles?: readonly string[];
    platformSuperAdmin?: boolean;
  }[];
};

const allNavItems: readonly NavItem[] = [
  {
    titleKey: "nav.intelligence",
    icon: BarChart3,
    items: [
      { titleKey: "nav.dashboard", url: "/", icon: LayoutDashboard, permissions: [PERMS.DASHBOARD_VIEW] },
      { titleKey: "nav.analytics", url: "/analytics", icon: BarChart3, permissions: [PERMS.DASHBOARD_VIEW] },
      { titleKey: "nav.reports", url: "/reports", icon: FileBarChart, permissions: [PERMS.DASHBOARD_VIEW] },
    ],
  },
  {
    titleKey: "nav.commercial",
    icon: ShoppingCart,
    items: [
      { titleKey: "nav.crm", url: "/crm", icon: LayoutTemplate, permissions: [PERMS.DASHBOARD_VIEW] },
      { titleKey: "nav.clients", url: "/clients", icon: Users, roles: ["Admin", "finance_head", "finance_viewer", "hr_head", "purchasing_head", "warehouse_head"] as const },
      { titleKey: "nav.orders", url: "/orders", icon: ShoppingCart, roles: ["Admin", "finance_head", "finance_viewer", "hr_head", "purchasing_head", "warehouse_head"] as const },
      { titleKey: "nav.pos", url: "/pos", icon: Store, permissions: [PERMS.POS_VIEW] },
    ],
  },
  {
    titleKey: "nav.operations",
    icon: Factory,
    items: [
      { titleKey: "nav.production", url: "/production", icon: Factory, permissions: [PERMS.DASHBOARD_MFG] },
      { titleKey: "nav.jobs", url: "/production-jobs", icon: Wrench, permissions: [PERMS.DASHBOARD_MFG] },
      { titleKey: "nav.scheduling", url: "/scheduling", icon: CalendarDays, permissions: [PERMS.DASHBOARD_MFG] },
      { titleKey: "nav.boms", url: "/boms", icon: FileStack, permissions: [PERMS.DASHBOARD_MFG] },
      { titleKey: "nav.quality", url: "/quality-settings", icon: ClipboardCheck, roles: ["Admin", "warehouse_head"] as const },
    ],
  },
  {
    titleKey: "nav.supplyChain",
    icon: Truck,
    items: [
      { titleKey: "nav.inventory", url: "/inventory", icon: Package, permissions: [PERMS.DASHBOARD_INVENTORY] },
      { titleKey: "nav.purchasing", url: "/purchase-orders", icon: Truck, permissions: [PERMS.PO_VIEW] },
      { titleKey: "nav.shipments", url: "/shipments", icon: PackageCheck, permissions: [PERMS.SHIPMENTS_VIEW] },
    ],
  },
  {
    titleKey: "nav.people",
    icon: Users,
    items: [
      { titleKey: "nav.hr", url: "/hr", icon: UserCog, permissions: [PERMS.HR_FULL] },
      { titleKey: "nav.myHr", url: "/my-hr", icon: UserCog, roles: ["employee"] as const },
    ],
  },
  {
    titleKey: "nav.finance",
    url: "/finance",
    icon: CircleDollarSign,
    permissions: [PERMS.FINANCE_READ],
  },
  {
    titleKey: "nav.kiosks",
    icon: ScanBarcode,
    items: [
      { titleKey: "nav.productionKiosk", url: "/kiosk/production", icon: QrCode, permissions: [PERMS.DASHBOARD_MFG] },
      { titleKey: "nav.receivingKiosk", url: "/kiosk/receiving", icon: ScanBarcode, permissions: [PERMS.DASHBOARD_INVENTORY] },
    ],
  },
  {
    titleKey: "nav.system",
    icon: Settings,
    items: [
      { titleKey: "nav.smeBundle", url: "/sme-bundle", icon: Layers },
      { titleKey: "nav.documentTemplates", url: "/document-templates", icon: LayoutTemplate, roles: ["Admin", "finance_head"] as const },
      { titleKey: "nav.platform", url: "/platform", icon: Shield, platformSuperAdmin: true },
      { titleKey: "nav.settings", url: "/settings", icon: Settings },
    ],
  },
];

const routeModuleMap: Partial<Record<string, TenantModuleKey>> = {
  "/production": "manufacturing",
  "/kiosk/production": "manufacturing",
  "/production-jobs": "manufacturing",
  "/scheduling": "manufacturing",
  "/boms": "manufacturing",
  "/inventory": "inventory",
  "/kiosk/receiving": "inventory",
  "/orders": "sales",
  "/analytics": "sales",
  "/reports": "sales",
  "/crm": "sales",
  "/clients": "sales",
  "/shipments": "sales",
  "/purchase-orders": "procurement",
  "/finance": "finance",
  "/hr": "hr",
  "/my-hr": "hr",
  "/pos": "sales",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, can } = useAuth();
  const { t } = useLocale();

  const navItems = allNavItems
    .map((item) => {
      // Filter the item itself
      const visible = (() => {
        if ("platformSuperAdmin" in item && item.platformSuperAdmin) {
          return user?.platformRole === "super_admin";
        }
        if (item.url) {
          const moduleKey = routeModuleMap[item.url];
          if (moduleKey && user?.tenantModuleFlags?.[moduleKey] === false) {
            return false;
          }
        }
        if ("permissions" in item && item.permissions?.length) {
          if (!item.permissions.some((p) => can(p))) return false;
        }
        if ("roles" in item && item.roles) {
          const allowed = item.roles as readonly string[];
          if (!user || !allowed.includes(user.role)) return false;
        }
        return true;
      })();

      if (!visible) return null;

      // Filter sub-items if any
      if (item.items) {
        const filteredSubItems = item.items.filter((sub) => {
          if (sub.platformSuperAdmin) {
            if (user?.platformRole !== "super_admin") return false;
          }
          const subModuleKey = routeModuleMap[sub.url];
          if (subModuleKey && user?.tenantModuleFlags?.[subModuleKey] === false) {
            return false;
          }
          if (sub.permissions?.length) {
            if (!sub.permissions.some((p) => can(p))) return false;
          }
          if (sub.roles) {
            const allowed = sub.roles as readonly string[];
            if (!user || !allowed.includes(user.role)) return false;
          }
          return true;
        });

        if (filteredSubItems.length === 0) return null;

        return { ...item, items: filteredSubItems };
      }

      return item;
    })
    .filter(Boolean) as NavItem[];

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
                const active = item.url
                  ? item.url === "/"
                    ? currentPath === "/"
                    : currentPath === item.url || currentPath.startsWith(item.url + "/")
                  : item.items?.some((sub) => currentPath === sub.url || currentPath.startsWith(sub.url + "/"));

                if (item.items) {
                  return (
                    <Collapsible
                      key={`${item.titleKey}`}
                      asChild
                      defaultOpen={active}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={t(item.titleKey)} size="lg" className="h-11 rounded-xl px-3">
                            <item.icon
                              className={[
                                "!h-[18px] !w-[18px] shrink-0",
                                active ? "text-[hsl(221,83%,53%)]" : "text-sidebar-muted",
                              ].join(" ")}
                            />
                            {!collapsed && (
                              <>
                                <span className="truncate">{t(item.titleKey)}</span>
                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => {
                              const subActive =
                                currentPath === subItem.url || currentPath.startsWith(subItem.url + "/");
                              return (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild isActive={subActive}>
                                    <NavLink to={subItem.url}>
                                      <subItem.icon
                                        className={[
                                          "!h-[16px] !w-[16px] shrink-0",
                                          subActive ? "text-[hsl(221,83%,53%)]" : "text-sidebar-muted",
                                        ].join(" ")}
                                      />
                                      <span>{t(subItem.titleKey)}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={`${item.titleKey}-${item.url}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      size="lg"
                      className="h-11 rounded-xl px-3 transition-colors data-[active=true]:shadow-sm"
                    >
                      <NavLink
                        to={item.url!}
                        end
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                        activeClassName="!bg-sidebar-accent !text-[hsl(221,83%,70%)] !font-semibold"
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
