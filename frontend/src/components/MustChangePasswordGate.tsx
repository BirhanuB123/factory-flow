import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingLogo } from "./ui/LoadingLogo";

/** Forces `/account/change-password` until `mustChangePassword` is cleared on the user. */
export function MustChangePasswordGate() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <LoadingLogo size={48} className="text-primary" />
      </div>
    );
  }

  if (
    user?.mustChangePassword &&
    !location.pathname.startsWith("/account/change-password")
  ) {
    return <Navigate to="/account/change-password" replace />;
  }

  return <Outlet />;
}
