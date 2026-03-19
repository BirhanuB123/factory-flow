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
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthProvider } from "./contexts/AuthContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login.tsx";
import Profile from "./pages/Profile.tsx";
import Index from "./pages/Index.tsx";
import ProductionJobs from "./pages/ProductionJobs.tsx";
import Inventory from "./pages/Inventory.tsx";
import Boms from "./pages/Boms.tsx";
import Orders from "./pages/Orders.tsx";
import Clients from "./pages/Clients.tsx";
import Hr from "./pages/Hr.tsx";
import Finance from "./pages/Finance.tsx";
import Production from "./pages/Production.tsx";
import PurchaseOrders from "./pages/PurchaseOrders.tsx";
import Shipments from "./pages/Shipments.tsx";
import Settings from "./pages/Settings.tsx";
import SmeBundle from "./pages/SmeBundle.tsx";
import NotFound from "./pages/NotFound.tsx";

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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function SidebarResizeHandle({
  valuePx,
  onChange,
}: {
  valuePx: number;
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
      aria-valuemax={SIDEBAR_MAX_PX}
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
        const next = clamp(e.clientX, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX);
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
          onChange(clamp(valuePx - step, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(clamp(valuePx + step, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX));
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
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) return clamp(parsed, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX);
    return 320;
  });

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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarResizeHandle valuePx={sidebarWidthPx} onChange={setSidebarWidthPx} />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <OfflineQueueBanner />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <Outlet />
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
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LocaleProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/production" element={<Production />} />
                  <Route path="/production-jobs" element={<ProductionJobs />} />
                  <Route path="/boms" element={<Boms />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/purchase-orders" element={<PurchaseOrders />} />
                  <Route element={<ProtectedRoute allowedRoles={['Admin', 'hr_head', 'finance_head']} />}>
                    <Route path="/hr" element={<Hr />} />
                  </Route>
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={["Admin", "finance_head", "finance_viewer"]} />
                    }
                  >
                    <Route path="/finance" element={<Finance />} />
                  </Route>
                  <Route
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "Admin",
                          "warehouse_head",
                          "finance_head",
                          "finance_viewer",
                          "purchasing_head",
                        ]}
                      />
                    }
                  >
                    <Route path="/shipments" element={<Shipments />} />
                  </Route>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/sme-bundle" element={<SmeBundle />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
            </LocaleProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
