import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/** Forces `/account/change-password` until `mustChangePassword` is cleared on the user. */
export function MustChangePasswordGate() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
