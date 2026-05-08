import { useLocation, Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLocale } from "@/contexts/LocaleContext";
import { useMemo } from "react";

const pathMap: Record<string, string> = {
  "analytics": "nav.analytics",
  "reports": "nav.reports",
  "production": "nav.production",
  "production-jobs": "nav.jobs",
  "scheduling": "nav.scheduling",
  "boms": "nav.boms",
  "inventory": "nav.inventory",
  "orders": "nav.orders",
  "crm": "nav.crm",
  "clients": "nav.clients",
  "shipments": "nav.shipments",
  "purchase-orders": "nav.purchasing",
  "finance": "nav.finance",
  "hr": "nav.hr",
  "my-hr": "nav.myHr",
  "pos": "nav.pos",
  "settings": "nav.settings",
  "platform": "nav.platform",
  "profile": "header.profile",
  "document-templates": "nav.documentTemplates",
  "quality-settings": "nav.quality",
  "sme-bundle": "nav.smeBundle",
};

export function DynamicBreadcrumbs() {
  const location = useLocation();
  const { t } = useLocale();

  const breadcrumbs = useMemo(() => {
    const pathnames = location.pathname.split("/").filter((x) => x);
    if (pathnames.length === 0) return [];

    return pathnames.map((name, index) => {
      const routeTo = `/${pathnames.slice(0, index + 1).join("/")}`;
      const isLast = index === pathnames.length - 1;
      const titleKey = pathMap[name] || name;

      return {
        name: t(titleKey),
        path: routeTo,
        isLast,
      };
    });
  }, [location.pathname, t]);

  if (breadcrumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">{t("nav.dashboard")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.path}>{crumb.name}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
