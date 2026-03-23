/** Single source for API origin (must match axios `api` and `/auth/me`). */
export function getApiBaseUrl(): string {
  return (
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:5000/api"
  );
}
