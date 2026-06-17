import axios from 'axios';
import { getEffectiveTenantIdForRequest } from '@/lib/tenantContext';
import { getApiBaseUrl } from '@/lib/apiBase';

const API_BASE_URL = getApiBaseUrl();

function isStoredUserSuperAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('erp_user');
    if (!raw) return false;
    const u = JSON.parse(raw) as { platformRole?: string };
    return u?.platformRole === 'super_admin';
  } catch {
    return false;
  }
}

let nextPlatformStepUpPassword: string | null = null;
let cachedPlatformStepUpPassword: string | null = null;
let cachedPlatformStepUpUntilMs = 0;
const PLATFORM_STEP_UP_CACHE_KEY = 'erp_platform_step_up_cache_v1';
const PLATFORM_STEP_UP_CACHE_TTL_MS = 5 * 60 * 1000;

export function setNextPlatformStepUpPassword(password: string | null) {
  nextPlatformStepUpPassword = password && password.trim() ? password : null;
}

type PlatformStepUpCachePayload = {
  password: string;
  expiresAt: number;
};

function readStepUpCacheFromSession(): PlatformStepUpCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PLATFORM_STEP_UP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlatformStepUpCachePayload>;
    if (!parsed || typeof parsed.password !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (!parsed.password.trim() || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PLATFORM_STEP_UP_CACHE_KEY);
      return null;
    }
    return { password: parsed.password, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function getCachedPlatformStepUpPassword(): string | null {
  if (cachedPlatformStepUpPassword && cachedPlatformStepUpUntilMs > Date.now()) {
    return cachedPlatformStepUpPassword;
  }
  const persisted = readStepUpCacheFromSession();
  if (!persisted) {
    cachedPlatformStepUpPassword = null;
    cachedPlatformStepUpUntilMs = 0;
    return null;
  }
  cachedPlatformStepUpPassword = persisted.password;
  cachedPlatformStepUpUntilMs = persisted.expiresAt;
  return persisted.password;
}

export function clearPlatformStepUpCache() {
  cachedPlatformStepUpPassword = null;
  cachedPlatformStepUpUntilMs = 0;
  nextPlatformStepUpPassword = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PLATFORM_STEP_UP_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function rememberPlatformStepUpPassword(password: string, ttlMs = PLATFORM_STEP_UP_CACHE_TTL_MS) {
  const clean = String(password || '').trim();
  if (!clean) return;
  const expiresAt = Date.now() + Math.max(5_000, ttlMs);
  cachedPlatformStepUpPassword = clean;
  cachedPlatformStepUpUntilMs = expiresAt;
  if (typeof window !== 'undefined') {
    try {
      const payload: PlatformStepUpCachePayload = { password: clean, expiresAt };
      sessionStorage.setItem(PLATFORM_STEP_UP_CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const tid = getEffectiveTenantIdForRequest();
      if (tid) {
        (config.headers as Record<string, string>)['x-tenant-id'] = tid;
      }
    } catch {
      /* ignore */
    }
    try {
      const method = String(config.method || 'get').toUpperCase();
      const path = String(config.url || '');
      const isPlatformMutation =
        path.includes('/platform/') &&
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
      if (isPlatformMutation) {
        const stepUp = nextPlatformStepUpPassword || getCachedPlatformStepUpPassword();
        if (stepUp) {
          (config.headers as Record<string, string>)['x-step-up-password'] = stepUp;
        }
        nextPlatformStepUpPassword = null;
      }
    } catch {
      /* ignore */
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? '');
    const message = String(error.response?.data?.message || '');
    const lowerMessage = message.toLowerCase();
    const isStepUp401 = status === 401 && message.toLowerCase().includes('step-up');
    const isSubscriptionBlocked403 =
      status === 403 &&
      lowerMessage.includes('tenant') &&
      (lowerMessage.includes('suspended') ||
        lowerMessage.includes('archived') ||
        lowerMessage.includes('trial expired') ||
        lowerMessage.includes('subscription'));
    if (isStepUp401) {
      clearPlatformStepUpCache();
    }
    const kickToLogin =
      (status === 401 && !url.includes('/auth/login') && !isStepUp401) ||
      (isSubscriptionBlocked403 && !isStoredUserSuperAdmin());
    if (kickToLogin) {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;