import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import {
  ERP_ACT_AS_TENANT_KEY,
  getEffectiveTenantIdForRequest,
  isLikelyMongoObjectId,
} from "@/lib/tenantContext";
import { getApiBaseUrl } from "@/lib/apiBase";
import type { TenantModuleFlags } from "@/lib/api";

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
  /** Company (tenant) scope — use x-tenant-id on API for super_admin switching */
  tenantId?: string;
  platformRole?: "none" | "super_admin";
  /** After temp-password onboarding; must use change-password flow */
  mustChangePassword?: boolean;
  permissions?: string[];
  tenantSubscription?: {
    status: "active" | "trial" | "suspended" | "archived" | string;
    plan?: string;
    trialEndDate?: string | null;
    statusReason?: string;
    displayName?: string;
    moduleFlags?: Partial<TenantModuleFlags>;
  } | null;
  tenantModuleFlags?: Partial<TenantModuleFlags>;
}

/** Normalize login + /auth/me JSON (handles string ids, platformRole). */
export function userFromApiPayload(data: Record<string, unknown>): User {
  return {
    _id: String(data._id),
    employeeId: String(data.employeeId ?? ""),
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    role: data.role as Role,
    department: String(data.department ?? ""),
    tenantId: data.tenantId != null ? String(data.tenantId) : undefined,
    platformRole: data.platformRole === "super_admin" ? "super_admin" : "none",
    mustChangePassword: data.mustChangePassword === true,
    permissions: data.permissions as string[] | undefined,
    tenantSubscription:
      data.tenantSubscription && typeof data.tenantSubscription === "object"
        ? (data.tenantSubscription as User["tenantSubscription"])
        : null,
    tenantModuleFlags:
      data.tenantModuleFlags && typeof data.tenantModuleFlags === "object"
        ? (data.tenantModuleFlags as User["tenantModuleFlags"])
        : undefined,
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** Pass raw JSON from POST /auth/login (same shape as /auth/me, may include `token`). */
  login: (apiUserPayload: Record<string, unknown>, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  can: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
  /** Merge into current user and persist `erp_user` (e.g. clear mustChangePassword before navigate). */
  patchUser: (patch: Partial<User>) => void;
  /** Super admin only: optional override for `x-tenant-id` (persisted in localStorage). */
  actAsTenantId: string | null;
  setActAsTenantId: (tenantId: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useCan(permission: string): boolean {
  const { can } = useAuth();
  return can(permission);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actAsTenantId, setActAsTenantIdState] = useState<string | null>(null);

  const setActAsTenantId = useCallback((id: string | null) => {
    if (id && isLikelyMongoObjectId(id)) {
      localStorage.setItem(ERP_ACT_AS_TENANT_KEY, id);
      setActAsTenantIdState(id);
    } else {
      localStorage.removeItem(ERP_ACT_AS_TENANT_KEY);
      setActAsTenantIdState(null);
    }
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === "Admin") return true;
      if (user.platformRole === "super_admin") return true;
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
      const headers: Record<string, string> = { Authorization: `Bearer ${t}` };
      try {
        const tid = getEffectiveTenantIdForRequest();
        if (tid) headers["x-tenant-id"] = tid;
      } catch {
        /* ignore */
      }
      const res = await fetch(`${getApiBaseUrl()}/auth/me`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const u = userFromApiPayload(data);
      setUser(u);
      localStorage.setItem("erp_user", JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("erp_user", JSON.stringify(next));
      return next;
    });
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const storedToken = localStorage.getItem("erp_token");
      if (!storedToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${storedToken}` };
        try {
          const tid = getEffectiveTenantIdForRequest();
          if (tid) headers["x-tenant-id"] = tid;
        } catch {
          /* ignore */
        }
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, { headers });
        if (!res.ok) {
          localStorage.removeItem("erp_token");
          localStorage.removeItem("erp_user");
          if (!cancelled) {
            setToken(null);
            setUser(null);
          }
        } else {
          const data = await res.json();
          const u = userFromApiPayload(data);
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

  useEffect(() => {
    if (!user) {
      setActAsTenantIdState(null);
      return;
    }
    if (user.platformRole !== "super_admin") {
      localStorage.removeItem(ERP_ACT_AS_TENANT_KEY);
      setActAsTenantIdState(null);
      return;
    }
    const stored = localStorage.getItem(ERP_ACT_AS_TENANT_KEY);
    setActAsTenantIdState(stored && isLikelyMongoObjectId(stored) ? stored : null);
  }, [user]);

  const login = (apiUserPayload: Record<string, unknown>, t: string) => {
    const u = userFromApiPayload(apiUserPayload);
    setUser(u);
    setToken(t);
    localStorage.setItem("erp_user", JSON.stringify(u));
    localStorage.setItem("erp_token", t);
    if (u.platformRole !== "super_admin") {
      localStorage.removeItem(ERP_ACT_AS_TENANT_KEY);
      setActAsTenantIdState(null);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("erp_user");
    localStorage.removeItem("erp_token");
    localStorage.removeItem(ERP_ACT_AS_TENANT_KEY);
    setActAsTenantIdState(null);
  };

  // -- INACTIVITY TIMEOUT --
  // Sessions expire after 30 minutes of idle time.
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        alert("Your session has expired due to 30 minutes of inactivity. Please log in again.");
      }, INACTIVITY_TIMEOUT);
    };

    // Initial timer
    resetTimer();

    // Listen for activity
    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [token, logout]);

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
        patchUser,
        actAsTenantId,
        setActAsTenantId,
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
