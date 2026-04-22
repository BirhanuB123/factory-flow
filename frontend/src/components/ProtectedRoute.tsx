import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, Role } from '../contexts/AuthContext';
import { LoadingLogo } from './ui/LoadingLogo';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  /** User must have at least one of these (unless requireAllPermissions). */
  requiredPermissions?: string[];
  /** When true, user must have every permission in requiredPermissions. */
  requireAllPermissions?: boolean;
}

export const ProtectedRoute = ({
  allowedRoles,
  requiredPermissions,
  requireAllPermissions = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <LoadingLogo size={48} className="text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Role not authorized, redirect to home page or show forbidden page
    return <Navigate to="/" replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0 && user) {
    const ok = requireAllPermissions
      ? requiredPermissions.every((p) => can(p))
      : requiredPermissions.some((p) => can(p));
    if (!ok) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
