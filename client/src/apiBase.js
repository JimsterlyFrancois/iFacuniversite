const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${path}`;

  return `${configuredApiBase}${normalizedPath}`;
}
