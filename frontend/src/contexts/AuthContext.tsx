import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type Role =
  | "employee"
  | "Admin"
  | "finance_head"
  | "finance_viewer"
  | "hr_head"
  | "purchasing_head"
  | "warehouse_head";

export interface User {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User & { token?: string }, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  can: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5000/api";

export function useCan(permission: string): boolean {
  const { can } = useAuth();
  return can(permission);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === "Admin") return true;
      const p = user.permissions || [];
      if (p.includes("*")) return true;
      return p.includes(permission);
    },
    [user]
  );

  const refreshPermissions = useCallback(async () => {
    const t = localStorage.getItem("erp_token");
    if (!t) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const u: User = {
        _id: data._id,
        employeeId: data.employeeId,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        permissions: data.permissions,
      };
      setUser(u);
      localStorage.setItem("erp_user", JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }, []);

  /** Must validate token with API — stale localStorage alone caused 401 spam on every route */
  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const storedToken = localStorage.getItem("erp_token");
      if (!storedToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!res.ok) {
          localStorage.removeItem("erp_token");
          localStorage.removeItem("erp_user");
          if (!cancelled) {
            setToken(null);
            setUser(null);
          }
        } else {
          const data = await res.json();
          const u: User = {
            _id: data._id,
            employeeId: data.employeeId,
            name: data.name,
            email: data.email,
            role: data.role,
            department: data.department,
            permissions: data.permissions,
          };
          if (!cancelled) {
            setToken(storedToken);
            setUser(u);
            localStorage.setItem("erp_user", JSON.stringify(u));
          }
        }
      } catch {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_user");
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (userData: User & { token?: string }, t: string) => {
    const u: User = {
      _id: userData._id,
      employeeId: userData.employeeId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      department: userData.department,
      permissions: userData.permissions,
    };
    setUser(u);
    setToken(t);
    localStorage.setItem("erp_user", JSON.stringify(u));
    localStorage.setItem("erp_token", t);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("erp_user");
    localStorage.removeItem("erp_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isLoading,
        can,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
