const configuredApiBase = (import.meta.env?.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const API_PREFIX = "/api/v1";

/**
 * Build an iFac API URL.
 * Web builds use a relative /api/v1 path; native builds provide the public
 * application origin through VITE_API_BASE_URL. Both must reach the same
 * Express routes.
 */
export function buildApiUrl(path, base = configuredApiBase) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${path || ""}`;
  const normalizedBase = String(base || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "");

  // Health and other infrastructure endpoints already include /api.
  const requestPath = /^\/api(?:\/|$)/i.test(normalizedPath)
    ? normalizedPath
    : `${API_PREFIX}${normalizedPath}`;

  return `${normalizedBase}${requestPath}`;
}

export function apiUrl(path) {
  return buildApiUrl(path, configuredApiBase);
}
