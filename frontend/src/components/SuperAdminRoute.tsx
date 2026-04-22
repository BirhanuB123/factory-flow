import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingLogo } from "./ui/LoadingLogo";

/** Only `platformRole === 'super_admin'` may access nested routes. */
export function SuperAdminRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <LoadingLogo size={48} className="text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.platformRole !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
