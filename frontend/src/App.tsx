import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import * as React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { OfflineQueueBanner } from "@/components/OfflineQueueBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthProvider } from "./contexts/AuthContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoadingLogo } from "@/components/ui/LoadingLogo";

const Login = React.lazy(() => import("./pages/Login.tsx"));
const InviteAccept = React.lazy(() => import("./pages/InviteAccept.tsx"));
const ChangePassword = React.lazy(() => import("./pages/ChangePassword.tsx"));
const Profile = React.lazy(() => import("./pages/Profile.tsx"));
const Index = React.lazy(() => import("./pages/Index.tsx"));
const Reports = React.lazy(() => import("./pages/Reports.tsx"));
const ProductionJobs = React.lazy(() => import("./pages/ProductionJobs.tsx"));
const Inventory = React.lazy(() => import("./pages/Inventory.tsx"));
const Boms = React.lazy(() => import("./pages/Boms.tsx"));
const Orders = React.lazy(() => import("./pages/Orders.tsx"));
const Clients = React.lazy(() => import("./pages/Clients.tsx"));
const Hr = React.lazy(() => import("./pages/Hr.tsx"));
const EmployeeHr = React.lazy(() => import("./pages/EmployeeHr.tsx"));
const Finance = React.lazy(() => import("./pages/Finance.tsx"));
const Production = React.lazy(() => import("./pages/Production.tsx"));
const PurchaseOrders = React.lazy(() => import("./pages/PurchaseOrders.tsx"));
const Shipments = React.lazy(() => import("./pages/Shipments.tsx"));
const Settings = React.lazy(() => import("./pages/Settings.tsx"));
const SmeBundle = React.lazy(() => import("./pages/SmeBundle.tsx"));
const NotFound = React.lazy(() => import("./pages/NotFound.tsx"));
const PlatformAdmin = React.lazy(() => import("./pages/PlatformAdmin.tsx"));
const PlatformTenantDetail = React.lazy(() => import("./pages/PlatformTenantDetail.tsx"));
const Pos = React.lazy(() => import("./pages/Pos.tsx"));
const ProductionKiosk = React.lazy(() => import("./pages/kiosk/ProductionKiosk.tsx"));
const ReceivingKiosk = React.lazy(() => import("./pages/kiosk/ReceivingKiosk.tsx"));
const Crm = React.lazy(() => import("./pages/Crm.tsx"));
const Scheduling = React.lazy(() => import("./pages/Scheduling.tsx"));
const Analytics = React.lazy(() => import("./pages/Analytics.tsx"));
const DocumentTemplates = React.lazy(() => import("./pages/DocumentTemplates.tsx"));
const QualitySettings = React.lazy(() => import("./pages/QualitySettings.tsx"));
import { KioskLayout } from "./components/KioskLayout";
import { SuperAdminRoute } from "./components/SuperAdminRoute";
import { MustChangePasswordGate } from "./components/MustChangePasswordGate";
import { TenantModuleRoute } from "./components/TenantModuleRoute";
import { PERMS } from "./lib/permissions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status;
        if (status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

const SIDEBAR_WIDTH_STORAGE_KEY = "ff:sidebarWidthPx";
const SIDEBAR_MIN_PX = 220;
const SIDEBAR_MAX_PX = 520;
const MAIN_CONTENT_MIN_PX = 480;
const SIDEBAR_RESIZE_HANDLE_PX = 8;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function maxSidebarPxForViewport(viewportWidth: number) {
  const cap = viewportWidth - MAIN_CONTENT_MIN_PX - SIDEBAR_RESIZE_HANDLE_PX;
  return clamp(Math.min(SIDEBAR_MAX_PX, cap), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX);
}

function defaultSidebarWidthForViewport(viewportWidth: number) {
  if (viewportWidth < 1024) return 260;
  if (viewportWidth < 1280) return 280;
  if (viewportWidth < 1536) return 300;
  return 320;
}

function SidebarResizeHandle({
  valuePx,
  maxPx,
  onChange,
}: {
  valuePx: number;
  maxPx: number;
  onChange: (nextPx: number) => void;
}) {
  const isMobile = useIsMobile();
  const draggingRef = React.useRef(false);

  if (isMobile) return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN_PX}
      aria-valuemax={Math.round(maxPx)}
      aria-valuenow={Math.round(valuePx)}
      tabIndex={0}
      className={[
        "relative h-svh w-2 shrink-0",
        "cursor-col-resize",
        "group/sidebar-resizer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      ].join(" ")}
      onPointerDown={(e) => {
        // Only left-click/primary pointer
        if (e.button !== 0) return;
        draggingRef.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const next = clamp(e.clientX, SIDEBAR_MIN_PX, maxPx);
        onChange(next);
      }}
      onPointerUp={(e) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // no-op
        }
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 24 : 12;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(clamp(valuePx - step, SIDEBAR_MIN_PX, maxPx));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(clamp(valuePx + step, SIDEBAR_MIN_PX, maxPx));
        }
      }}
    >
      <div
        className={[
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2",
          "bg-border/60",
          "group-hover/sidebar-resizer:bg-border",
          "group-active/sidebar-resizer:bg-primary/70",
        ].join(" ")}
      />
      <div
        className={[
          "absolute inset-y-0 left-1/2 w-1 -translate-x-1/2",
          "opacity-0 group-hover/sidebar-resizer:opacity-100",
          "bg-primary/10",
          "transition-opacity",
        ].join(" ")}
      />
    </div>
  );
}

const Layout = () => {
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  const maxSidebarPx = maxSidebarPxForViewport(viewportWidth);

  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const cap = maxSidebarPxForViewport(vw);
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) return clamp(parsed, SIDEBAR_MIN_PX, cap);
    return clamp(defaultSidebarWidthForViewport(vw), SIDEBAR_MIN_PX, cap);
  });

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  React.useEffect(() => {
    setSidebarWidthPx((w) => clamp(w, SIDEBAR_MIN_PX, maxSidebarPx));
  }, [maxSidebarPx]);

  React.useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(sidebarWidthPx)));
  }, [sidebarWidthPx]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidthPx}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-svh w-full min-w-0">
        <AppSidebar />
        <SidebarResizeHandle maxPx={maxSidebarPx} valuePx={sidebarWidthPx} onChange={setSidebarWidthPx} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <OfflineQueueBanner />
          <AnnouncementBanner />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-background p-3 sm:p-4 lg:p-6">
            <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center py-12"><LoadingLogo size={48} /></div>}>
              <Outlet />
            </React.Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" closeButton />
        <BrowserRouter>
          <AuthProvider>
            <LocaleProvider>
              <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center"><LoadingLogo size={64} /></div>}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/invite" element={<InviteAccept />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<MustChangePasswordGate />}>
                      <Route element={<KioskLayout />}>
                        <Route path="/kiosk/production/:token?" element={<ProductionKiosk />} />
                        <Route path="/kiosk/receiving" element={<ReceivingKiosk />} />
                      </Route>

                      <Route element={<Layout />}>
                        <Route element={<ProtectedRoute requiredPermissions={[PERMS.DASHBOARD_VIEW]} />}>
                          <Route path="/" element={<Index />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/reports" element={<Reports />} />
                        </Route>
                        <Route element={<ProtectedRoute requiredPermissions={[PERMS.DASHBOARD_MFG]} />}>
                          <Route element={<TenantModuleRoute moduleKey="manufacturing" moduleLabel="Manufacturing & production" />}>
                            <Route path="/production" element={<Production />} />
                            <Route path="/production-jobs" element={<ProductionJobs />} />
                            <Route path="/scheduling" element={<Scheduling />} />
                            <Route path="/boms" element={<Boms />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="sales" moduleLabel="Sales & orders" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.POS_VIEW]} />}>
                            <Route path="/pos" element={<Pos />} />
                          </Route>
                          <Route element={<ProtectedRoute allowedRoles={["Admin", "finance_head", "finance_viewer", "hr_head", "purchasing_head", "warehouse_head"]} />}>
                            <Route path="/orders" element={<Orders />} />
                            <Route path="/crm" element={<Crm />} />
                            <Route path="/clients" element={<Clients />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="inventory" moduleLabel="Inventory & stock" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.DASHBOARD_INVENTORY]} />}>
                            <Route path="/inventory" element={<Inventory />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="procurement" moduleLabel="Procurement & POs" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.PO_VIEW]} />}>
                            <Route path="/purchase-orders" element={<PurchaseOrders />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="hr" moduleLabel="HR & payroll" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.HR_FULL]} />}>
                            <Route path="/hr" element={<Hr />} />
                          </Route>
                          <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
                            <Route path="/my-hr" element={<EmployeeHr />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="finance" moduleLabel="Finance & AP/AR" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.FINANCE_READ]} />}>
                            <Route path="/finance" element={<Finance />} />
                          </Route>
                        </Route>
                        <Route element={<TenantModuleRoute moduleKey="sales" moduleLabel="Sales & orders" />}>
                          <Route element={<ProtectedRoute requiredPermissions={[PERMS.SHIPMENTS_VIEW]} />}>
                            <Route path="/shipments" element={<Shipments />} />
                          </Route>
                        </Route>
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/account/change-password" element={<ChangePassword />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/document-templates" element={<DocumentTemplates />} />
                        <Route path="/quality-settings" element={<QualitySettings />} />
                        <Route path="/sme-bundle" element={<SmeBundle />} />
                        <Route element={<SuperAdminRoute />}>
                          <Route path="/platform" element={<PlatformAdmin />} />
                          <Route path="/platform/tenants/:tenantId" element={<PlatformTenantDetail />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </React.Suspense>
            </LocaleProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;